"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import type { OHLCVCandle } from "@/types/agent-builder-canvas";
import { useChartStore } from "@/store/chart";
import { getIndicator } from "@/lib/indicators/registry";
import type {
  IndicatorDefinition,
  IndicatorInstance,
  IndicatorOutput,
} from "@/lib/indicators/types";

const DEFAULT_COLORS = [
  "#60a5fa",
  "#a78bfa",
  "#22d3ee",
  "#f97316",
  "#fbbf24",
  "#22c55e",
  "#ef4444",
];

type ManagedSeries = {
  api: ISeriesApi<"Line" | "Histogram" | "Area">;
  paneIndex: number;
  output: IndicatorOutput;
};

type ManagedIndicator = {
  instanceId: string;
  definitionId: string;
  series: Map<string, ManagedSeries>;
};

export type ChartHandle = {
  addMarker: (marker: { time: number; color: string; shape: "arrowUp" | "arrowDown" | "circle"; text?: string }) => void;
};

type Props = {
  height?: number;
};

export function Chart(_: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const dexPriceSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const markersRef = useRef<SeriesMarker<Time>[]>([]);
  const managedRef = useRef<Map<string, ManagedIndicator>>(new Map());
  // For sub-pane indicators, allocate a pane index per instance
  const paneAllocRef = useRef<Map<string, number>>(new Map());

  const candles = useChartStore((s) => s.candles);
  const indicators = useChartStore((s) => s.indicators);
  const trades = useChartStore((s) => s.trades);
  const dexPricePoints = useChartStore((s) => s.dexPricePoints);
  const setHovered = useChartStore((s) => s.setHoveredCandleIndex);

  // Init chart once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "#9ca3af",
        panes: { separatorColor: "#1f2937", separatorHoverColor: "#374151", enableResize: true },
      },
      grid: {
        vertLines: { color: "rgba(82, 39, 255, 0.06)" },
        horzLines: { color: "rgba(82, 39, 255, 0.06)" },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: "rgba(82, 39, 255, 0.15)" },
      timeScale: { borderColor: "rgba(82, 39, 255, 0.15)", timeVisible: true, secondsVisible: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      color: "rgba(82, 39, 255, 0.4)",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });

    const dexPriceSeries = chart.addSeries(LineSeries, {
      color: "#f97316",
      lineWidth: 1,
      title: "DEX",
      priceLineVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      lastValueVisible: true,
    });

    const markersPlugin = createSeriesMarkers(candleSeries, []);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    dexPriceSeriesRef.current = dexPriceSeries;
    markersPluginRef.current = markersPlugin;

    const onCrosshairMove = (param: { time?: Time }) => {
      if (!param.time) {
        setHovered(null);
        return;
      }
      const all = useChartStore.getState().candles;
      const idx = all.findIndex((c) => (c.time as unknown as number) === (param.time as unknown as number));
      setHovered(idx >= 0 ? idx : null);
    };
    chart.subscribeCrosshairMove(onCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      dexPriceSeriesRef.current = null;
      markersPluginRef.current = null;
      managedRef.current.clear();
      paneAllocRef.current.clear();
    };
  }, [setHovered]);

  // Push candle data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    candleSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as unknown as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    volumeSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as unknown as Time,
        value: c.volume,
        color: c.close >= c.open ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)",
      })),
    );
    if (candles.length > 0) chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Push DEX price overlay points
  useEffect(() => {
    if (!dexPriceSeriesRef.current) return;
    dexPriceSeriesRef.current.setData(
      dexPricePoints.map((p) => ({ time: p.time as unknown as Time, value: p.value })),
    );
  }, [dexPricePoints]);

  // Sync indicators
  const indicatorsKey = useMemo(
    () => indicators.map((i) => `${i.instanceId}:${i.definitionId}:${JSON.stringify(i.params)}`).join("|"),
    [indicators],
  );

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const wantedIds = new Set(indicators.map((i) => i.instanceId));
    // Remove dropped indicators
    for (const [id, managed] of managedRef.current.entries()) {
      if (!wantedIds.has(id)) {
        for (const m of managed.series.values()) chart.removeSeries(m.api);
        managedRef.current.delete(id);
        paneAllocRef.current.delete(id);
      }
    }
    // Add new + recompute
    for (const inst of indicators) {
      const def = getIndicator(inst.definitionId);
      if (!def) continue;
      let managed = managedRef.current.get(inst.instanceId);
      if (!managed) {
        managed = createManagedIndicator(chart, def, inst, paneAllocRef.current);
        managedRef.current.set(inst.instanceId, managed);
      }
      // Compute & push data
      const result = safeCompute(def, candles, inst);
      for (const out of def.outputs) {
        const ms = managed.series.get(out.id);
        if (!ms) continue;
        const series = result[out.id] ?? [];
        const points = candles
          .map((c, i) => ({ time: c.time as unknown as Time, value: series[i] }))
          .filter((p) => p.value != null && Number.isFinite(p.value as number)) as { time: Time; value: number }[];
        if (out.type === "histogram") {
          (ms.api as ISeriesApi<"Histogram">).setData(
            points.map((p) => ({
              time: p.time,
              value: p.value,
              color: p.value >= 0 ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)",
            })),
          );
        } else {
          (ms.api as ISeriesApi<"Line"> | ISeriesApi<"Area">).setData(points);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicatorsKey, candles]);

  // Drop trade markers
  useEffect(() => {
    if (!markersPluginRef.current) return;
    const tradeMarkers: SeriesMarker<Time>[] = trades.slice(0, 50).map((t) => ({
      time: Math.floor(t.timestamp / 1000) as unknown as Time,
      position: t.side === "buy" ? "belowBar" : "aboveBar",
      color: t.side === "buy" ? "#22c55e" : "#ef4444",
      shape: t.side === "buy" ? "arrowUp" : "arrowDown",
    }));
    const merged = [...markersRef.current, ...tradeMarkers].sort(
      (a, b) => (a.time as number) - (b.time as number),
    );
    markersPluginRef.current.setMarkers(merged);
  }, [trades]);

  return <div ref={containerRef} className="h-full w-full" />;
}

function createManagedIndicator(
  chart: IChartApi,
  def: IndicatorDefinition,
  inst: IndicatorInstance,
  paneAlloc: Map<string, number>,
): ManagedIndicator {
  const series = new Map<string, ManagedSeries>();
  const ensureSubPane = (): number => {
    let allocated = paneAlloc.get(inst.instanceId);
    if (allocated == null) {
      allocated = nextPaneIndex(paneAlloc);
      paneAlloc.set(inst.instanceId, allocated);
    }
    return allocated;
  };
  for (let oi = 0; oi < def.outputs.length; oi++) {
    const out = def.outputs[oi];
    const color = inst.colorOverrides?.[out.id] ?? out.color ?? DEFAULT_COLORS[oi % DEFAULT_COLORS.length];
    const paneIndex = out.pane === "overlay" ? 0 : ensureSubPane();
    let api: ISeriesApi<"Line" | "Histogram" | "Area">;
    if (out.type === "histogram") {
      api = chart.addSeries(HistogramSeries, { color, priceFormat: { type: "price" } }, paneIndex) as ISeriesApi<"Line" | "Histogram" | "Area">;
    } else if (out.type === "area") {
      api = chart.addSeries(AreaSeries, { lineColor: color, topColor: color + "40", bottomColor: color + "00" }, paneIndex) as ISeriesApi<"Line" | "Histogram" | "Area">;
    } else {
      api = chart.addSeries(LineSeries, { color, lineWidth: 2 }, paneIndex) as ISeriesApi<"Line" | "Histogram" | "Area">;
    }
    series.set(out.id, { api, paneIndex, output: out });
  }
  return { instanceId: inst.instanceId, definitionId: def.id, series };
}

function nextPaneIndex(paneAlloc: Map<string, number>): number {
  const used = new Set(paneAlloc.values());
  let i = 1;
  while (used.has(i)) i++;
  return i;
}

function safeCompute(
  def: IndicatorDefinition,
  candles: OHLCVCandle[],
  inst: IndicatorInstance,
): Record<string, (number | null)[]> {
  try {
    return def.compute(candles, inst.params);
  } catch (e) {
    console.error(`[indicator ${def.id}] compute error`, e);
    const blank: Record<string, (number | null)[]> = {};
    for (const o of def.outputs) blank[o.id] = new Array(candles.length).fill(null);
    return blank;
  }
}
