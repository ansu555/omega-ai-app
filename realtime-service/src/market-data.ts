/**
 * Polls GeckoTerminal + Binance for the curated market list (markets-config.ts),
 * and prices HSKSwap markets on this service's HashKey chain from the live
 * in-memory pool state (GeckoTerminal does not index HSKSwap),
 * and caches the results in-memory, so every consumer (frontend instances, API
 * routes) shares one upstream poll instead of each request hitting GeckoTerminal
 * directly. Mirrors the shapes consumed by lib/dex/geckoterminal.ts in the main
 * app — see rest.ts for the HTTP surface.
 */

import {
  DEX_MARKETS,
  getDexMarketConfig,
  isHashKeyNetwork,
  type DexDisplayToken,
  type DexToken,
  type MarketConfig,
} from "./markets-config.js";
import { HASHKEY_CHAIN_ID } from "./config.js";
import { getPool } from "./price-state.js";

export type DexMarket = {
  id: string;
  symbol: string;
  pairLabel: string;
  name: string;
  kind: "spot" | "perp";
  network: string;
  networkName: string;
  chainId: number | null;
  dex: string;
  poolAddress: string;
  baseToken: DexToken;
  quoteToken: DexToken;
  displayToken: DexDisplayToken;
  priceUsd: number;
  change24h: number;
  volume24hUsd: number;
  liquidityUsd: number;
  transactions24h: number;
  leverage: number | null;
  color: string;
  executionVenue: string;
  source: "geckoterminal" | "binance" | "onchain" | "fallback";
  updatedAt: string;
};

export type DexCandle = { time: number; open: number; high: number; low: number; close: number; volume: number };
export type DexTrade = { id: string; txHash: string; side: "buy" | "sell"; priceUsd: number; size: number; volumeUsd: number; timestamp: string };
export type DexDepthRow = { price: number; size: number; total: number; notionalUsd: number };
export type DexDepth = { asks: DexDepthRow[]; bids: DexDepthRow[]; spread: number; model: "constant-product"; note: string };

type DexInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const GECKO_BASE_URL = "https://api.geckoterminal.com/api/v2";
const BINANCE_BASE_URL = "https://api.binance.com/api/v3";

const MARKET_POLL_MS = 15_000;
const CANDLE_TTL_MS = 10_000;
const TRADE_TTL_MS = 10_000;

const tickerCache = new Map<string, DexMarket>();
const candleCache = new Map<string, { data: { candles: DexCandle[]; isFallback: boolean }; fetchedAt: number }>();
const tradeCache = new Map<string, { data: DexTrade[]; fetchedAt: number }>();

// ── Public cache reads ───────────────────────────────────────────────────────

export function getCachedMarkets(): DexMarket[] {
  return DEX_MARKETS.map((config) => tickerCache.get(config.id) ?? fallbackMarket(config));
}

export function getCachedMarket(id: string | null | undefined): DexMarket {
  const config = getDexMarketConfig(id);
  return tickerCache.get(config.id) ?? fallbackMarket(config);
}

export async function getCachedCandles(
  id: string | null | undefined,
  interval: DexInterval,
  limit = 240,
): Promise<{ candles: DexCandle[]; isFallback: boolean }> {
  const config = getDexMarketConfig(id);
  const key = `${config.id}:${interval}:${limit}`;
  const cached = candleCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CANDLE_TTL_MS) return cached.data;

  const data = await fetchCandles(config, interval, limit);
  candleCache.set(key, { data, fetchedAt: Date.now() });
  return data;
}

export async function getCachedTrades(id: string | null | undefined): Promise<DexTrade[]> {
  const config = getDexMarketConfig(id);
  const cached = tradeCache.get(config.id);
  if (cached && Date.now() - cached.fetchedAt < TRADE_TTL_MS) return cached.data;

  const data = await fetchTrades(config);
  tradeCache.set(config.id, { data, fetchedAt: Date.now() });
  return data;
}

export function getCachedDepth(id: string | null | undefined): DexDepth {
  const market = getCachedMarket(id);
  return generateAmmDepth(market.priceUsd, market.liquidityUsd);
}

// ── Background polling ──────────────────────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startMarketDataPolling(): void {
  if (pollTimer) return;
  refreshAllMarkets().catch((e) => console.error("[market-data] initial refresh failed:", e?.message ?? e));
  pollTimer = setInterval(() => {
    refreshAllMarkets().catch((e) => console.error("[market-data] refresh failed:", e?.message ?? e));
  }, MARKET_POLL_MS);
}

export function stopMarketDataPolling(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function refreshAllMarkets(): Promise<void> {
  // HashKey markets on this service's chain are priced from live pool state;
  // HashKey markets on the other network are left to the app's on-chain read.
  for (const m of DEX_MARKETS) {
    if (m.kind === "spot" && m.chainId === HASHKEY_CHAIN_ID) refreshOnchainMarket(m);
  }

  const geckoMarkets = DEX_MARKETS.filter((m) => m.kind === "spot" && !isHashKeyNetwork(m.network));
  const binanceMarkets = DEX_MARKETS.filter((m) => m.kind === "perp" && m.chartSymbol);

  const byNetwork = new Map<string, MarketConfig[]>();
  for (const m of geckoMarkets) {
    const list = byNetwork.get(m.network) ?? [];
    list.push(m);
    byNetwork.set(m.network, list);
  }

  await Promise.all([
    ...[...byNetwork.entries()].map(([network, markets]) => refreshGeckoNetwork(network, markets)),
    ...binanceMarkets.map((m) => refreshBinanceMarket(m)),
  ]);
}

/** GeckoTerminal multi-pool endpoint, batched at <=30 addresses per call. */
async function refreshGeckoNetwork(network: string, markets: MarketConfig[]): Promise<void> {
  const BATCH = 30;
  for (let i = 0; i < markets.length; i += BATCH) {
    const batch = markets.slice(i, i + BATCH);
    const addresses = batch.map((m) => m.poolAddress).join(",");

    try {
      const res = await fetch(`${GECKO_BASE_URL}/networks/${network}/pools/multi/${addresses}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`GeckoTerminal multi-pool failed: ${res.status}`);

      const json = (await res.json()) as {
        data?: Array<{
          attributes?: {
            address?: string;
            base_token_price_usd?: string | null;
            quote_token_price_usd?: string | null;
            price_change_percentage?: Record<string, string | null> | null;
            volume_usd?: Record<string, string | null> | null;
            reserve_in_usd?: string | null;
            transactions?: Record<string, { buys?: number; sells?: number } | undefined> | null;
          };
        }>;
      };

      const byAddress = new Map<string, NonNullable<typeof json.data>[number]["attributes"]>();
      for (const row of json.data ?? []) {
        const addr = row.attributes?.address?.toLowerCase();
        if (addr) byAddress.set(addr, row.attributes);
      }

      for (const config of batch) {
        const attrs = byAddress.get(config.poolAddress.toLowerCase());
        if (!attrs) continue;

        const priceUsd =
          (config.geckoBaseToken ?? "base") === "base"
            ? toNumber(attrs.base_token_price_usd, config.fallback.priceUsd)
            : toNumber(attrs.quote_token_price_usd, config.fallback.priceUsd);
        const txns = attrs.transactions?.h24;

        tickerCache.set(config.id, {
          ...marketStaticFields(config),
          priceUsd,
          change24h: toNumber(attrs.price_change_percentage?.h24, config.fallback.change24h),
          volume24hUsd: toNumber(attrs.volume_usd?.h24, config.fallback.volume24hUsd),
          liquidityUsd: toNumber(attrs.reserve_in_usd, config.fallback.liquidityUsd),
          transactions24h: (txns?.buys ?? 0) + (txns?.sells ?? 0) || config.fallback.transactions24h,
          source: "geckoterminal",
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error(`[market-data] gecko refresh failed for network=${network}:`, (e as Error)?.message ?? e);
    }
  }
}

/** Spot price from the pool's latest sqrtPrice (seeded at boot, updated on every Swap). */
function refreshOnchainMarket(config: MarketConfig): void {
  const pool = getPool(config.poolAddress);
  if (!pool || !(pool.price0in1 > 0)) return;
  const baseIsToken0 = pool.token0.address.toLowerCase() === config.baseToken.address.toLowerCase();
  const priceUsd = baseIsToken0 ? pool.price0in1 : 1 / pool.price0in1;
  tickerCache.set(config.id, {
    ...marketStaticFields(config),
    ...config.fallback,
    priceUsd,
    source: "onchain",
    updatedAt: new Date(pool.updatedAt).toISOString(),
  });
}

async function refreshBinanceMarket(config: MarketConfig): Promise<void> {
  if (!config.chartSymbol) return;
  try {
    const res = await fetch(`${BINANCE_BASE_URL}/ticker/24hr?symbol=${encodeURIComponent(config.chartSymbol)}`);
    if (!res.ok) throw new Error(`Binance ticker failed: ${res.status}`);

    const json = (await res.json()) as { lastPrice?: string; priceChangePercent?: string; quoteVolume?: string; count?: number };

    tickerCache.set(config.id, {
      ...marketStaticFields(config),
      priceUsd: toNumber(json.lastPrice, config.fallback.priceUsd),
      change24h: toNumber(json.priceChangePercent, config.fallback.change24h),
      volume24hUsd: toNumber(json.quoteVolume, config.fallback.volume24hUsd),
      liquidityUsd: config.fallback.liquidityUsd,
      transactions24h: json.count ?? config.fallback.transactions24h,
      source: "binance",
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`[market-data] binance refresh failed for ${config.id}:`, (e as Error)?.message ?? e);
  }
}

// ── On-demand candles/trades ────────────────────────────────────────────────

async function fetchCandles(
  config: MarketConfig,
  interval: DexInterval,
  limit: number,
): Promise<{ candles: DexCandle[]; isFallback: boolean }> {
  if (config.chartSymbol) {
    const candles = await fetchBinanceCandles(config, interval, limit);
    if (candles.length) return { candles, isFallback: false };
  }

  if (config.kind === "perp" || isHashKeyNetwork(config.network)) return { candles: fallbackCandles(config, interval, limit), isFallback: true };

  const { timeframe, aggregate } = intervalToGecko(interval);
  const token = config.geckoBaseToken ?? "base";

  try {
    const res = await fetch(
      `${GECKO_BASE_URL}/networks/${config.network}/pools/${config.poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=usd&token=${token}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) throw new Error(`GeckoTerminal OHLCV failed: ${res.status}`);

    const json = (await res.json()) as {
      data?: { attributes?: { ohlcv_list?: Array<[number, number, number, number, number, number]> } };
    };
    const rows = json.data?.attributes?.ohlcv_list ?? [];
    const candles = rows
      .map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }))
      .filter((c) => c.time > 0 && c.close > 0);
    const deduped = dedupeCandles(candles);

    return deduped.length
      ? { candles: deduped, isFallback: false }
      : { candles: fallbackCandles(config, interval, limit), isFallback: true };
  } catch {
    return { candles: fallbackCandles(config, interval, limit), isFallback: true };
  }
}

async function fetchBinanceCandles(config: MarketConfig, interval: DexInterval, limit: number): Promise<DexCandle[]> {
  if (!config.chartSymbol) return [];
  try {
    const safeLimit = Math.min(Math.max(limit, 1), 1000);
    const res = await fetch(`${BINANCE_BASE_URL}/klines?symbol=${encodeURIComponent(config.chartSymbol)}&interval=${interval}&limit=${safeLimit}`);
    if (!res.ok) throw new Error(`Binance klines failed: ${res.status}`);

    const rows = (await res.json()) as Array<[number, string, string, string, string, string, number, string, ...unknown[]]>;

    return rows
      .map((row) => ({
        time: Math.floor(row[0] / 1000),
        open: toNumber(row[1], 0),
        high: toNumber(row[2], 0),
        low: toNumber(row[3], 0),
        close: toNumber(row[4], 0),
        volume: toNumber(row[7], toNumber(row[5], 0)),
      }))
      .filter((c) => c.time > 0 && c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)
      .sort((a, b) => a.time - b.time);
  } catch {
    return [];
  }
}

async function fetchTrades(config: MarketConfig): Promise<DexTrade[]> {
  if (config.kind === "perp" || isHashKeyNetwork(config.network)) return fallbackTrades(config);

  const displayAddress = (config.displayToken === "base" ? config.baseToken : config.quoteToken).address.toLowerCase();

  try {
    const res = await fetch(`${GECKO_BASE_URL}/networks/${config.network}/pools/${config.poolAddress}/trades`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`GeckoTerminal trades failed: ${res.status}`);

    const json = (await res.json()) as {
      data?: Array<{
        id?: string;
        attributes?: {
          tx_hash?: string;
          from_token_amount?: string;
          to_token_amount?: string;
          price_from_in_usd?: string;
          price_to_in_usd?: string;
          block_timestamp?: string;
          volume_in_usd?: string;
          from_token_address?: string;
          to_token_address?: string;
        };
      }>;
    };

    const trades =
      json.data
        ?.map((row) => {
          const attrs = row.attributes;
          if (!attrs) return null;

          const fromAddress = attrs.from_token_address?.toLowerCase();
          const toAddress = attrs.to_token_address?.toLowerCase();
          const displayIsFrom = fromAddress === displayAddress;
          const displayIsTo = toAddress === displayAddress;
          const size = displayIsFrom ? toNumber(attrs.from_token_amount, 0) : displayIsTo ? toNumber(attrs.to_token_amount, 0) : 0;
          const priceUsd = displayIsFrom ? toNumber(attrs.price_from_in_usd, 0) : displayIsTo ? toNumber(attrs.price_to_in_usd, 0) : 0;

          return {
            id: row.id ?? attrs.tx_hash ?? `${attrs.block_timestamp}-${size}`,
            txHash: attrs.tx_hash ?? "",
            side: displayIsTo ? ("buy" as const) : ("sell" as const),
            priceUsd,
            size,
            volumeUsd: toNumber(attrs.volume_in_usd, 0),
            timestamp: attrs.block_timestamp ?? new Date().toISOString(),
          };
        })
        .filter((t): t is DexTrade => Boolean(t && t.priceUsd > 0 && t.size > 0))
        .slice(0, 36) ?? [];

    return trades.length ? trades : fallbackTrades(config);
  } catch {
    return fallbackTrades(config);
  }
}

// ── Shared helpers (ported from lib/dex/geckoterminal.ts) ──────────────────

function marketStaticFields(config: MarketConfig) {
  return {
    id: config.id,
    symbol: config.symbol,
    pairLabel: config.pairLabel,
    name: config.name,
    kind: config.kind,
    network: config.network,
    networkName: config.networkName,
    chainId: config.chainId,
    dex: config.dex,
    poolAddress: config.poolAddress,
    baseToken: config.baseToken,
    quoteToken: config.quoteToken,
    displayToken: config.displayToken,
    leverage: config.leverage,
    color: config.color,
    executionVenue: config.executionVenue,
  };
}

function fallbackMarket(config: MarketConfig): DexMarket {
  return {
    ...marketStaticFields(config),
    ...config.fallback,
    source: "fallback",
    updatedAt: new Date().toISOString(),
  };
}

function dedupeCandles(candles: DexCandle[]): DexCandle[] {
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const result: DexCandle[] = [];
  for (const candle of sorted) {
    const last = result[result.length - 1];
    if (last && last.time === candle.time) {
      result[result.length - 1] = candle;
    } else {
      result.push(candle);
    }
  }
  return result;
}

function intervalToGecko(interval: DexInterval) {
  switch (interval) {
    case "1m": return { timeframe: "minute", aggregate: 1 };
    case "5m": return { timeframe: "minute", aggregate: 5 };
    case "15m": return { timeframe: "minute", aggregate: 15 };
    case "1h": return { timeframe: "hour", aggregate: 1 };
    case "4h": return { timeframe: "hour", aggregate: 4 };
    case "1d": return { timeframe: "day", aggregate: 1 };
  }
}

function intervalSeconds(interval: DexInterval) {
  switch (interval) {
    case "1m": return 60;
    case "5m": return 300;
    case "15m": return 900;
    case "1h": return 3600;
    case "4h": return 14400;
    case "1d": return 86400;
  }
}

function fallbackCandles(config: MarketConfig, interval: DexInterval, limit: number): DexCandle[] {
  const step = intervalSeconds(interval);
  const now = Math.floor(Date.now() / 1000 / step) * step;
  const basePrice = config.fallback.priceUsd;
  const seed = pseudoRandom(config.id, 1);
  let close = basePrice * (1 - config.fallback.change24h / 100) * (1 + (seed - 0.5) * 0.008);

  return Array.from({ length: limit }, (_, index) => {
    const time = now - (limit - index - 1) * step;
    const open = close;
    const progress = index / Math.max(limit - 1, 1);
    const target = basePrice * (1 + (progress - 1) * (config.fallback.change24h / 100));
    const noise = (pseudoRandom(config.id, index) - 0.5) * basePrice * 0.0018;
    const meanReversion = (target - open) * 0.08;
    close = Math.max(basePrice * 0.2, open + meanReversion + noise);
    const wick = Math.max(Math.abs(close - open) * 0.55, basePrice * 0.00035);
    const high = Math.max(open, close) + wick * (0.7 + pseudoRandom(config.id, index + 17));
    const low = Math.max(0.000001, Math.min(open, close) - wick * (0.7 + pseudoRandom(config.id, index + 31)));

    return { time, open, high, low, close, volume: Math.max(config.fallback.volume24hUsd / Math.max(limit, 1), 1) };
  });
}

function pseudoRandom(input: string, index: number) {
  let hash = 2166136261;
  const key = `${input}:${index}`;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function fallbackTrades(config: MarketConfig): DexTrade[] {
  const price = config.fallback.priceUsd;
  return Array.from({ length: 24 }, (_, index) => {
    const side = index % 3 === 0 ? "sell" : "buy";
    const size = ((index % 5) + 1) * 12;
    return {
      id: `${config.id}-fallback-${index}`,
      txHash: "",
      side: side as "buy" | "sell",
      priceUsd: price * (1 + Math.sin(index) * 0.002),
      size,
      volumeUsd: size * price,
      timestamp: new Date(Date.now() - index * 120000).toISOString(),
    };
  });
}

function generateAmmDepth(price: number, liquidityUsd: number): DexDepth {
  const safePrice = Math.max(price, 0.000001);
  const safeLiquidity = Math.max(liquidityUsd, safePrice * 1000);
  const quoteReserve = safeLiquidity / 2;
  const baseReserve = quoteReserve / safePrice;
  const invariant = quoteReserve * baseReserve;
  const step = 0.0025;

  const asks: DexDepthRow[] = [];
  const bids: DexDepthRow[] = [];
  let askTotal = 0;
  let bidTotal = 0;
  let previousAskSize = 0;
  let previousBidSize = 0;

  for (let level = 1; level <= 10; level += 1) {
    const askPrice = safePrice * (1 + step * level);
    const askQuoteReserve = Math.sqrt(invariant * askPrice);
    const askBaseReserve = invariant / askQuoteReserve;
    const askCumulativeSize = Math.max(0, baseReserve - askBaseReserve);
    const askSize = Math.max(0, askCumulativeSize - previousAskSize);
    askTotal += askSize;
    previousAskSize = askCumulativeSize;
    asks.push({ price: askPrice, size: askSize, total: askTotal, notionalUsd: askSize * askPrice });

    const bidPrice = safePrice * (1 - step * level);
    const bidBaseReserve = Math.sqrt(invariant / bidPrice);
    const bidCumulativeSize = Math.max(0, bidBaseReserve - baseReserve);
    const bidSize = Math.max(0, bidCumulativeSize - previousBidSize);
    bidTotal += bidSize;
    previousBidSize = bidCumulativeSize;
    bids.push({ price: bidPrice, size: bidSize, total: bidTotal, notionalUsd: bidSize * bidPrice });
  }

  return {
    asks: asks.reverse(),
    bids,
    spread: safePrice * step * 2,
    model: "constant-product",
    note: "Synthetic AMM depth estimated from pool liquidity, not a centralized order book.",
  };
}

function toNumber(value: string | number | null | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
