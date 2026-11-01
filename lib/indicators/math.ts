import type { OHLCVCandle } from "@/types/agent-builder-canvas";

export type Series = (number | null)[];

export function fillNulls(len: number): Series {
  return new Array(len).fill(null);
}

export function sma(values: number[], period: number): Series {
  const out = fillNulls(values.length);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): Series {
  const out = fillNulls(values.length);
  if (period <= 0 || values.length === 0) return out;
  const k = 2 / (period + 1);
  let prev: number | null = null;
  let seed = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      seed += values[i];
      continue;
    }
    if (i === period - 1) {
      seed += values[i];
      prev = seed / period;
      out[i] = prev;
      continue;
    }
    prev = values[i] * k + (prev as number) * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function rma(values: number[], period: number): Series {
  // Wilder smoothing
  const out = fillNulls(values.length);
  if (period <= 0 || values.length === 0) return out;
  let prev: number | null = null;
  let seed = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      seed += values[i];
      continue;
    }
    if (i === period - 1) {
      seed += values[i];
      prev = seed / period;
      out[i] = prev;
      continue;
    }
    prev = ((prev as number) * (period - 1) + values[i]) / period;
    out[i] = prev;
  }
  return out;
}

export function stddev(values: number[], period: number, meanSeries: Series): Series {
  const out = fillNulls(values.length);
  for (let i = period - 1; i < values.length; i++) {
    const m = meanSeries[i];
    if (m == null) continue;
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sq += (values[j] - m) ** 2;
    }
    out[i] = Math.sqrt(sq / period);
  }
  return out;
}

export function highest(values: number[], period: number): Series {
  const out = fillNulls(values.length);
  for (let i = period - 1; i < values.length; i++) {
    let h = -Infinity;
    for (let j = i - period + 1; j <= i; j++) if (values[j] > h) h = values[j];
    out[i] = h;
  }
  return out;
}

export function lowest(values: number[], period: number): Series {
  const out = fillNulls(values.length);
  for (let i = period - 1; i < values.length; i++) {
    let l = Infinity;
    for (let j = i - period + 1; j <= i; j++) if (values[j] < l) l = values[j];
    out[i] = l;
  }
  return out;
}

export function trueRange(candles: OHLCVCandle[]): number[] {
  const out: number[] = new Array(candles.length).fill(0);
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (i === 0) {
      out[i] = c.high - c.low;
      continue;
    }
    const prev = candles[i - 1];
    out[i] = Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close),
    );
  }
  return out;
}

export const closes = (c: OHLCVCandle[]) => c.map((x) => x.close);
export const highs = (c: OHLCVCandle[]) => c.map((x) => x.high);
export const lows = (c: OHLCVCandle[]) => c.map((x) => x.low);
export const volumes = (c: OHLCVCandle[]) => c.map((x) => x.volume);
export const hl2 = (c: OHLCVCandle[]) => c.map((x) => (x.high + x.low) / 2);
export const hlc3 = (c: OHLCVCandle[]) => c.map((x) => (x.high + x.low + x.close) / 3);
export const ohlc4 = (c: OHLCVCandle[]) =>
  c.map((x) => (x.open + x.high + x.low + x.close) / 4);
