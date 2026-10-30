/**
 * HSKSwap chart history — real OHLCV rebuilt from on-chain Uniswap V3 swaps.
 *
 * GeckoTerminal does not index HSKSwap, so before this module HashKey markets
 * fell back to `fallbackCandles()` in lib/dex/geckoterminal.ts: a seeded
 * pseudo-random walk around a hardcoded price. That is fabricated history on a
 * chart people trade against, so we rebuild the real thing instead.
 *
 * Method
 *   1. Read the pool's `token0` + both token decimals to fix base/quote order.
 *   2. `getLogs` the V3 `Swap` event over the requested window. Each Swap
 *      carries `sqrtPriceX96` — the pool price immediately AFTER that swap —
 *      so one log yields one exact price point with no extra calls.
 *   3. Convert block number → timestamp. HashKey Chain produces blocks on a
 *      fixed cadence (measured: exactly 2.000 s/block over 10k blocks), so a
 *      linear map off one real anchor block is exact, not an estimate. The
 *      cadence is still derived at runtime rather than hardcoded.
 *   4. Bucket prices into OHLCV candles, forward-filling quiet buckets at the
 *      last close with zero volume.
 *
 * Honesty constraints
 *   - Nothing is invented. A forward-filled candle is flat because no swap
 *     happened in that bucket, which is what actually occurred.
 *   - If the pool has no swaps in the window we return an empty array and let
 *     the caller decide, rather than padding with synthetic data.
 *
 * These pools are thin (WHSK/USDT: ~18 swaps/27h at the time of writing), so
 * expect a sparse, stepped series on short intervals. That is the real market.
 */

import {
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
  type PublicClient,
} from "viem";

import { getChainConfig } from "@/lib/chain-registry";
import { sqrtPriceX96ToPrice } from "./onchain-pool";
import type { DexMarketConfig } from "./markets";
import type { DexCandle } from "./types";

export type HistoryInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const SWAP_EVENT = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
);

const POOL_TOKEN_ABI = [
  { inputs: [], name: "token0", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "token1", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
] as const;

const ERC20_DECIMALS_ABI = [
  { inputs: [], name: "decimals", outputs: [{ name: "", type: "uint8" }], stateMutability: "view", type: "function" },
] as const;

/**
 * Measured limits of `eth_getLogs` on https://mainnet.hsk.xyz (2026-11-02).
 *
 * The node enforces two *different* caps depending on how `toBlock` is given:
 *
 *   toBlock: "latest"   → up to 100_000 blocks  ("query exceeds max block range
 *                         100000" at exactly 100_000)
 *   toBlock: <number>   → roughly 5_000 blocks  ("block range too large" by
 *                         7_500)
 *
 * The symbolic form is worth ~20× more history per request, so we make exactly
 * one call against it: 99_999 blocks ≈ 55 h at 2 s/block, which returned 83
 * real swaps on WHSK/USDT. Deeper history would need ~20 concrete-range calls
 * per extra day, which is not worth the page-load latency on pools this thin.
 */
const MAX_LATEST_RANGE = 99_999n;

/** Blocks sampled when measuring the chain's block cadence. */
const CADENCE_SAMPLE_BLOCKS = 10_000n;

const clients = new Map<number, PublicClient>();

function clientFor(chainId: number): PublicClient {
  let client = clients.get(chainId);
  if (!client) {
    const { chain } = getChainConfig(chainId);
    client = createPublicClient({
      chain,
      transport: http(chain.rpcUrls.default.http[0]),
    }) as PublicClient;
    clients.set(chainId, client);
  }
  return client;
}

export function historyIntervalSeconds(interval: HistoryInterval): number {
  switch (interval) {
    case "1m":
      return 60;
    case "5m":
      return 300;
    case "15m":
      return 900;
    case "1h":
      return 3600;
    case "4h":
      return 14400;
    case "1d":
      return 86400;
  }
}

interface PricePoint {
  ts: number;
  price: number;
  volumeQuote: number;
}

/**
 * Rebuilds OHLCV candles for an HSKSwap pool from its on-chain swap history.
 * Returns `[]` when the pool is unconfigured or had no swaps in the window.
 */
export async function getHSKSwapCandles(
  config: DexMarketConfig,
  interval: HistoryInterval,
  limit = 240,
): Promise<DexCandle[]> {
  if (!config.chainId) return [];
  if (!config.poolAddress || config.poolAddress.startsWith("0x0000000000")) return [];

  const client = clientFor(config.chainId);
  const pool = config.poolAddress as Address;

  // ── Pool orientation + decimals ─────────────────────────────────────────────
  const [token0, token1] = await Promise.all([
    client.readContract({ address: pool, abi: POOL_TOKEN_ABI, functionName: "token0" }),
    client.readContract({ address: pool, abi: POOL_TOKEN_ABI, functionName: "token1" }),
  ]);

  const [decimals0, decimals1] = await Promise.all([
    client.readContract({ address: token0, abi: ERC20_DECIMALS_ABI, functionName: "decimals" }),
    client.readContract({ address: token1, abi: ERC20_DECIMALS_ABI, functionName: "decimals" }),
  ]);

  const baseIsToken0 =
    token0.toLowerCase() === config.baseToken.address.toLowerCase();

  // ── Block cadence + window ──────────────────────────────────────────────────
  const latestBlock = await client.getBlock({ blockTag: "latest" });
  const latestNumber = latestBlock.number;
  const latestTs = Number(latestBlock.timestamp);

  const sampleNumber =
    latestNumber > CADENCE_SAMPLE_BLOCKS ? latestNumber - CADENCE_SAMPLE_BLOCKS : 0n;
  const sampleBlock = await client.getBlock({ blockNumber: sampleNumber });
  const sampleSpan = Number(latestNumber - sampleNumber);
  const secondsPerBlock =
    sampleSpan > 0
      ? (latestTs - Number(sampleBlock.timestamp)) / sampleSpan
      : 2;

  // Guard against a degenerate measurement (reorg, archive gap, zero span).
  const blockTime = secondsPerBlock > 0.05 && secondsPerBlock < 600 ? secondsPerBlock : 2;

  const step = historyIntervalSeconds(interval);
  const wantSeconds = step * limit;
  const wantBlocks = BigInt(Math.ceil(wantSeconds / blockTime));
  const spanBlocks = wantBlocks > MAX_LATEST_RANGE ? MAX_LATEST_RANGE : wantBlocks;
  const fromBlock = latestNumber > spanBlocks ? latestNumber - spanBlocks : 0n;

  const nowTs = Math.floor(Date.now() / 1000);

  /**
   * Exact for a fixed-cadence chain, anchored on a real block rather than wall
   * clock. Clamped to now because `toBlock: "latest"` can return blocks mined
   * after the anchor was read.
   */
  const tsForBlock = (block: bigint): number =>
    Math.min(latestTs + Number(block - latestNumber) * blockTime, nowTs);

  // ── Fetch swaps: one request against the symbolic-toBlock window ───────────
  const points: PricePoint[] = [];

  let logs;
  try {
    logs = await client.getLogs({
      address: pool,
      event: SWAP_EVENT,
      fromBlock,
      toBlock: "latest",
    });
  } catch {
    // Caller falls back when we return nothing; never surface fabricated data.
    return [];
  }

  for (const log of logs) {
    const args = log.args as {
      amount0?: bigint;
      amount1?: bigint;
      sqrtPriceX96?: bigint;
    };
    if (args.sqrtPriceX96 == null || args.amount0 == null || args.amount1 == null) continue;
    if (args.sqrtPriceX96 === 0n) continue;

    // Price of token0 denominated in token1, then oriented to base/quote.
    const price0In1 = sqrtPriceX96ToPrice(args.sqrtPriceX96, decimals0, decimals1);
    if (!Number.isFinite(price0In1) || price0In1 <= 0) continue;
    const price = baseIsToken0 ? price0In1 : 1 / price0In1;
    if (!Number.isFinite(price) || price <= 0) continue;

    // Volume in quote units (USDT ≈ USD on these pools).
    const quoteRaw = baseIsToken0 ? args.amount1 : args.amount0;
    const quoteDecimals = baseIsToken0 ? decimals1 : decimals0;
    const volumeQuote = Math.abs(Number(quoteRaw)) / 10 ** quoteDecimals;

    points.push({
      ts: tsForBlock(log.blockNumber ?? latestNumber),
      price,
      volumeQuote,
    });
  }

  if (points.length === 0) return [];

  points.sort((a, b) => a.ts - b.ts);
  return bucketToCandles(points, step, limit);
}

/**
 * Buckets price points into fixed-width candles, forward-filling quiet buckets
 * at the previous close with zero volume (no swap happened, so price held).
 */
function bucketToCandles(points: PricePoint[], step: number, limit: number): DexCandle[] {
  const buckets = new Map<number, DexCandle>();

  for (const p of points) {
    const time = Math.floor(p.ts / step) * step;
    const existing = buckets.get(time);
    if (!existing) {
      buckets.set(time, {
        time,
        open: p.price,
        high: p.price,
        low: p.price,
        close: p.price,
        volume: p.volumeQuote,
      });
    } else {
      existing.high = Math.max(existing.high, p.price);
      existing.low = Math.min(existing.low, p.price);
      existing.close = p.price;
      existing.volume += p.volumeQuote;
    }
  }

  const times = [...buckets.keys()].sort((a, b) => a - b);
  if (times.length === 0) return [];

  const firstTime = times[0];
  const lastTime = Math.floor(Date.now() / 1000 / step) * step;

  const filled: DexCandle[] = [];
  let prevClose = buckets.get(firstTime)!.open;

  for (let t = firstTime; t <= lastTime; t += step) {
    const candle = buckets.get(t);
    if (candle) {
      // Chain the open to the previous close so the series has no visual gaps.
      // The range must then contain that open, or the candle is malformed and
      // lightweight-charts will render an inverted wick.
      const open = prevClose;
      filled.push({
        ...candle,
        open,
        high: Math.max(candle.high, open),
        low: Math.min(candle.low, open),
      });
      prevClose = candle.close;
    } else {
      filled.push({
        time: t,
        open: prevClose,
        high: prevClose,
        low: prevClose,
        close: prevClose,
        volume: 0,
      });
    }
  }

  return filled.length > limit ? filled.slice(filled.length - limit) : filled;
}

// ── Cache ─────────────────────────────────────────────────────────────────────

/**
 * These pools see well under one swap per minute, so a short TTL keeps repeat
 * page loads instant without ever showing a stale price: the chart's live
 * slot0 ticker (lib/terminal/data/livePriceTick) owns the current candle, while
 * this cache only serves settled history.
 *
 * The in-flight promise is cached too, so a burst of concurrent requests
 * collapses into a single `eth_getLogs` round trip.
 */
const HISTORY_TTL_MS = 60_000;

const historyCache = new Map<
  string,
  { at: number; promise: Promise<DexCandle[]> }
>();

export async function getHSKSwapCandlesCached(
  config: DexMarketConfig,
  interval: HistoryInterval,
  limit = 240,
): Promise<DexCandle[]> {
  const key = `${config.id}:${interval}:${limit}`;
  const hit = historyCache.get(key);
  if (hit && Date.now() - hit.at < HISTORY_TTL_MS) return hit.promise;

  const promise = getHSKSwapCandles(config, interval, limit).catch((err) => {
    // Never cache a failure: drop it so the next caller retries.
    historyCache.delete(key);
    throw err;
  });

  historyCache.set(key, { at: Date.now(), promise });
  return promise;
}
