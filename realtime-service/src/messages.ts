/**
 * Wire protocol between the service and frontend clients. Kept deliberately
 * small and JSON-friendly (bigints serialized as decimal strings). The
 * frontend mirror lives in `lib/realtime/client.ts`.
 */

import type { Address } from "viem";

export type WirePool = {
  address: Address;
  pair: string; // "TOKEN0/TOKEN1"
  token0: Address;
  token1: Address;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
  fee: number; // hundredths of a bip
  feeBps: number; // basis points (fee / 100)
  /** token0 priced in token1 (human units). */
  price0in1: number;
  /** V3 virtual reserves at mid price, raw units as decimal strings. */
  reserve0: string;
  reserve1: string;
  updatedAt: number;
};

export type WireTrade = {
  id: string;
  poolAddress: Address;
  pair: string;
  /** Relative to token0: "buy" = trader received token0. */
  side: "buy" | "sell";
  /** USD price of token0 (the base) at execution. */
  priceUsd: number;
  amountIn: number; // human units
  amountOut: number; // human units
  amountUsd: number;
  trader: Address;
  txHash: string;
  timestamp: number;
};

export type ServerMessage =
  | { type: "snapshot"; pools: WirePool[]; prices: Record<string, number> }
  | { type: "price"; prices: Record<string, number> }
  | { type: "pool"; pool: WirePool }
  | { type: "trade"; trade: WireTrade };

/** Optional client → server message; absent/empty = receive everything. */
export type ClientMessage = { op: "subscribe"; pairs?: string[] };

export function serialize(msg: ServerMessage): string {
  return JSON.stringify(msg);
}
