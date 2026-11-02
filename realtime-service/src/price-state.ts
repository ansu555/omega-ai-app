/**
 * In-memory pool state. The single source of truth the subscriber updates on
 * every Swap and the ws-server / router read from. No DB — state is rebuilt on
 * boot from on-chain reads, so a restart self-heals.
 */

import type { Address } from "viem";
import type { TokenInfo } from "./config.js";

export type PoolState = {
  address: Address;
  /** "v3" today; "v2" reserved for when a const-product DEX is added. */
  kind: "v3";
  token0: TokenInfo;
  token1: TokenInfo;
  fee: number;
  /** Latest sqrtPriceX96 from slot0 / the most recent Swap. */
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tick: number;
  /** token0 priced in token1 (human units), derived from sqrtPriceX96. */
  price0in1: number;
  updatedAt: number; // ms
};

/** poolAddress (lower-case) → state */
export const pools = new Map<string, PoolState>();

export function upsertPool(state: PoolState): void {
  pools.set(state.address.toLowerCase(), state);
}

export function getPool(address: string): PoolState | undefined {
  return pools.get(address.toLowerCase());
}

export function allPools(): PoolState[] {
  return [...pools.values()];
}
