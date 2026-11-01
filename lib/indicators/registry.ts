"use client";

import type { IndicatorDefinition, IndicatorSource, IndicatorCategory } from "./types";

const registry = new Map<string, IndicatorDefinition>();
const subscribers = new Set<() => void>();

export function registerIndicator(def: IndicatorDefinition) {
  registry.set(def.id, def);
  subscribers.forEach((fn) => fn());
}

export function unregisterIndicator(id: string) {
  if (registry.delete(id)) {
    subscribers.forEach((fn) => fn());
  }
}

export function getIndicator(id: string): IndicatorDefinition | undefined {
  return registry.get(id);
}

export function listIndicators(filter?: {
  source?: IndicatorSource;
  category?: IndicatorCategory;
}): IndicatorDefinition[] {
  const all = Array.from(registry.values());
  return all.filter((d) => {
    if (filter?.source && d.source !== filter.source) return false;
    if (filter?.category && d.category !== filter.category) return false;
    return true;
  });
}

export function subscribeIndicators(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
