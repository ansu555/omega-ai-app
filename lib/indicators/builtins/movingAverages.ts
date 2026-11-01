import type { IndicatorDefinition } from "../types";
import { closes, ema, sma, rma } from "../math";

export const SMA: IndicatorDefinition = {
  id: "builtin:sma",
  name: "Simple Moving Average",
  category: "trend",
  source: "builtin",
  params: [
    { key: "period", label: "Period", type: "number", default: 20, min: 1, max: 500, step: 1 },
  ],
  outputs: [
    { id: "sma", label: "SMA", pane: "overlay", type: "line", color: "#60a5fa" },
  ],
  compute: (candles, params) => ({
    sma: sma(closes(candles), Number(params.period)),
  }),
};

export const EMA: IndicatorDefinition = {
  id: "builtin:ema",
  name: "Exponential Moving Average",
  category: "trend",
  source: "builtin",
  params: [
    { key: "period", label: "Period", type: "number", default: 20, min: 1, max: 500, step: 1 },
  ],
  outputs: [
    { id: "ema", label: "EMA", pane: "overlay", type: "line", color: "#a78bfa" },
  ],
  compute: (candles, params) => ({
    ema: ema(closes(candles), Number(params.period)),
  }),
};

export const WMA: IndicatorDefinition = {
  id: "builtin:wma",
  name: "Weighted Moving Average",
  category: "trend",
  source: "builtin",
  params: [
    { key: "period", label: "Period", type: "number", default: 20, min: 1, max: 500, step: 1 },
  ],
  outputs: [
    { id: "wma", label: "WMA", pane: "overlay", type: "line", color: "#f97316" },
  ],
  compute: (candles, params) => {
    const period = Number(params.period);
    const c = closes(candles);
    const out: (number | null)[] = new Array(c.length).fill(null);
    if (period <= 0) return { wma: out };
    const denom = (period * (period + 1)) / 2;
    for (let i = period - 1; i < c.length; i++) {
      let num = 0;
      for (let j = 0; j < period; j++) {
        num += c[i - j] * (period - j);
      }
      out[i] = num / denom;
    }
    return { wma: out };
  },
};

export const RMA: IndicatorDefinition = {
  id: "builtin:rma",
  name: "Wilder's Moving Average",
  category: "trend",
  source: "builtin",
  params: [
    { key: "period", label: "Period", type: "number", default: 14, min: 1, max: 500, step: 1 },
  ],
  outputs: [
    { id: "rma", label: "RMA", pane: "overlay", type: "line", color: "#fbbf24" },
  ],
  compute: (candles, params) => ({
    rma: rma(closes(candles), Number(params.period)),
  }),
};
