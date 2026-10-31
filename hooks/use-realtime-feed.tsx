"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Address } from "viem";
import { useChartStore } from "@/store/chart";
import {
  realtimeClient,
  type ConnectionStatus,
  type ServerMessage,
  type WirePool,
  type WireTrade,
} from "@/lib/realtime/client";

// ── Platform-wide USD prices ──────────────────────────────────────────────────

const EMPTY_PRICES: Record<string, number> = {};

/** Live USD prices for every tracked token, pushed from the service. */
export function useRealtimePrices(): Record<string, number> {
  return useSyncExternalStore(
    (cb) => realtimeClient.onMessage(cb),
    () => realtimeClient.prices,
    () => EMPTY_PRICES,
  );
}

/** Live USD price for a single token symbol (e.g. "WHSK"). */
export function useRealtimePrice(symbol: string | undefined): number | undefined {
  const prices = useRealtimePrices();
  return symbol ? prices[symbol] : undefined;
}

// ── Terminal feed: trades + reserves for the active pair ──────────────────────

function toLiveTrade(t: WireTrade) {
  return {
    id: t.id,
    timestamp: t.timestamp,
    side: t.side,
    priceUsd: t.priceUsd,
    amountIn: t.amountIn,
    amountOut: t.amountOut,
    amountUsd: t.amountUsd,
    trader: t.trader as Address,
    txHash: t.txHash,
  };
}

function toReserves(p: WirePool) {
  return {
    reserve0: BigInt(p.reserve0),
    reserve1: BigInt(p.reserve1),
    token0: p.token0 as Address,
    token1: p.token1 as Address,
    decimals0: p.decimals0,
    decimals1: p.decimals1,
    feeBps: p.feeBps,
    midPrice: p.price0in1,
    updatedAt: p.updatedAt,
  };
}

/** Preferred quote tokens, deepest/most-stable first. */
const QUOTE_PREFERENCE = ["USDT", "USDC", "WHSK"];

/**
 * Find the best tracked pair for a base symbol from the live pool cache:
 * `base/<quote>` (either orientation) using the quote preference order.
 * Returns the canonical pair string ("SYMBOL0/SYMBOL1") or null.
 */
function resolvePairForSymbol(symbol: string): string | null {
  const candidates = [...realtimeClient.pools.values()].filter(
    (p) => p.symbol0 === symbol || p.symbol1 === symbol,
  );
  if (candidates.length === 0) return null;

  for (const quote of QUOTE_PREFERENCE) {
    if (quote === symbol) continue;
    const match = candidates.find(
      (p) =>
        (p.symbol0 === symbol && p.symbol1 === quote) ||
        (p.symbol1 === symbol && p.symbol0 === quote),
    );
    if (match) return match.pair;
  }
  return candidates[0]?.pair ?? null;
}

/**
 * Subscribes the chart store to live trades + reserves for the active terminal
 * symbol. `symbolOrPair` may be a base symbol ("WHSK") — resolved to the best
 * quote pair from the live cache — or an explicit pair ("WHSK/USDC"). Returns
 * the connection status; when not "live" the caller can show stale/fallback UI.
 */
export function useRealtimeTerminalFeed(
  symbolOrPair: string | undefined,
  enabled = true,
): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const pushTrade = useChartStore((s) => s.pushTrade);
  const setReserves = useChartStore((s) => s.setReserves);
  const pushDexPrice = useChartStore((s) => s.pushDexPrice);
  const clearDexPrice = useChartStore((s) => s.clearDexPrice);

  useEffect(() => {
    if (!enabled || !symbolOrPair) return;

    const isPair = symbolOrPair.includes("/");
    // For a base symbol the resolved pair can change as the snapshot lands, so
    // re-resolve on each message; for an explicit pair it's fixed.
    let pair: string | null = isPair ? symbolOrPair : resolvePairForSymbol(symbolOrPair);

    const seed = (p: string | null) => {
      if (!p) return;
      const cached = realtimeClient.pools.get(p);
      if (cached) setReserves(toReserves(cached));
    };
    seed(pair);

    const offMsg = realtimeClient.onMessage((msg: ServerMessage) => {
      if (!isPair && !pair) {
        pair = resolvePairForSymbol(symbolOrPair);
        seed(pair);
      }
      if (!pair) return;

      if (msg.type === "trade" && msg.trade.pair === pair) {
        pushTrade(toLiveTrade(msg.trade));
        if (msg.trade.priceUsd > 0) {
          pushDexPrice({ time: Math.floor(msg.trade.timestamp / 1000), value: msg.trade.priceUsd });
        }
      } else if (msg.type === "pool" && msg.pool.pair === pair) {
        setReserves(toReserves(msg.pool));
      } else if (msg.type === "snapshot") {
        const resolved = isPair ? pair : resolvePairForSymbol(symbolOrPair);
        pair = resolved;
        const p = resolved ? msg.pools.find((x) => x.pair === resolved) : undefined;
        if (p) setReserves(toReserves(p));
      }
    });
    const offStatus = realtimeClient.onStatus(setStatus);

    return () => {
      offMsg();
      offStatus();
      clearDexPrice();
    };
  }, [symbolOrPair, enabled, pushTrade, setReserves, pushDexPrice, clearDexPrice]);

  return status;
}
