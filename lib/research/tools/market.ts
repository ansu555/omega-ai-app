/**
 * Deep Research — Market Intelligence tools (P1).
 *
 * Thin tool wrappers over the existing ATS data + indicator layer:
 *   • price_snapshot       → current price / market cap / 24h volume + change
 *   • ohlcv                → summarised candle stats over a window
 *   • technical_indicators → RSI / MACD / EMA / Bollinger / ATR / trend
 *
 * All three source from CoinGecko via `fetchPriceBundle` (CDN-cached through the
 * data layer's `next: { revalidate }`), so independent calls are cheap. Evidence
 * is tagged `market_data` (raw price facts) or `derived` (computed indicators).
 *
 * Server-only.
 */

import { fetchPriceBundle } from '@/lib/ats/data/prices'
import { computeTechnicalSignals } from '@/lib/ats/indicators'
import type { Candle, DataBundle } from '@/lib/ats/types'
import type { ResearchTool, ToolResult } from '@/lib/research/tools/types'
import { asUpperTicker, evidence, fail, ok, round } from '@/lib/research/tools/helpers'

const COINGECKO_PAGE = (id: string) => `https://www.coingecko.com/en/coins/${id}`

/** Shared loader — fails cleanly when the ticker has no usable price data. */
async function loadBundle(ticker: string): Promise<DataBundle | ToolResult> {
  if (!ticker) return fail('Missing required argument: ticker.')
  try {
    const bundle = await fetchPriceBundle(ticker)
    if (bundle.quality_score === 0 || bundle.current_price === 0) {
      return fail(`No price data found for "${ticker}" — check the symbol.`)
    }
    return bundle
  } catch (err) {
    return fail(err instanceof Error ? err.message : `Price fetch failed for ${ticker}.`)
  }
}

function isToolResult(v: DataBundle | ToolResult): v is ToolResult {
  return 'ok' in v
}

// ── price_snapshot ───────────────────────────────────────────────────────────

export const priceSnapshotTool: ResearchTool = {
  name: 'price_snapshot',
  description:
    'Get the current spot price, market capitalisation, 24h trading volume and ' +
    '24h price change for a crypto asset. Use for any "what is X trading at / how ' +
    'big is X" need. Returns authoritative market data.',
  trustTier: 'market_data',
  parameters: {
    type: 'object',
    properties: {
      ticker: { type: 'string', description: 'Asset symbol, e.g. BTC, ETH, WHSK.' },
    },
    required: ['ticker'],
    additionalProperties: false,
  },
  async execute(args, _ctx) {
    const ticker = asUpperTicker(args.ticker)
    const loaded = await loadBundle(ticker)
    if (isToolResult(loaded)) return loaded
    const b = loaded

    const url = COINGECKO_PAGE(b.coingecko_id)
    const summary =
      `${b.ticker}: $${b.current_price.toLocaleString()} ` +
      `(${b.price_change_24h >= 0 ? '+' : ''}${round(b.price_change_24h)}% 24h) · ` +
      `mcap $${round(b.market_cap / 1e9, 2)}B · vol $${round(b.volume_24h / 1e6, 1)}M.`

    return ok(summary, [
      evidence(
        `${b.ticker} spot price is $${b.current_price} (${round(b.price_change_24h)}% 24h).`,
        'CoinGecko',
        'market_data',
        {
          ticker: b.ticker,
          price_usd: b.current_price,
          market_cap_usd: b.market_cap,
          volume_24h_usd: b.volume_24h,
          price_change_24h_pct: b.price_change_24h,
          quality_score: b.quality_score,
        },
        url,
        b.fetched_at,
      ),
    ])
  },
}

// ── ohlcv ────────────────────────────────────────────────────────────────────

function summariseCandles(candles: Candle[]): {
  count: number
  high: number
  low: number
  first: number
  last: number
  changePct: number
  avgVolume: number
} {
  const closes = candles.map((c) => c.close).filter((n) => n > 0)
  const highs = candles.map((c) => c.high).filter((n) => n > 0)
  const lows = candles.map((c) => c.low).filter((n) => n > 0)
  const vols = candles.map((c) => c.volume).filter((n) => n > 0)
  const first = closes[0] ?? 0
  const last = closes[closes.length - 1] ?? 0
  return {
    count: candles.length,
    high: highs.length ? Math.max(...highs) : 0,
    low: lows.length ? Math.min(...lows) : 0,
    first,
    last,
    changePct: first > 0 ? round(((last - first) / first) * 100) : 0,
    avgVolume: vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : 0,
  }
}

export const ohlcvTool: ResearchTool = {
  name: 'ohlcv',
  description:
    'Get summarised OHLCV price-action stats for an asset over a window: window ' +
    'high/low, open→close change, and average volume. Use to judge trend, range ' +
    'and momentum rather than a single spot price.',
  trustTier: 'market_data',
  parameters: {
    type: 'object',
    properties: {
      ticker: { type: 'string', description: 'Asset symbol, e.g. BTC.' },
      timeframe: {
        type: 'string',
        enum: ['daily', 'intraday'],
        description: "Candle resolution: 'daily' (~90d) or 'intraday' (~7d). Default 'daily'.",
      },
    },
    required: ['ticker'],
    additionalProperties: false,
  },
  async execute(args, _ctx) {
    const ticker = asUpperTicker(args.ticker)
    const timeframe = args.timeframe === 'intraday' ? 'intraday' : 'daily'
    const loaded = await loadBundle(ticker)
    if (isToolResult(loaded)) return loaded
    const b = loaded

    const candles = timeframe === 'intraday' ? b.candles_hourly : b.candles_daily
    if (candles.length === 0) {
      return fail(`No ${timeframe} candles available for ${ticker}.`)
    }
    const s = summariseCandles(candles)
    const windowLabel = timeframe === 'intraday' ? '~7d' : '~90d'

    const summary =
      `${b.ticker} ${windowLabel} (${s.count} candles): ` +
      `${s.changePct >= 0 ? '+' : ''}${s.changePct}% open→close · ` +
      `range $${round(s.low)}–$${round(s.high)} · avg vol $${round(s.avgVolume / 1e6, 1)}M.`

    return ok(summary, [
      evidence(
        `${b.ticker} moved ${s.changePct}% over the ${windowLabel} window (range $${round(s.low)}–$${round(s.high)}).`,
        'CoinGecko',
        'market_data',
        {
          ticker: b.ticker,
          timeframe,
          candles: s.count,
          window_high: s.high,
          window_low: s.low,
          window_change_pct: s.changePct,
          avg_volume_usd: s.avgVolume,
          last_close: s.last,
        },
        COINGECKO_PAGE(b.coingecko_id),
        b.fetched_at,
      ),
    ])
  },
}

// ── technical_indicators ─────────────────────────────────────────────────────

export const technicalIndicatorsTool: ResearchTool = {
  name: 'technical_indicators',
  description:
    'Compute technical indicators (RSI(14), MACD, EMA20/50, SMA200, Bollinger ' +
    'Bands, ATR, trend) for an asset from its recent candles. Use to assess ' +
    'overbought/oversold, momentum and trend structure.',
  trustTier: 'derived',
  parameters: {
    type: 'object',
    properties: {
      ticker: { type: 'string', description: 'Asset symbol, e.g. ETH.' },
    },
    required: ['ticker'],
    additionalProperties: false,
  },
  async execute(args, _ctx) {
    const ticker = asUpperTicker(args.ticker)
    const loaded = await loadBundle(ticker)
    if (isToolResult(loaded)) return loaded
    const b = loaded

    const candles = b.candles_daily.length >= 14 ? b.candles_daily : b.candles_hourly
    if (candles.length < 2) {
      return fail(`Not enough candle history for ${ticker} to compute indicators.`)
    }
    const t = computeTechnicalSignals(candles)

    const rsiLabel = t.rsi_14 < 30 ? 'oversold' : t.rsi_14 > 70 ? 'overbought' : 'neutral'
    const summary =
      `${b.ticker} technicals: RSI ${round(t.rsi_14, 1)} (${rsiLabel}) · ` +
      `MACD hist ${t.macd_histogram >= 0 ? '+' : ''}${round(t.macd_histogram, 4)} · ` +
      `trend ${t.trend} · price ${b.current_price > t.ema_20 ? 'above' : 'below'} EMA20.`

    return ok(summary, [
      evidence(
        `${b.ticker} RSI(14) is ${round(t.rsi_14, 1)} (${rsiLabel}); MACD trend ${t.trend}.`,
        'ATS technical engine',
        'derived',
        {
          ticker: b.ticker,
          rsi_14: round(t.rsi_14, 2),
          macd_line: round(t.macd_line, 6),
          macd_signal: round(t.macd_signal, 6),
          macd_histogram: round(t.macd_histogram, 6),
          ema_20: round(t.ema_20, 6),
          ema_50: round(t.ema_50, 6),
          sma_200: round(t.sma_200, 6),
          bollinger_upper: round(t.bollinger_upper, 6),
          bollinger_lower: round(t.bollinger_lower, 6),
          atr_14: round(t.atr_14, 6),
          trend: t.trend,
          current_price: b.current_price,
        },
        COINGECKO_PAGE(b.coingecko_id),
        b.fetched_at,
      ),
    ])
  },
}
