/**
 * Real-time Swap subscriber. Opens ONE eth_subscribe(logs) filtered to the Swap
 * topic across all known pool addresses, decodes each event, updates in-memory
 * state, and emits a SwapUpdate. This is the core that makes data real-time:
 * a swap lands in a block → we're pushed the log → state updates within ~block
 * time (~1-2s on HashKey Chain).
 */

import { EventEmitter } from "node:events";
import { parseAbiItem, type Address, type Log } from "viem";
import { wsClient } from "./chain.js";
import { allPools, getPool, upsertPool } from "./price-state.js";
import { token0PriceInToken1 } from "./price-math.js";

const SWAP_EVENT = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
);

export type SwapUpdate = {
  poolAddress: Address;
  token0Symbol: string;
  token1Symbol: string;
  fee: number;
  /** token0 priced in token1, post-swap. */
  price0in1: number;
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tick: number;
  amount0: bigint;
  amount1: bigint;
  /** Relative to token0: "buy" = trader received token0. */
  side: "buy" | "sell";
  sender: Address;
  recipient: Address;
  txHash: string;
  blockNumber: bigint;
  timestamp: number; // ms
};

/** Emits "swap" (SwapUpdate) and "status" ("live" | "error", detail?). */
export const swapEvents = new EventEmitter();

type DecodedSwapLog = Log<bigint, number, false, typeof SWAP_EVENT, true>;

function handleLog(log: DecodedSwapLog): void {
  const pool = getPool(log.address);
  if (!pool) return; // not a tracked pool

  const { amount0, amount1, sqrtPriceX96, liquidity, tick } = log.args;
  if (sqrtPriceX96 === undefined || amount0 === undefined || amount1 === undefined) {
    return;
  }

  const price0in1 = token0PriceInToken1(
    sqrtPriceX96,
    pool.token0.decimals,
    pool.token1.decimals,
  );

  // Update canonical state.
  upsertPool({
    ...pool,
    sqrtPriceX96,
    liquidity: liquidity ?? pool.liquidity,
    tick: tick !== undefined ? Number(tick) : pool.tick,
    price0in1,
    updatedAt: Date.now(),
  });

  // amount0 < 0 → token0 left the pool → trader bought token0.
  const side: "buy" | "sell" = amount0 < 0n ? "buy" : "sell";

  const update: SwapUpdate = {
    poolAddress: pool.address,
    token0Symbol: pool.token0.symbol,
    token1Symbol: pool.token1.symbol,
    fee: pool.fee,
    price0in1,
    sqrtPriceX96,
    liquidity: liquidity ?? pool.liquidity,
    tick: tick !== undefined ? Number(tick) : pool.tick,
    amount0,
    amount1,
    side,
    sender: log.args.sender!,
    recipient: log.args.recipient!,
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
    timestamp: Date.now(),
  };

  swapEvents.emit("swap", update);
}

let unwatch: (() => void) | null = null;

/** Start the subscription across all currently-known pools. */
export function startSubscriber(): () => void {
  const addresses = allPools().map((p) => p.address);
  if (addresses.length === 0) {
    console.warn("[subscriber] no pools to watch");
  }

  unwatch = wsClient.watchEvent({
    address: addresses,
    event: SWAP_EVENT,
    strict: true,
    onLogs: (logs) => {
      for (const log of logs) handleLog(log as DecodedSwapLog);
    },
    onError: (err) => {
      console.error("[subscriber] watch error:", err.message);
      swapEvents.emit("status", "error", err.message);
    },
  });

  swapEvents.emit("status", "live");
  console.log(`[subscriber] watching Swap events on ${addresses.length} pools`);
  return stopSubscriber;
}

export function stopSubscriber(): void {
  if (unwatch) {
    unwatch();
    unwatch = null;
  }
}
