import type { IndicatorDefinition } from "../types";
import { closes, ema, fillNulls, highest, hlc3, lowest, rma, highs, lows } from "../math";

export const RSI: IndicatorDefinition = {
  id: "builtin:rsi",
  name: "Relative Strength Index",
  category: "momentum",
  source: "builtin",
  params: [
    { key: "period", label: "Period", type: "number", default: 14, min: 2, max: 200, step: 1 },
  ],
  outputs: [
    { id: "rsi", label: "RSI", pane: "sub", type: "line", color: "#22d3ee" },
  ],
  compute: (candles, params) => {
    const period = Number(params.period);
    const c = closes(candles);
    const gains: number[] = new Array(c.length).fill(0);
    const losses: number[] = new Array(c.length).fill(0);
    for (let i = 1; i < c.length; i++) {
      const diff = c[i] - c[i - 1];
      gains[i] = diff > 0 ? diff : 0;
      losses[i] = diff < 0 ? -diff : 0;
    }
    const avgG = rma(gains, period);
    const avgL = rma(losses, period);
    const out = fillNulls(c.length);
    for (let i = 0; i < c.length; i++) {
      const g = avgG[i];
      const l = avgL[i];
      if (g == null || l == null) continue;
      out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    return { rsi: out };
  },
};

export const MACD: IndicatorDefinition = {
  id: "builtin:macd",
  name: "MACD",
  category: "momentum",
  source: "builtin",
  params: [
    { key: "fast", label: "Fast", type: "number", default: 12, min: 2, max: 200, step: 1 },
    { key: "slow", label: "Slow", type: "number", default: 26, min: 2, max: 400, step: 1 },
    { key: "signal", label: "Signal", type: "number", default: 9, min: 1, max: 100, step: 1 },
  ],
  outputs: [
    { id: "macd", label: "MACD", pane: "sub", type: "line", color: "#22d3ee" },
    { id: "signal", label: "Signal", pane: "sub", type: "line", color: "#f97316" },
    { id: "hist", label: "Histogram", pane: "sub", type: "histogram", color: "#9ca3af" },
  ],
  compute: (candles, params) => {
    const c = closes(candles);
    const fast = ema(c, Number(params.fast));
    const slow = ema(c, Number(params.slow));
    const macd = fillNulls(c.length);
    for (let i = 0; i < c.length; i++) {
      if (fast[i] != null && slow[i] != null) macd[i] = (fast[i] as number) - (slow[i] as number);
    }
    // signal = EMA of macd over period; we need to feed EMA only the defined region
    const macdNumeric: number[] = macd.map((v) => (v == null ? 0 : v));
    const firstDefined = macd.findIndex((v) => v != null);
    const signalRaw = ema(macdNumeric.slice(firstDefined === -1 ? 0 : firstDefined), Number(params.signal));
    const signal = fillNulls(c.length);
    if (firstDefined !== -1) {
      for (let i = 0; i < signalRaw.length; i++) signal[firstDefined + i] = signalRaw[i];
    }
    const hist = fillNulls(c.length);
    for (let i = 0; i < c.length; i++) {
      if (macd[i] != null && signal[i] != null) hist[i] = (macd[i] as number) - (signal[i] as number);
    }
    return { macd, signal, hist };
  },
};

export const STOCH: IndicatorDefinition = {
  id: "builtin:stoch",
  name: "Stochastic Oscillator",
  category: "momentum",
  source: "builtin",
  params: [
    { key: "k", label: "%K", type: "number", default: 14, min: 1, max: 200, step: 1 },
    { key: "d", label: "%D", type: "number", default: 3, min: 1, max: 100, step: 1 },
    { key: "smoothK", label: "Smooth K", type: "number", default: 3, min: 1, max: 100, step: 1 },
  ],
  outputs: [
    { id: "k", label: "%K", pane: "sub", type: "line", color: "#22d3ee" },
    { id: "d", label: "%D", pane: "sub", type: "line", color: "#f97316" },
  ],
  compute: (candles, params) => {
    const kPeriod = Number(params.k);
    const dPeriod = Number(params.d);
    const smoothK = Number(params.smoothK);
    const hi = highest(highs(candles), kPeriod);
    const lo = lowest(lows(candles), kPeriod);
    const c = closes(candles);
    const rawK = fillNulls(c.length);
    for (let i = 0; i < c.length; i++) {
      if (hi[i] == null || lo[i] == null) continue;
      const range = (hi[i] as number) - (lo[i] as number);
      rawK[i] = range === 0 ? 50 : ((c[i] - (lo[i] as number)) / range) * 100;
    }
    // smooth K
    const kNum: number[] = rawK.map((v) => (v == null ? 0 : v));
    const firstDef = rawK.findIndex((v) => v != null);
    const smK = ema(kNum.slice(firstDef === -1 ? 0 : firstDef), smoothK);
    const k = fillNulls(c.length);
    if (firstDef !== -1) for (let i = 0; i < smK.length; i++) k[firstDef + i] = smK[i];
    const kNumForD: number[] = k.map((v) => (v == null ? 0 : v));
    const firstK = k.findIndex((v) => v != null);
    const dRaw = ema(kNumForD.slice(firstK === -1 ? 0 : firstK), dPeriod);
    const d = fillNulls(c.length);
    if (firstK !== -1) for (let i = 0; i < dRaw.length; i++) d[firstK + i] = dRaw[i];
    return { k, d };
  },
};

export const CCI: IndicatorDefinition = {
  id: "builtin:cci",
  name: "Commodity Channel Index",
  category: "momentum",
  source: "builtin",
  params: [
    { key: "period", label: "Period", type: "number", default: 20, min: 2, max: 200, step: 1 },
  ],
  outputs: [
    { id: "cci", label: "CCI", pane: "sub", type: "line", color: "#22d3ee" },
  ],
  compute: (candles, params) => {
    const period = Number(params.period);
    const tp = hlc3(candles);
    const out = fillNulls(tp.length);
    for (let i = period - 1; i < tp.length; i++) {
      let mean = 0;
      for (let j = i - period + 1; j <= i; j++) mean += tp[j];
      mean /= period;
      let mad = 0;
      for (let j = i - period + 1; j <= i; j++) mad += Math.abs(tp[j] - mean);
      mad /= period;
      out[i] = mad === 0 ? 0 : (tp[i] - mean) / (0.015 * mad);
    }
    return { cci: out };
  },
};

export const ROC: IndicatorDefinition = {
  id: "builtin:roc",
  name: "Rate of Change",
  category: "momentum",
  source: "builtin",
  params: [
    { key: "period", label: "Period", type: "number", default: 12, min: 1, max: 200, step: 1 },
  ],
  outputs: [
    { id: "roc", label: "ROC", pane: "sub", type: "line", color: "#22d3ee" },
  ],
  compute: (candles, params) => {
    const period = Number(params.period);
    const c = closes(candles);
    const out = fillNulls(c.length);
    for (let i = period; i < c.length; i++) {
      const prev = c[i - period];
      if (prev === 0) continue;
      out[i] = ((c[i] - prev) / prev) * 100;
    }
    return { roc: out };
  },
};

export const WILLIAMS_R: IndicatorDefinition = {
  id: "builtin:williamsR",
  name: "Williams %R",
  category: "momentum",
  source: "builtin",
  params: [
    { key: "period", label: "Period", type: "number", default: 14, min: 2, max: 200, step: 1 },
  ],
  outputs: [
    { id: "wr", label: "%R", pane: "sub", type: "line", color: "#22d3ee" },
  ],
  compute: (candles, params) => {
    const period = Number(params.period);
    const hi = highest(highs(candles), period);
    const lo = lowest(lows(candles), period);
    const c = closes(candles);
    const out = fillNulls(c.length);
    for (let i = 0; i < c.length; i++) {
      if (hi[i] == null || lo[i] == null) continue;
      const range = (hi[i] as number) - (lo[i] as number);
      out[i] = range === 0 ? -50 : (((hi[i] as number) - c[i]) / range) * -100;
    }
    return { wr: out };
  },
};
