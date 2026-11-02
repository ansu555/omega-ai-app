/**
 * ATS Data Layer — Price / OHLCV fetcher (CoinGecko)
 *
 * Exports:
 *   fetchPriceBundle(ticker) → DataBundle
 *     Fetches current price, market cap, 90-day daily OHLCV candles,
 *     and 7-day sub-daily candles. Attaches a combined quality score.
 *
 * CoinGecko candle resolution:
 *   /ohlc?days=7  → 4-hour candles (~42 points)
 *   /ohlc?days=90 → 4-hour candles (CoinGecko always returns 4h for ≤90 days)
 *
 * All fetch calls use Next.js `next: { revalidate }` so they are cached
 * at the CDN edge when invoked from server components / API routes.
 */

import type { Candle, DataBundle } from '@/lib/ats/types'

// ── Ticker → CoinGecko ID map ─────────────────────────────────────────────────

const TICKER_TO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  WBTC: 'bitcoin',
  HSK: 'hashkey-ecopoints',
  WHSK: 'hashkey-ecopoints',
  ETH: 'ethereum',
  WETH: 'ethereum',
  SOL: 'solana',
  AVAX: 'avalanche-2',
  BNB: 'binancecoin',
  MATIC: 'matic-network',
  POL: 'matic-network',
  LINK: 'chainlink',
  UNI: 'uniswap',
  AAVE: 'aave',
  ARB: 'arbitrum',
  OP: 'optimism',
  DOGE: 'dogecoin',
  ADA: 'cardano',
  DOT: 'polkadot',
  ATOM: 'cosmos',
  LTC: 'litecoin',
  XRP: 'ripple',
  SHIB: 'shiba-inu',
  PEPE: 'pepe',
  TRX: 'tron',
  TON: 'the-open-network',
  SUI: 'sui',
  APT: 'aptos',
  INJ: 'injective-protocol',
  SEI: 'sei-network',
  TIA: 'celestia',
  NEAR: 'near',
  FTM: 'fantom',
  CRV: 'curve-dao-token',
}

function resolveId(ticker: string): string {
  return TICKER_TO_ID[ticker.toUpperCase()] ?? ticker.toLowerCase()
}

// ── CoinGecko fetch helpers ───────────────────────────────────────────────────

function geckoHeaders(): HeadersInit {
  const headers: HeadersInit = { Accept: 'application/json' }
  const key = process.env.COINGECKO_API_KEY
  if (key) headers['x-cg-pro-api-key'] = key
  return headers
}

/**
 * Fetch OHLC candles from CoinGecko's /ohlc endpoint.
 * Returned format: [[timestamp_ms, open, high, low, close], ...]
 * Volume is not included; call mergeVolumes() afterwards if needed.
 */
async function fetchOHLC(coinId: string, days: number): Promise<Candle[]> {
  const url =
    `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc` +
    `?vs_currency=usd&days=${days}`

  const res = await fetch(url, {
    headers: geckoHeaders(),
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    throw new Error(`CoinGecko OHLC (${coinId}, days=${days}): HTTP ${res.status}`)
  }

  const raw: [number, number, number, number, number][] = await res.json()
  return raw.map(([ts, open, high, low, close]) => ({
    time: Math.floor(ts / 1000),
    open,
    high,
    low,
    close,
    volume: 0,
  }))
}

/**
 * Fetch daily prices + volumes from CoinGecko's /market_chart endpoint.
 * Used to supplement the OHLC candles with volume data.
 */
async function fetchMarketChart(
  coinId: string,
  days: number,
): Promise<{ prices: [number, number][]; total_volumes: [number, number][] }> {
  const url =
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart` +
    `?vs_currency=usd&days=${days}&interval=daily`

  const res = await fetch(url, {
    headers: geckoHeaders(),
    next: { revalidate: 600 },
  })

  if (!res.ok) {
    throw new Error(`CoinGecko market_chart (${coinId}): HTTP ${res.status}`)
  }

  return res.json()
}

/**
 * Fetch current coin detail (price, market cap, 24h volume, 24h change).
 */
async function fetchCoinDetail(coinId: string): Promise<{
  current_price: number
  market_cap: number
  volume_24h: number
  price_change_24h: number
}> {
  const url =
    `https://api.coingecko.com/api/v3/coins/${coinId}` +
    `?localization=false&tickers=false&community_data=false&developer_data=false`

  const res = await fetch(url, {
    headers: geckoHeaders(),
    next: { revalidate: 120 },
  })

  if (!res.ok) {
    throw new Error(`CoinGecko coin detail (${coinId}): HTTP ${res.status}`)
  }

  const data = await res.json()
  const md = data.market_data ?? {}
  return {
    current_price: md.current_price?.usd ?? 0,
    market_cap: md.market_cap?.usd ?? 0,
    volume_24h: md.total_volume?.usd ?? 0,
    price_change_24h: md.price_change_percentage_24h ?? 0,
  }
}

// ── Volume merge ──────────────────────────────────────────────────────────────

/**
 * Backfill volume into OHLC candles from market_chart volume array.
 * Matches by day bucket (candle.time / 86400).
 */
function mergeVolumes(
  candles: Candle[],
  volumes: [number, number][],
): Candle[] {
  const volMap = new Map<number, number>()
  for (const [ts, vol] of volumes) {
    volMap.set(Math.floor(ts / 1000 / 86400), vol)
  }
  return candles.map((c) => ({
    ...c,
    volume: volMap.get(Math.floor(c.time / 86400)) ?? 0,
  }))
}

// ── Quality scoring ───────────────────────────────────────────────────────────

function computeQualityScore(
  current: { current_price: number; market_cap: number; volume_24h: number },
  candlesDaily: Candle[],
  candlesHourly: Candle[],
): number {
  let score = 0

  if (current.current_price > 0) score += 0.25
  if (current.market_cap > 0) score += 0.10
  if (current.volume_24h >= 1_000_000) score += 0.15
  else if (current.volume_24h >= 100_000) score += 0.07

  // Daily candles completeness vs expected 90
  score += Math.min(candlesDaily.length / 90, 1) * 0.30

  // Hourly/4h candles completeness vs expected ~42
  score += Math.min(candlesHourly.length / 42, 1) * 0.20

  return Math.round(score * 100) / 100
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch a complete price/OHLCV bundle for a ticker symbol.
 *
 * Uses three CoinGecko endpoints in parallel:
 *   1. Coin detail — current price, market cap, 24h volume
 *   2. OHLC (90 days) — daily-ish candles for indicator calculation
 *   3. OHLC (7 days) — shorter-term candles
 *   4. Market chart (90 days, daily) — volume data merged into candles
 *
 * Individual failures are tolerated (empty arrays / zero values).
 */
export async function fetchPriceBundle(ticker: string): Promise<DataBundle> {
  const coinId = resolveId(ticker)

  const [detailResult, dailyResult, hourlyResult, chartResult] =
    await Promise.allSettled([
      fetchCoinDetail(coinId),
      fetchOHLC(coinId, 90),
      fetchOHLC(coinId, 7),
      fetchMarketChart(coinId, 90),
    ])

  const current =
    detailResult.status === 'fulfilled'
      ? detailResult.value
      : { current_price: 0, market_cap: 0, volume_24h: 0, price_change_24h: 0 }

  const rawDaily =
    dailyResult.status === 'fulfilled' ? dailyResult.value : []

  const candlesHourly =
    hourlyResult.status === 'fulfilled' ? hourlyResult.value : []

  const chart =
    chartResult.status === 'fulfilled'
      ? chartResult.value
      : { prices: [], total_volumes: [] }

  const candlesDaily = mergeVolumes(rawDaily, chart.total_volumes)

  const quality_score = computeQualityScore(current, candlesDaily, candlesHourly)

  return {
    ticker: ticker.toUpperCase(),
    coingecko_id: coinId,
    current_price: current.current_price,
    market_cap: current.market_cap,
    volume_24h: current.volume_24h,
    price_change_24h: current.price_change_24h,
    candles_daily: candlesDaily,
    candles_hourly: candlesHourly,
    quality_score,
    fetched_at: new Date().toISOString(),
  }
}
