/**
 * ATS Technical Indicators — pure-JS, no external dependencies
 *
 * All functions operate on plain number arrays (close prices) or Candle arrays.
 * They are designed to be called from server-side agent code and are safe to
 * tree-shake (no side-effects, no I/O).
 *
 * Exports:
 *   sma(closes, period)                         → number[] (aligned to end)
 *   ema(closes, period)                         → number[] (full length, 0-padded)
 *   smaLast / emaLast                           → single latest value
 *   rsi(closes, period?)                        → 0–100
 *   macd(closes, fast?, slow?, signal?)         → { line, signal, histogram }
 *   bollingerBands(closes, period?, stdMult?)   → { upper, mid, lower }
 *   atr(candles, period?)                       → number
 *   computeTechnicalSignals(candles)            → TechnicalSignals
 */

import type { Candle, TechnicalSignals } from '@/lib/ats/types'

// ── Simple Moving Average ──────────────────────────────────────────────────────

/**
 * Returns an array of SMA values, one per data point from index (period-1) onwards.
 * Length of result = closes.length - period + 1.
 */
export function sma(closes: number[], period: number): number[] {
  if (period <= 0 || closes.length < period) return []
  const result: number[] = []
  let sum = 0
  for (let i = 0; i < period; i++) sum += closes[i]
  result.push(sum / period)
  for (let i = period; i < closes.length; i++) {
    sum += closes[i] - closes[i - period]
    result.push(sum / period)
  }
  return result
}

/** Latest SMA value (or 0 if not enough data). */
export function smaLast(closes: number[], period: number): number {
  const arr = sma(closes, period)
  return arr[arr.length - 1] ?? 0
}

// ── Exponential Moving Average ────────────────────────────────────────────────

/**
 * Returns a full-length EMA array (same length as `closes`).
 * Values before the seed window are 0. Seeded with SMA of first `period` values.
 */
export function ema(closes: number[], period: number): number[] {
  const result = new Array<number>(closes.length).fill(0)
  if (period <= 0 || closes.length < period) return result

  // Seed with SMA
  let seed = 0
  for (let i = 0; i < period; i++) seed += closes[i]
  result[period - 1] = seed / period

  const k = 2 / (period + 1)
  for (let i = period; i < closes.length; i++) {
    result[i] = closes[i] * k + result[i - 1] * (1 - k)
  }
  return result
}

/** Latest EMA value (or 0 if not enough data). */
export function emaLast(closes: number[], period: number): number {
  const arr = ema(closes, period)
  return arr[arr.length - 1] ?? 0
}

// ── RSI ───────────────────────────────────────────────────────────────────────

/**
 * Wilder's Relative Strength Index.
 * Returns a value in [0, 100]; defaults to 50 when data is insufficient.
 */
export function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50

  let avgGain = 0
  let avgLoss = 0

  // Initial averages over the first `period` changes
  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1]
    if (delta > 0) avgGain += delta
    else avgLoss -= delta
  }
  avgGain /= period
  avgLoss /= period

  // Wilder's smoothing over remaining data points
  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1]
    const gain = Math.max(delta, 0)
    const loss = Math.max(-delta, 0)
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

// ── MACD ──────────────────────────────────────────────────────────────────────

export interface MACDResult {
  line: number
  signal: number
  histogram: number
}

/**
 * Standard MACD (12/26/9 by default).
 * Returns the latest line, signal, and histogram values.
 */
export function macd(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDResult {
  const fastEma = ema(closes, fastPeriod)
  const slowEma = ema(closes, slowPeriod)

  // Build MACD line starting from the point where both EMAs have warmed up
  const macdLine: number[] = []
  for (let i = slowPeriod - 1; i < closes.length; i++) {
    macdLine.push(fastEma[i] - slowEma[i])
  }

  const signalArr = ema(macdLine, signalPeriod)
  const lastLine = macdLine[macdLine.length - 1] ?? 0
  const lastSignal = signalArr[signalArr.length - 1] ?? 0

  return {
    line: lastLine,
    signal: lastSignal,
    histogram: lastLine - lastSignal,
  }
}

// ── Bollinger Bands ───────────────────────────────────────────────────────────

export interface BollingerResult {
  upper: number
  mid: number
  lower: number
}

/**
 * Standard Bollinger Bands (20-period SMA ± 2 standard deviations).
 */
export function bollingerBands(
  closes: number[],
  period = 20,
  stdMult = 2,
): BollingerResult {
  const lastPrice = closes[closes.length - 1] ?? 0
  if (closes.length < period) {
    return { upper: lastPrice, mid: lastPrice, lower: lastPrice }
  }

  const slice = closes.slice(-period)
  const mid = slice.reduce((a, b) => a + b, 0) / period
  const variance =
    slice.reduce((sum, v) => sum + Math.pow(v - mid, 2), 0) / period
  const std = Math.sqrt(variance)

  return {
    upper: mid + stdMult * std,
    mid,
    lower: mid - stdMult * std,
  }
}

// ── ATR ───────────────────────────────────────────────────────────────────────

/**
 * Wilder's Average True Range.
 * Returns 0 if fewer than 2 candles are provided.
 */
export function atr(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0

  const trueRanges: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const { high, low } = candles[i]
    const prevClose = candles[i - 1].close
    trueRanges.push(
      Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)),
    )
  }

  const p = Math.min(period, trueRanges.length)
  // Seed with simple average of first `p` true ranges
  let atrValue =
    trueRanges.slice(0, p).reduce((a, b) => a + b, 0) / p

  // Wilder smoothing
  for (let i = p; i < trueRanges.length; i++) {
    atrValue = (atrValue * (period - 1) + trueRanges[i]) / period
  }

  return atrValue
}

// ── Trend detection ───────────────────────────────────────────────────────────

function detectTrend(
  lastPrice: number,
  ema20: number,
  ema50: number,
): 'up' | 'down' | 'sideways' {
  if (lastPrice > ema20 && ema20 > ema50) return 'up'
  if (lastPrice < ema20 && ema20 < ema50) return 'down'
  return 'sideways'
}

// ── Full signal bundle ─────────────────────────────────────────────────────────

/**
 * Compute all technical signals from an array of OHLCV candles.
 *
 * For best accuracy:
 *   - SMA-200 requires ≥ 200 candles
 *   - MACD requires ≥ 35 candles (26 slow + 9 signal)
 *   - RSI-14 requires ≥ 15 candles
 *
 * The function degrades gracefully with fewer candles — indicators that cannot
 * be computed return 0 / the last close price.
 */
export function computeTechnicalSignals(candles: Candle[]): TechnicalSignals {
  const closes = candles.map((c) => c.close)
  const lastPrice = closes[closes.length - 1] ?? 0

  const ema20 = emaLast(closes, 20)
  const ema50 = emaLast(closes, 50)
  const sma200 = smaLast(closes, 200)
  const rsi14 = rsi(closes, 14)
  const macdResult = macd(closes)
  const bb = bollingerBands(closes, 20)
  const atr14 = atr(candles, 14)
  const trend = detectTrend(lastPrice, ema20, ema50)

  return {
    rsi_14: rsi14,
    macd_line: macdResult.line,
    macd_signal: macdResult.signal,
    macd_histogram: macdResult.histogram,
    ema_20: ema20,
    ema_50: ema50,
    sma_200: sma200,
    bollinger_upper: bb.upper,
    bollinger_mid: bb.mid,
    bollinger_lower: bb.lower,
    atr_14: atr14,
    trend,
  }
}
