"use client";

import { useMemo } from "react";
import type { ChartExecutionAccess, OHLCVCandle } from "@/types/agent-builder-canvas";
import { useChartStore } from "@/store/chart";
import { useTerminalStore } from "@/store/terminal";
import { getIndicator } from "@/lib/indicators/registry";
import type { IndicatorParamValues } from "@/lib/indicators/types";

export type ChartContextSnapshot = {
  candles: OHLCVCandle[];
  hoveredCandle: OHLCVCandle | null;
  activeSymbol: ReturnType<typeof useTerminalStore.getState>["activeSymbol"];
  access: ChartExecutionAccess;
};

export function useChartContext(): ChartContextSnapshot {
  const candles = useChartStore((s) => s.candles);
  const hoveredIndex = useChartStore((s) => s.hoveredCandleIndex);
  const activeSymbol = useTerminalStore((s) => s.activeSymbol);

  return useMemo(() => {
    const access: ChartExecutionAccess = {
      getCandles: () => useChartStore.getState().candles,
      getActiveSymbol: () => {
        const a = useTerminalStore.getState().activeSymbol;
        return { symbol: a.symbol, address: a.address, name: a.name };
      },
      getIndicator: (defId, params) => {
        const def = getIndicator(defId);
        const c = useChartStore.getState().candles;
        if (!def) {
          const blank: Record<string, (number | null)[]> = {};
          return blank;
        }
        const merged: IndicatorParamValues = {};
        for (const p of def.params) merged[p.key] = p.default as number | string;
        if (params) Object.assign(merged, params);
        return def.compute(c, merged);
      },
      addMarker: () => {
        // Markers are written through the chart's marker plugin; placeholder
        // until a marker bus is added (Trades tile uses a separate path).
      },
    };
    return {
      candles,
      hoveredCandle: hoveredIndex != null ? candles[hoveredIndex] ?? null : null,
      activeSymbol,
      access,
    };
  }, [candles, hoveredIndex, activeSymbol]);
}
