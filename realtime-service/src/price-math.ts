/**
 * Uniswap V3 price math. The Swap event and slot0 expose `sqrtPriceX96`, the
 * square root of the raw token1/token0 price scaled by 2^96. We convert it to a
 * human-readable "how much token1 for 1 token0" figure, decimal-adjusted.
 */

const TWO_POW_96 = 2 ** 96;

/**
 * token0 priced in token1 (human units): how many token1 you get per 1 token0.
 *
 * rawPrice = (sqrtPriceX96 / 2^96)^2  → token1_raw per token0_raw
 * humanPrice = rawPrice * 10^(decimals0 - decimals1)
 *
 * Number precision (~15-16 digits) is sufficient for display/quotes at MVP
 * scale; swap execution still goes through on-chain contracts.
 */
export function token0PriceInToken1(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number,
): number {
  const sqrt = Number(sqrtPriceX96) / TWO_POW_96;
  const rawPrice = sqrt * sqrt;
  return rawPrice * 10 ** (decimals0 - decimals1);
}

/** Inverse: token1 priced in token0. */
export function token1PriceInToken0(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number,
): number {
  const p = token0PriceInToken1(sqrtPriceX96, decimals0, decimals1);
  return p === 0 ? 0 : 1 / p;
}

/**
 * V3 virtual reserves at the current price. Concentrated liquidity has no plain
 * reserve0/reserve1, but the local constant-product behaviour around mid price
 * is reproduced by:
 *   x (token0) = L / sqrtP,   y (token1) = L * sqrtP
 * (raw units, with sqrtP = sqrtPriceX96 / 2^96). Good enough to drive a depth
 * curve near mid; not for exact deep-book simulation.
 */
export function v3VirtualReserves(
  sqrtPriceX96: bigint,
  liquidity: bigint,
): { reserve0: number; reserve1: number } {
  const sqrtP = Number(sqrtPriceX96) / TWO_POW_96;
  const L = Number(liquidity);
  if (sqrtP <= 0 || !Number.isFinite(sqrtP) || L <= 0) {
    return { reserve0: 0, reserve1: 0 };
  }
  return { reserve0: L / sqrtP, reserve1: L * sqrtP };
}
