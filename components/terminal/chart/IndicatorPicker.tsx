"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChartStore } from "@/store/chart";
import {
  listIndicators,
  subscribeIndicators,
  getIndicator,
} from "@/lib/indicators/registry";
import type {
  IndicatorDefinition,
  IndicatorParamValues,
} from "@/lib/indicators/types";

const TABS = [
  { key: "builtin", label: "Built-in" },
  { key: "user", label: "My Indicators" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function useIndicatorRegistrySnapshot() {
  return useSyncExternalStore(
    subscribeIndicators,
    () => listIndicators().length,
    () => 0,
  );
}

function defaultParams(def: IndicatorDefinition): IndicatorParamValues {
  const out: IndicatorParamValues = {};
  for (const p of def.params) out[p.key] = p.default as number | string;
  return out;
}

export function IndicatorPicker({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<TabKey>("builtin");
  useIndicatorRegistrySnapshot();
  const indicators = useChartStore((s) => s.indicators);
  const addIndicator = useChartStore((s) => s.addIndicator);
  const removeIndicator = useChartStore((s) => s.removeIndicator);
  const updateIndicatorParams = useChartStore((s) => s.updateIndicatorParams);

  const items = useMemo(() => listIndicators({ source: tab }), [tab]);
  const counts = useMemo(
    () => ({
      builtin: listIndicators({ source: "builtin" }).length,
      user: listIndicators({ source: "user" }).length,
    }),
    [],
  );

  return (
    <div className="flex h-full w-full flex-col bg-background text-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <span className="font-semibold">Indicators</span>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex border-b border-border/40">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 px-3 py-2 text-xs",
              tab === t.key
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label} ({counts[t.key] ?? 0})
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {tab === "user" ? "No custom indicators yet. Build one in the agent builder." : "No indicators registered."}
          </div>
        )}
        {items.map((def) => (
          <button
            key={def.id}
            onClick={() => {
              addIndicator({
                instanceId: `${def.id}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
                definitionId: def.id,
                params: defaultParams(def),
              });
            }}
            className="flex w-full items-center justify-between gap-2 border-b border-border/30 px-3 py-2 text-left hover:bg-muted/40"
          >
            <div className="min-w-0">
              <div className="text-xs font-medium">{def.name}</div>
              <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                {def.category} · {def.params.length} param{def.params.length === 1 ? "" : "s"}
              </div>
            </div>
            <Plus size={14} className="text-muted-foreground" />
          </button>
        ))}
      </div>

      {indicators.length > 0 && (
        <div className="border-t border-border/60 max-h-[40%] overflow-y-auto">
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Active ({indicators.length})
          </div>
          {indicators.map((inst) => {
            const def = getIndicator(inst.definitionId);
            if (!def) return null;
            return (
              <div
                key={inst.instanceId}
                className="flex items-start justify-between gap-2 border-t border-border/30 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{def.name}</span>
                    <button
                      onClick={() => removeIndicator(inst.instanceId)}
                      className="rounded p-0.5 text-muted-foreground hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                    {def.params.map((p) => (
                      <label key={p.key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span>{p.label}</span>
                        <input
                          type="number"
                          step={p.step ?? 1}
                          min={p.min}
                          max={p.max}
                          value={Number(inst.params[p.key])}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!Number.isFinite(v)) return;
                            updateIndicatorParams(inst.instanceId, {
                              ...inst.params,
                              [p.key]: v,
                            });
                          }}
                          className="w-14 rounded border border-border/50 bg-background px-1 py-0.5 text-[10px] text-foreground"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
