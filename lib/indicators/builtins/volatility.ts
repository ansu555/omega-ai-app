import type { IndicatorDefinition } from "../types";
import {
  closes,
  ema,
  fillNulls,
  highest,
  highs,
  lows,
  lowest,
  rma,
  sma,
  stddev,
  trueRange,
} from "../math";

export const BBANDS: IndicatorDefinition = {
  id: "builtin:bbands",
  name: "Bollinger Bands",
  category: "volatility",
  source: "builtin",
  params: [
    { key: "period", label: "Period", type: "number", default: 20, min: 2, max: 200, step: 1 },
    { key: "mult", label: "Std Dev", type: "number", default: 2, min: 0.1, max: 10, step: 0.1 },
  ],
  outputs: [
    { id: "upper", label: "Upper", pane: "overlay", type: "line", color: "#60a5fa" },
    { id: "middle", label: "Middle", pane: "overlay", type: "line", color: "#9ca3af" },
    { id: "lower", label: "Lower", pane: "overlay", type: "line", color: "#60a5fa" },
  ],
  compute: (candles, params) => {
    const period = Number(params.period);
    const mult = Number(params.mult);
    const c = closes(candles);
    const middle = sma(c, period);
    const sd = stddev(c, period, middle);
    const upper = fillNulls(c.length);
    const lower = fillNulls(c.length);
    for (let i = 0; i < c.length; i++) {
      if (middle[i] != null && sd[i] != null) {
        upper[i] = (middle[i] as number) + mult * (sd[i] as number);
        lower[i] = (middle[i] as number) - mult * (sd[i] as number);
      }
    }
    return { upper, middle, lower };
  },
};

export const ATR: IndicatorDefinition = {
  id: "builtin:atr",
  name: "Average True Range",
  category: "volatility",
  source: "builtin",
  params: [
    { key: "period", label: "Period", type: "number", default: 14, min: 1, max: 200, step: 1 },
  ],
  outputs: [
    { id: "atr", label: "ATR", pane: "sub", type: "line", color: "#fbbf24" },
  ],
  compute: (candles, params) => {
    const tr = trueRange(candles);
    return { atr: rma(tr, Number(params.period)) };
  },
};

export const KELTNER: IndicatorDefinition = {
  id: "builtin:keltner",
  name: "Keltner Channels",
  category: "volatility",
  source: "builtin",
  params: [
    { key: "period", label: "Period", type: "number", default: 20, min: 2, max: 200, step: 1 },
    { key: "mult", label: "Multiplier", type: "number", default: 2, min: 0.1, max: 10, step: 0.1 },
  ],
  outputs: [
    { id: "upper", label: "Upper", pane: "overlay", type: "line", color: "#60a5fa" },
    { id: "middle", label: "Middle", pane: "overlay", type: "line", color: "#9ca3af" },
    { id: "lower", label: "Lower", pane: "overlay", type: "line", color: "#60a5fa" },
  ],
  compute: (candles, params) => {
    const period = Number(params.period);
    const mult = Number(params.mult);
    const middle = ema(closes(candles), period);
    const atr = rma(trueRange(candles), period);
    const upper = fillNulls(candles.length);
    const lower = fillNulls(candles.length);
    for (let i = 0; i < candles.length; i++) {
      if (middle[i] != null && atr[i] != null) {
        upper[i] = (middle[i] as number) + mult * (atr[i] as number);
        lower[i] = (middle[i] as number) - mult * (atr[i] as number);
      }
    }
    return { upper, middle, lower };
  },
};

export const DONCHIAN: IndicatorDefinition = {
  id: "builtin:donchian",
  name: "Donchian Channels",
  category: "volatility",
  source: "builtin",
  params: [
    { key: "period", label: "Period", type: "number", default: 20, min: 2, max: 200, step: 1 },
  ],
  outputs: [
    { id: "upper", label: "Upper", pane: "overlay", type: "line", color: "#60a5fa" },
    { id: "middle", label: "Middle", pane: "overlay", type: "line", color: "#9ca3af" },
    { id: "lower", label: "Lower", pane: "overlay", type: "line", color: "#60a5fa" },
  ],
  compute: (candles, params) => {
    const period = Number(params.period);
    const upper = highest(highs(candles), period);
    const lower = lowest(lows(candles), period);
    const middle = fillNulls(candles.length);
    for (let i = 0; i < candles.length; i++) {
      if (upper[i] != null && lower[i] != null) {
        middle[i] = ((upper[i] as number) + (lower[i] as number)) / 2;
      }
    }
    return { upper, middle, lower };
  },
};
