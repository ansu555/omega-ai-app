import type { IndicatorDefinition } from "../types";
import {
  fillNulls,
  highest,
  highs,
  lows,
  lowest,
  rma,
  trueRange,
} from "../math";

export const ADX: IndicatorDefinition = {
  id: "builtin:adx",
  name: "Average Directional Index",
  category: "trend",
  source: "builtin",
  params: [
    { key: "period", label: "Period", type: "number", default: 14, min: 2, max: 100, step: 1 },
  ],
  outputs: [
    { id: "adx", label: "ADX", pane: "sub", type: "line", color: "#fbbf24" },
    { id: "plusDI", label: "+DI", pane: "sub", type: "line", color: "#22c55e" },
    { id: "minusDI", label: "-DI", pane: "sub", type: "line", color: "#ef4444" },
  ],
  compute: (candles, params) => {
    const period = Number(params.period);
    const tr = trueRange(candles);
    const plusDM: number[] = new Array(candles.length).fill(0);
    const minusDM: number[] = new Array(candles.length).fill(0);
    for (let i = 1; i < candles.length; i++) {
      const upMove = candles[i].high - candles[i - 1].high;
      const downMove = candles[i - 1].low - candles[i].low;
      plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
      minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    }
    const trS = rma(tr, period);
    const plusS = rma(plusDM, period);
    const minusS = rma(minusDM, period);
    const plusDI = fillNulls(candles.length);
    const minusDI = fillNulls(candles.length);
    const dx: number[] = new Array(candles.length).fill(0);
    for (let i = 0; i < candles.length; i++) {
      if (trS[i] != null && plusS[i] != null && minusS[i] != null && (trS[i] as number) > 0) {
        const pdi = ((plusS[i] as number) / (trS[i] as number)) * 100;
        const mdi = ((minusS[i] as number) / (trS[i] as number)) * 100;
        plusDI[i] = pdi;
        minusDI[i] = mdi;
        dx[i] = pdi + mdi === 0 ? 0 : (Math.abs(pdi - mdi) / (pdi + mdi)) * 100;
      }
    }
    const adx = rma(dx, period);
    return { adx, plusDI, minusDI };
  },
};

export const AROON: IndicatorDefinition = {
  id: "builtin:aroon",
  name: "Aroon",
  category: "trend",
  source: "builtin",
  params: [
    { key: "period", label: "Period", type: "number", default: 14, min: 2, max: 200, step: 1 },
  ],
  outputs: [
    { id: "up", label: "Aroon Up", pane: "sub", type: "line", color: "#22c55e" },
    { id: "down", label: "Aroon Down", pane: "sub", type: "line", color: "#ef4444" },
  ],
  compute: (candles, params) => {
    const period = Number(params.period);
    const h = highs(candles);
    const l = lows(candles);
    const up = fillNulls(candles.length);
    const down = fillNulls(candles.length);
    for (let i = period; i < candles.length; i++) {
      let hi = -Infinity;
      let lo = Infinity;
      let hiIdx = 0;
      let loIdx = 0;
      for (let j = i - period; j <= i; j++) {
        if (h[j] >= hi) {
          hi = h[j];
          hiIdx = j;
        }
        if (l[j] <= lo) {
          lo = l[j];
          loIdx = j;
        }
      }
      up[i] = ((period - (i - hiIdx)) / period) * 100;
      down[i] = ((period - (i - loIdx)) / period) * 100;
    }
    return { up, down };
  },
};

export const PSAR: IndicatorDefinition = {
  id: "builtin:psar",
  name: "Parabolic SAR",
  category: "trend",
  source: "builtin",
  params: [
    { key: "step", label: "Step", type: "number", default: 0.02, min: 0.001, max: 1, step: 0.001 },
    { key: "max", label: "Max", type: "number", default: 0.2, min: 0.01, max: 1, step: 0.01 },
  ],
  outputs: [
    { id: "psar", label: "PSAR", pane: "overlay", type: "line", color: "#f97316" },
  ],
  compute: (candles, params) => {
    const step = Number(params.step);
    const max = Number(params.max);
    const out = fillNulls(candles.length);
    if (candles.length < 2) return { psar: out };
    let isLong = candles[1].close > candles[0].close;
    let af = step;
    let ep = isLong ? candles[0].high : candles[0].low;
    let psar = isLong ? candles[0].low : candles[0].high;
    out[0] = psar;
    for (let i = 1; i < candles.length; i++) {
      psar = psar + af * (ep - psar);
      const c = candles[i];
      if (isLong) {
        if (c.low < psar) {
          isLong = false;
          psar = ep;
          ep = c.low;
          af = step;
        } else {
          if (c.high > ep) {
            ep = c.high;
            af = Math.min(af + step, max);
          }
          psar = Math.min(psar, candles[i - 1].low, i >= 2 ? candles[i - 2].low : candles[i - 1].low);
        }
      } else {
        if (c.high > psar) {
          isLong = true;
          psar = ep;
          ep = c.high;
          af = step;
        } else {
          if (c.low < ep) {
            ep = c.low;
            af = Math.min(af + step, max);
          }
          psar = Math.max(psar, candles[i - 1].high, i >= 2 ? candles[i - 2].high : candles[i - 1].high);
        }
      }
      out[i] = psar;
    }
    return { psar: out };
  },
};

export const SUPERTREND: IndicatorDefinition = {
  id: "builtin:supertrend",
  name: "Supertrend",
  category: "trend",
  source: "builtin",
  params: [
    { key: "period", label: "Period", type: "number", default: 10, min: 2, max: 100, step: 1 },
    { key: "mult", label: "Multiplier", type: "number", default: 3, min: 0.1, max: 20, step: 0.1 },
  ],
  outputs: [
    { id: "supertrend", label: "Supertrend", pane: "overlay", type: "line", color: "#22c55e" },
  ],
  compute: (candles, params) => {
    const period = Number(params.period);
    const mult = Number(params.mult);
    const tr = trueRange(candles);
    const atr = rma(tr, period);
    const out = fillNulls(candles.length);
    let trendUp = true;
    let prevSt = 0;
    for (let i = 0; i < candles.length; i++) {
      if (atr[i] == null) continue;
      const hl2 = (candles[i].high + candles[i].low) / 2;
      const upper = hl2 + mult * (atr[i] as number);
      const lower = hl2 - mult * (atr[i] as number);
      if (i === 0 || prevSt === 0) {
        trendUp = candles[i].close > hl2;
        prevSt = trendUp ? lower : upper;
      } else {
        if (trendUp) {
          if (candles[i].close < prevSt) {
            trendUp = false;
            prevSt = upper;
          } else {
            prevSt = Math.max(prevSt, lower);
          }
        } else {
          if (candles[i].close > prevSt) {
            trendUp = true;
            prevSt = lower;
          } else {
            prevSt = Math.min(prevSt, upper);
          }
        }
      }
      out[i] = prevSt;
    }
    return { supertrend: out };
  },
};

export const ICHIMOKU: IndicatorDefinition = {
  id: "builtin:ichimoku",
  name: "Ichimoku Cloud",
  category: "trend",
  source: "builtin",
  params: [
    { key: "tenkan", label: "Tenkan", type: "number", default: 9, min: 1, max: 100, step: 1 },
    { key: "kijun", label: "Kijun", type: "number", default: 26, min: 1, max: 200, step: 1 },
    { key: "senkou", label: "Senkou B", type: "number", default: 52, min: 1, max: 400, step: 1 },
  ],
  outputs: [
    { id: "tenkan", label: "Tenkan", pane: "overlay", type: "line", color: "#22d3ee" },
    { id: "kijun", label: "Kijun", pane: "overlay", type: "line", color: "#f97316" },
    { id: "senkouA", label: "Senkou A", pane: "overlay", type: "line", color: "#22c55e" },
    { id: "senkouB", label: "Senkou B", pane: "overlay", type: "line", color: "#ef4444" },
  ],
  compute: (candles, params) => {
    const tp = Number(params.tenkan);
    const kp = Number(params.kijun);
    const sp = Number(params.senkou);
    const h = highs(candles);
    const l = lows(candles);
    const tenkan = avg(highest(h, tp), lowest(l, tp));
    const kijun = avg(highest(h, kp), lowest(l, kp));
    const senkouA = avg(tenkan, kijun);
    const senkouB = avg(highest(h, sp), lowest(l, sp));
    return { tenkan, kijun, senkouA, senkouB };
  },
};

function avg(a: (number | null)[], b: (number | null)[]): (number | null)[] {
  const out = fillNulls(a.length);
  for (let i = 0; i < a.length; i++) {
    if (a[i] != null && b[i] != null) out[i] = ((a[i] as number) + (b[i] as number)) / 2;
  }
  return out;
}
