"use client";

import type { OHLCVCandle } from "@/types/agent-builder-canvas";
import type {
  IndicatorOutput,
  IndicatorParamValues,
} from "@/lib/indicators/types";
import { closes, ema, fillNulls, highs, lows, sma, volumes } from "@/lib/indicators/math";
import { getIndicator } from "@/lib/indicators/registry";

// A SerializedIndicatorGraph describes a directed expression tree the user
// composes in the agent builder when in "Build indicator" mode.  Each output
// node names a slot that maps onto an `IndicatorOutput` declared in the user
// indicator record.  The compiler walks the graph and returns a function with
// the same signature every built-in uses, so the chart engine treats them
// identically.
export type ExprNode =
  | { kind: "price"; field: "open" | "high" | "low" | "close" | "volume" }
  | { kind: "param"; key: string }
  | { kind: "const"; value: number }
  | { kind: "arith"; op: "add" | "sub" | "mul" | "div"; lhs: ExprNode; rhs: ExprNode }
  | { kind: "builtin"; defId: string; outputId: string; params?: Record<string, number | string> & { _input?: ExprNode } }
  | { kind: "sma"; period: ExprNode; input: ExprNode }
  | { kind: "ema"; period: ExprNode; input: ExprNode };

export type SerializedIndicatorGraph = {
  // outputId -> expression to compute series
  outputs: Record<string, ExprNode>;
};

type Series = (number | null)[];

type CompiledIndicator = (
  candles: OHLCVCandle[],
  params: IndicatorParamValues,
  outputs: IndicatorOutput[],
) => Record<string, Series>;

export function compileUserIndicator(graph: SerializedIndicatorGraph): CompiledIndicator {
  return (candles, params, outputs) => {
    const result: Record<string, Series> = {};
    for (const out of outputs) {
      const expr = graph.outputs[out.id];
      result[out.id] = expr ? evalExpr(expr, candles, params) : fillNulls(candles.length);
    }
    return result;
  };
}

function evalExpr(node: ExprNode, candles: OHLCVCandle[], params: IndicatorParamValues): Series {
  switch (node.kind) {
    case "price":
      switch (node.field) {
        case "open":
          return candles.map((c) => c.open);
        case "high":
          return highs(candles);
        case "low":
          return lows(candles);
        case "close":
          return closes(candles);
        case "volume":
          return volumes(candles);
      }
      return fillNulls(candles.length);
    case "const":
      return new Array(candles.length).fill(node.value);
    case "param": {
      const v = params[node.key];
      const num = typeof v === "number" ? v : parseFloat(String(v));
      return new Array(candles.length).fill(Number.isFinite(num) ? num : null);
    }
    case "arith": {
      const a = evalExpr(node.lhs, candles, params);
      const b = evalExpr(node.rhs, candles, params);
      const out = fillNulls(candles.length);
      for (let i = 0; i < candles.length; i++) {
        const av = a[i];
        const bv = b[i];
        if (av == null || bv == null) continue;
        if (node.op === "add") out[i] = av + bv;
        else if (node.op === "sub") out[i] = av - bv;
        else if (node.op === "mul") out[i] = av * bv;
        else if (node.op === "div") out[i] = bv === 0 ? null : av / bv;
      }
      return out;
    }
    case "sma": {
      const periodSeries = evalExpr(node.period, candles, params);
      const period = scalarOf(periodSeries) ?? 20;
      const inputSeries = evalExpr(node.input, candles, params);
      const numeric = inputSeries.map((v) => (v == null ? 0 : v));
      return sma(numeric, period);
    }
    case "ema": {
      const periodSeries = evalExpr(node.period, candles, params);
      const period = scalarOf(periodSeries) ?? 20;
      const inputSeries = evalExpr(node.input, candles, params);
      const numeric = inputSeries.map((v) => (v == null ? 0 : v));
      return ema(numeric, period);
    }
    case "builtin": {
      const def = getIndicator(node.defId);
      if (!def) return fillNulls(candles.length);
      const builtinParams: IndicatorParamValues = {};
      for (const p of def.params) builtinParams[p.key] = p.default as number | string;
      if (node.params) {
        for (const [k, v] of Object.entries(node.params)) {
          if (k === "_input") continue;
          builtinParams[k] = v as number | string;
        }
      }
      const result = def.compute(candles, builtinParams);
      return result[node.outputId] ?? fillNulls(candles.length);
    }
  }
}

function scalarOf(series: Series): number | null {
  for (const v of series) {
    if (v != null && Number.isFinite(v)) return Math.floor(v);
  }
  return null;
}
