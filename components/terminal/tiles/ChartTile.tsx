"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChartStore, CHART_INTERVALS } from "@/store/chart";
import { useChartData } from "../hooks/useChartData";
import { IndicatorPicker } from "../chart/IndicatorPicker";

const Chart = dynamic(() => import("../chart/Chart").then((m) => m.Chart), {
  ssr: false,
});

export function ChartTile() {
  useChartData();
  const interval = useChartStore((s) => s.interval);
  const setInterval = useChartStore((s) => s.setInterval);
  const liveStatus = useChartStore((s) => s.liveStatus);
  const indicatorCount = useChartStore((s) => s.indicators.length);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-1">
          {CHART_INTERVALS.map((iv) => (
            <button
              key={iv.value}
              onClick={() => setInterval(iv.value)}
              onMouseDown={(e) => e.stopPropagation()}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                interval === iv.value
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {iv.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[10px] uppercase tracking-wide",
              liveStatus === "live" && "text-green-400",
              liveStatus === "loading" && "text-amber-400",
              liveStatus === "error" && "text-red-400",
              liveStatus === "idle" && "text-muted-foreground",
            )}
          >
            ● {liveStatus}
          </span>
          <button
            onClick={() => setPickerOpen((o) => !o)}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex items-center gap-1 rounded border border-border/40 bg-card/50 px-2 py-0.5 text-[10px] hover:bg-card"
          >
            <Settings2 size={11} /> Indicators ({indicatorCount})
          </button>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <Chart />
        {pickerOpen && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute right-2 top-2 z-20 flex h-[80%] w-72 flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-2xl"
          >
            <IndicatorPicker onClose={() => setPickerOpen(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
