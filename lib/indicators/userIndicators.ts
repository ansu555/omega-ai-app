"use client";

import type {
  IndicatorCategory,
  IndicatorDefinition,
  IndicatorOutput,
  IndicatorParam,
  IndicatorParamValues,
} from "./types";
import { registerIndicator, unregisterIndicator } from "./registry";
import {
  compileUserIndicator,
  type SerializedIndicatorGraph,
} from "@/lib/agent-builder/engine/IndicatorCompiler";

const STORAGE_KEY = "omeswap_user_indicators";

export type UserIndicatorRecord = {
  id: string; // 'user:<uuid>'
  name: string;
  category: IndicatorCategory;
  params: IndicatorParam[];
  outputs: IndicatorOutput[];
  graph: SerializedIndicatorGraph;
  createdAt: string;
};

function loadAll(): UserIndicatorRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserIndicatorRecord[]) : [];
  } catch (e) {
    console.error("[userIndicators] load failed", e);
    return [];
  }
}

function saveAll(records: UserIndicatorRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error("[userIndicators] save failed", e);
  }
}

function recordToDefinition(rec: UserIndicatorRecord): IndicatorDefinition {
  const compiled = compileUserIndicator(rec.graph);
  return {
    id: rec.id,
    name: rec.name,
    category: rec.category,
    source: "user",
    params: rec.params,
    outputs: rec.outputs,
    compute: (candles, params: IndicatorParamValues) => {
      try {
        return compiled(candles, params, rec.outputs);
      } catch (e) {
        console.error(`[user indicator ${rec.id}]`, e);
        const blank: Record<string, (number | null)[]> = {};
        for (const o of rec.outputs) blank[o.id] = new Array(candles.length).fill(null);
        return blank;
      }
    },
  };
}

let loaded = false;

export function loadUserIndicators() {
  if (loaded) return;
  loaded = true;
  for (const rec of loadAll()) {
    registerIndicator(recordToDefinition(rec));
  }
}

export function publishUserIndicator(rec: UserIndicatorRecord) {
  const all = loadAll();
  const idx = all.findIndex((r) => r.id === rec.id);
  if (idx >= 0) all[idx] = rec;
  else all.push(rec);
  saveAll(all);
  registerIndicator(recordToDefinition(rec));
}

export function deleteUserIndicator(id: string) {
  const all = loadAll().filter((r) => r.id !== id);
  saveAll(all);
  unregisterIndicator(id);
}

export function listUserIndicators(): UserIndicatorRecord[] {
  return loadAll();
}
