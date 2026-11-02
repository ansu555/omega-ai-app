/**
 * In-memory multi-hop router. Runs constant-product math over each pool's V3
 * virtual reserves, evaluating the direct path plus one hop through each hub —
 * the same strategy as the app's use-dex-aggregator, but resolved instantly
 * from RAM instead of N sequential on-chain reads per quote.
 *
 * The result is an ESTIMATE (virtual reserves approximate concentrated
 * liquidity near mid price). Exact execution still goes through the on-chain
 * router/quoter; the frontend treats this as a fast preview with on-chain
 * fallback.
 */

import type { Address } from "viem";
import { HUB_TOKENS, TOKENS_BY_ADDRESS, TOKEN_LIST } from "./config.js";
import { allPools, type PoolState } from "./price-state.js";
import { v3VirtualReserves } from "./price-math.js";

export type RouteResult = {
  path: string[]; // token symbols, in order
  pools: Address[];
  amountIn: number;
  amountOut: number;
  estimate: true;
};

function resolveSymbol(tokenOrSymbol: string): string | null {
  const direct = TOKEN_LIST.find((t) => t.symbol === tokenOrSymbol);
  if (direct) return direct.symbol;
  const byAddr = TOKENS_BY_ADDRESS.get(tokenOrSymbol.toLowerCase());
  return byAddr?.symbol ?? null;
}

/** Deepest usable pool for an unordered pair of symbols. */
function bestPool(aSym: string, bSym: string): PoolState | null {
  let best: PoolState | null = null;
  for (const p of allPools()) {
    const match =
      (p.token0.symbol === aSym && p.token1.symbol === bSym) ||
      (p.token0.symbol === bSym && p.token1.symbol === aSym);
    if (!match) continue;
    if (!Number.isFinite(p.price0in1) || p.price0in1 <= 0 || p.liquidity <= 0n) continue;
    if (!best || p.liquidity > best.liquidity) best = p;
  }
  return best;
}

/** Constant-product output for one hop, in human units. */
function quoteHop(pool: PoolState, fromSym: string, amountIn: number): number {
  const { reserve0, reserve1 } = v3VirtualReserves(pool.sqrtPriceX96, pool.liquidity);
  const r0 = reserve0 / 10 ** pool.token0.decimals;
  const r1 = reserve1 / 10 ** pool.token1.decimals;
  const fromIsToken0 = pool.token0.symbol === fromSym;
  const reserveIn = fromIsToken0 ? r0 : r1;
  const reserveOut = fromIsToken0 ? r1 : r0;
  if (reserveIn <= 0 || reserveOut <= 0) return 0;

  const feeFrac = pool.fee / 1_000_000; // fee is hundredths of a bip
  const amountInAfterFee = amountIn * (1 - feeFrac);
  return (reserveOut * amountInAfterFee) / (reserveIn + amountInAfterFee);
}

function quotePath(symbols: string[], amountIn: number): { out: number; pools: Address[] } | null {
  let amount = amountIn;
  const pools: Address[] = [];
  for (let i = 0; i < symbols.length - 1; i++) {
    const pool = bestPool(symbols[i]!, symbols[i + 1]!);
    if (!pool) return null;
    amount = quoteHop(pool, symbols[i]!, amount);
    if (amount <= 0) return null;
    pools.push(pool.address);
  }
  return { out: amount, pools };
}

export function quoteRoute(
  tokenIn: string,
  tokenOut: string,
  amountIn: number,
): RouteResult | null {
  const inSym = resolveSymbol(tokenIn);
  const outSym = resolveSymbol(tokenOut);
  if (!inSym || !outSym || inSym === outSym || !(amountIn > 0)) return null;

  const hubSymbols = HUB_TOKENS.map((a) => TOKENS_BY_ADDRESS.get(a.toLowerCase())?.symbol).filter(
    (s): s is string => !!s && s !== inSym && s !== outSym,
  );

  const candidatePaths: string[][] = [[inSym, outSym], ...hubSymbols.map((h) => [inSym, h, outSym])];

  let best: RouteResult | null = null;
  for (const path of candidatePaths) {
    const quoted = quotePath(path, amountIn);
    if (!quoted) continue;
    if (!best || quoted.out > best.amountOut) {
      best = { path, pools: quoted.pools, amountIn, amountOut: quoted.out, estimate: true };
    }
  }
  return best;
}
