"use client";

import { create } from "zustand";
import type { Address } from "viem";
import type { OHLCVCandle } from "@/types/agent-builder-canvas";
import type { IndicatorInstance, IndicatorParamValues } from "@/lib/indicators/types";

export type ChartInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export type DexPricePoint = { time: number; value: number };

export const CHART_INTERVALS: { label: string; value: ChartInterval }[] = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
  { label: "1D", value: "1d" },
];

export type LiveTrade = {
  id: string;
  timestamp: number; // ms
  side: "buy" | "sell";
  priceUsd: number;
  amountIn: number;
  amountOut: number;
  amountUsd: number;
  trader: Address;
  txHash: string;
};

export type PoolReserves = {
  reserve0: bigint;
  reserve1: bigint;
  token0: Address;
  token1: Address;
  decimals0: number;
  decimals1: number;
  feeBps: number;
  midPrice: number; // token1/token0 price (display oriented)
  updatedAt: number; // ms
};

type ChartState = {
  interval: ChartInterval;
  candles: OHLCVCandle[];
  liveStatus: "idle" | "loading" | "live" | "error";
  liveError: string | null;
  trades: LiveTrade[];
  reserves: PoolReserves | null;
  indicators: IndicatorInstance[];
  hoveredCandleIndex: number | null;
  dexPricePoints: DexPricePoint[];

  setInterval: (i: ChartInterval) => void;
  setCandles: (candles: OHLCVCandle[]) => void;
  upsertCandle: (candle: OHLCVCandle) => void;
  setLiveStatus: (s: ChartState["liveStatus"]) => void;
  setLiveError: (msg: string | null) => void;
  pushTrade: (trade: LiveTrade) => void;
  setReserves: (r: PoolReserves | null) => void;
  addIndicator: (instance: IndicatorInstance) => void;
  removeIndicator: (instanceId: string) => void;
  updateIndicatorParams: (instanceId: string, params: IndicatorParamValues) => void;
  setHoveredCandleIndex: (i: number | null) => void;
  pushDexPrice: (point: DexPricePoint) => void;
  clearDexPrice: () => void;
  reset: () => void;
};

const MAX_TRADES = 200;

const MAX_DEX_PRICE_POINTS = 500;

export const useChartStore = create<ChartState>((set) => ({
  interval: "1h",
  candles: [],
  liveStatus: "idle",
  liveError: null,
  trades: [],
  reserves: null,
  indicators: [],
  hoveredCandleIndex: null,
  dexPricePoints: [],

  setInterval: (interval) => set({ interval }),
  setCandles: (candles) => set({ candles }),
  upsertCandle: (candle) =>
    set((s) => {
      if (s.candles.length === 0) return { candles: [candle] };
      const last = s.candles[s.candles.length - 1];
      if (candle.time === last.time) {
        const next = s.candles.slice(0, -1);
        next.push(candle);
        return { candles: next };
      }
      if (candle.time > last.time) return { candles: [...s.candles, candle] };
      return s;
    }),
  setLiveStatus: (liveStatus) => set({ liveStatus }),
  setLiveError: (liveError) => set({ liveError }),
  pushTrade: (trade) =>
    set((s) => {
      const next = [trade, ...s.trades];
      if (next.length > MAX_TRADES) next.length = MAX_TRADES;
      return { trades: next };
    }),
  setReserves: (reserves) => set({ reserves }),
  pushDexPrice: (point) =>
    set((s) => {
      const pts = s.dexPricePoints;
      // Same second as last point (same block) → update in place
      if (pts.length > 0 && pts[pts.length - 1].time === point.time) {
        return { dexPricePoints: [...pts.slice(0, -1), point] };
      }
      const next = [...pts, point];
      if (next.length > MAX_DEX_PRICE_POINTS) next.splice(0, next.length - MAX_DEX_PRICE_POINTS);
      return { dexPricePoints: next };
    }),
  clearDexPrice: () => set({ dexPricePoints: [] }),
  addIndicator: (instance) =>
    set((s) => ({ indicators: [...s.indicators, instance] })),
  removeIndicator: (instanceId) =>
    set((s) => ({ indicators: s.indicators.filter((i) => i.instanceId !== instanceId) })),
  updateIndicatorParams: (instanceId, params) =>
    set((s) => ({
      indicators: s.indicators.map((i) =>
        i.instanceId === instanceId ? { ...i, params } : i,
      ),
    })),
  setHoveredCandleIndex: (hoveredCandleIndex) => set({ hoveredCandleIndex }),
  reset: () =>
    set({
      candles: [],
      trades: [],
      reserves: null,
      hoveredCandleIndex: null,
      liveStatus: "idle",
      liveError: null,
      dexPricePoints: [],
    }),
}));
