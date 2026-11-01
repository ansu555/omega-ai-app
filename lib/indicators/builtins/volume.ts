import type { IndicatorDefinition } from "../types";
import { closes, fillNulls, hlc3, volumes } from "../math";

export const VWAP: IndicatorDefinition = {
  id: "builtin:vwap",
  name: "Volume Weighted Average Price",
  category: "volume",
  source: "builtin",
  params: [
    { key: "period", label: "Period (rolling)", type: "number", default: 20, min: 2, max: 500, step: 1 },
  ],
  outputs: [
    { id: "vwap", label: "VWAP", pane: "overlay", type: "line", color: "#f97316" },
  ],
  compute: (candles, params) => {
    const period = Number(params.period);
    const tp = hlc3(candles);
    const v = volumes(candles);
    const out = fillNulls(candles.length);
    for (let i = period - 1; i < candles.length; i++) {
      let pv = 0;
      let vv = 0;
      for (let j = i - period + 1; j <= i; j++) {
        pv += tp[j] * v[j];
        vv += v[j];
      }
      out[i] = vv === 0 ? null : pv / vv;
    }
    return { vwap: out };
  },
};

export const OBV: IndicatorDefinition = {
  id: "builtin:obv",
  name: "On-Balance Volume",
  category: "volume",
  source: "builtin",
  params: [],
  outputs: [
    { id: "obv", label: "OBV", pane: "sub", type: "line", color: "#22d3ee" },
  ],
  compute: (candles) => {
    const c = closes(candles);
    const v = volumes(candles);
    const out: (number | null)[] = new Array(candles.length).fill(0);
    for (let i = 1; i < candles.length; i++) {
      const prev = (out[i - 1] as number) ?? 0;
      if (c[i] > c[i - 1]) out[i] = prev + v[i];
      else if (c[i] < c[i - 1]) out[i] = prev - v[i];
      else out[i] = prev;
    }
    return { obv: out };
  },
};

export const CMF: IndicatorDefinition = {
  id: "builtin:cmf",
  name: "Chaikin Money Flow",
  category: "volume",
  source: "builtin",
  params: [
    { key: "period", label: "Period", type: "number", default: 20, min: 2, max: 200, step: 1 },
  ],
  outputs: [
    { id: "cmf", label: "CMF", pane: "sub", type: "line", color: "#22d3ee" },
  ],
  compute: (candles, params) => {
    const period = Number(params.period);
    const out = fillNulls(candles.length);
    const mf: number[] = new Array(candles.length).fill(0);
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const range = c.high - c.low;
      const mult = range === 0 ? 0 : ((c.close - c.low) - (c.high - c.close)) / range;
      mf[i] = mult * c.volume;
    }
    for (let i = period - 1; i < candles.length; i++) {
      let mfSum = 0;
      let vSum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        mfSum += mf[j];
        vSum += candles[j].volume;
      }
      out[i] = vSum === 0 ? 0 : mfSum / vSum;
    }
    return { cmf: out };
  },
};

export const MFI: IndicatorDefinition = {
  id: "builtin:mfi",
  name: "Money Flow Index",
  category: "volume",
  source: "builtin",
  params: [
    { key: "period", label: "Period", type: "number", default: 14, min: 2, max: 200, step: 1 },
  ],
  outputs: [
    { id: "mfi", label: "MFI", pane: "sub", type: "line", color: "#22d3ee" },
  ],
  compute: (candles, params) => {
    const period = Number(params.period);
    const tp = hlc3(candles);
    const v = volumes(candles);
    const pos: number[] = new Array(candles.length).fill(0);
    const neg: number[] = new Array(candles.length).fill(0);
    for (let i = 1; i < candles.length; i++) {
      const raw = tp[i] * v[i];
      if (tp[i] > tp[i - 1]) pos[i] = raw;
      else if (tp[i] < tp[i - 1]) neg[i] = raw;
    }
    const out = fillNulls(candles.length);
    for (let i = period; i < candles.length; i++) {
      let p = 0;
      let n = 0;
      for (let j = i - period + 1; j <= i; j++) {
        p += pos[j];
        n += neg[j];
      }
      out[i] = n === 0 ? 100 : 100 - 100 / (1 + p / n);
    }
    return { mfi: out };
  },
};

export const VWMA: IndicatorDefinition = {
  id: "builtin:vwma",
  name: "Volume Weighted Moving Average",
  category: "volume",
  source: "builtin",
  params: [
    { key: "period", label: "Period", type: "number", default: 20, min: 2, max: 200, step: 1 },
  ],
  outputs: [
    { id: "vwma", label: "VWMA", pane: "overlay", type: "line", color: "#f97316" },
  ],
  compute: (candles, params) => {
    const period = Number(params.period);
    const c = closes(candles);
    const v = volumes(candles);
    const out = fillNulls(candles.length);
    for (let i = period - 1; i < candles.length; i++) {
      let pv = 0;
      let vv = 0;
      for (let j = i - period + 1; j <= i; j++) {
        pv += c[j] * v[j];
        vv += v[j];
      }
      out[i] = vv === 0 ? null : pv / vv;
    }
    return { vwma: out };
  },
};
