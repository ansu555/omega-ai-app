/**
 * USD price derivation. Stables anchor at $1; every other token is priced by
 * pathing through the deepest-liquidity pool to an already-priced token (direct
 * to a stable, or via WHSK). Recomputed on each swap — cheap for a small token
 * set. This replaces the 5-min CoinGecko feed with the pool's executable price.
 */

import { TOKEN_LIST } from "./config.js";
import { allPools, type PoolState } from "./price-state.js";

/** symbol → USD price */
export type UsdPrices = Map<string, number>;

function isUsable(p: PoolState): boolean {
  return Number.isFinite(p.price0in1) && p.price0in1 > 0 && p.liquidity > 0n;
}

/** Among pools linking `symbol` to a priced token, return the deepest. */
function bestBridge(
  symbol: string,
  priced: UsdPrices,
  pools: PoolState[],
): { priceInOther: number; otherSymbol: string } | null {
  let best: PoolState | null = null;
  for (const p of pools) {
    const links =
      (p.token0.symbol === symbol && priced.has(p.token1.symbol)) ||
      (p.token1.symbol === symbol && priced.has(p.token0.symbol));
    if (!links) continue;
    if (!best || p.liquidity > best.liquidity) best = p;
  }
  if (!best) return null;

  if (best.token0.symbol === symbol) {
    return { priceInOther: best.price0in1, otherSymbol: best.token1.symbol };
  }
  return { priceInOther: 1 / best.price0in1, otherSymbol: best.token0.symbol };
}

export function computeUsdPrices(): UsdPrices {
  const usd: UsdPrices = new Map();
  for (const t of TOKEN_LIST) if (t.isStable) usd.set(t.symbol, 1);

  const pools = allPools().filter(isUsable);

  // Resolve remaining tokens by repeated passes (handles token→WHSK→stable).
  for (let pass = 0; pass < TOKEN_LIST.length; pass++) {
    let changed = false;
    for (const t of TOKEN_LIST) {
      if (usd.has(t.symbol)) continue;
      const bridge = bestBridge(t.symbol, usd, pools);
      if (!bridge) continue;
      usd.set(t.symbol, bridge.priceInOther * usd.get(bridge.otherSymbol)!);
      changed = true;
    }
    if (!changed) break;
  }
  return usd;
}
