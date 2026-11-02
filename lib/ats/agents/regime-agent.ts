/**
 * ATS Regime Agent — HMM-lite market regime classifier.
 *
 * Classifies the current market regime from price data using a two-step
 * approach:
 *   1. Rules engine — derives a regime label from 30-day volatility, 7-day
 *      price slope, RSI, and volume trend (no API cost, deterministic).
 *   2. LLM validation — passes the rules-based classification plus recent
 *      headlines to the LLM to confirm or correct the label.
 *
 * Emits:
 *   agent.thinking     — start of classification
 *   regime.classified  — regime label + confidence
 */

import type {
  RunEvent,
  DataBundle,
  NewsBundle,
  Regime,
  AgentVote,
} from '@/lib/ats/types'
import { computeTechnicalSignals } from '@/lib/ats/indicators'
import { callLLMJson } from '@/lib/ats/llm'

// ── Result type ───────────────────────────────────────────────────────────────

export interface RegimeAgentResult {
  vote: AgentVote
  regime: Regime
  confidence: number
  /** Annualised 30-day daily-return standard deviation (0-1 fraction) */
  volatility_30d: number
}

// ── Pure math helpers ─────────────────────────────────────────────────────────

function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

/** Normalised slope of values: (last - first) / first — avoids units. */
function normalisedSlope(prices: number[]): number {
  if (prices.length < 2) return 0
  const first = prices[0]
  return first === 0 ? 0 : (prices[prices.length - 1] - first) / first
}

// ── Rules-based classifier ────────────────────────────────────────────────────

const HIGH_VOL_THRESHOLD = 0.035  // 3.5% daily std dev
const LOW_VOL_THRESHOLD = 0.018   // 1.8%

function rulesClassify(
  rsi14: number,
  slope7d: number,
  vol30d: number,
  volumeRatio7d: number,  // avg(7d volume) / avg(30d volume)
): { regime: Regime; confidence: number } {
  const isHighVol = vol30d >= HIGH_VOL_THRESHOLD
  const isLowVol = vol30d < LOW_VOL_THRESHOLD
  const isBullish = slope7d > 0.01
  const isBearish = slope7d < -0.01
  const isSideways = !isBullish && !isBearish

  // Accumulation: price stabilising after a decline, increasing volume
  if (rsi14 < 38 && slope7d > -0.02 && volumeRatio7d > 1.15) {
    return { regime: 'accumulation', confidence: 0.62 }
  }

  // Distribution: price near highs, volume declining or declining on rallies
  if (rsi14 > 62 && slope7d < 0.02 && volumeRatio7d > 1.10) {
    return { regime: 'distribution', confidence: 0.62 }
  }

  // Sideways
  if (isSideways && isLowVol) {
    return { regime: 'sideways', confidence: 0.72 }
  }

  // Bull regimes
  if (isBullish) {
    return isHighVol
      ? { regime: 'bull_volatile', confidence: 0.68 }
      : { regime: 'bull_trending', confidence: 0.74 }
  }

  // Bear regimes
  if (isBearish) {
    return isHighVol
      ? { regime: 'bear_volatile', confidence: 0.68 }
      : { regime: 'bear_trending', confidence: 0.72 }
  }

  // Fallback sideways
  return { regime: 'sideways', confidence: 0.58 }
}

// ── LLM validation ────────────────────────────────────────────────────────────

interface LLMRegimeResponse {
  regime: Regime
  confidence: number
  rationale: string
}

const VALID_REGIMES: Regime[] = [
  'bull_trending', 'bull_volatile', 'bear_trending',
  'bear_volatile', 'sideways', 'accumulation', 'distribution',
]

async function llmValidateRegime(
  ticker: string,
  price: number,
  priceChange24h: number,
  vol30d: number,
  rsi14: number,
  slope7d: number,
  rulesRegime: Regime,
  rulesConfidence: number,
  newsHeadlines: string[],
  userWallet?: string,
): Promise<LLMRegimeResponse> {
  const headlines = newsHeadlines.slice(0, 8).join('\n- ')

  const messages = [
    {
      role: 'system' as const,
      content:
        'You are a quantitative market regime classifier for crypto assets. ' +
        'Respond only with valid JSON matching the requested schema.',
    },
    {
      role: 'user' as const,
      content: `Classify the market regime for ${ticker.toUpperCase()} based on the data below.

PRICE DATA:
- Current price: $${price.toLocaleString()}
- 24h change: ${priceChange24h.toFixed(2)}%
- 30-day daily volatility (std dev of returns): ${(vol30d * 100).toFixed(2)}%
- 7-day normalised price slope: ${(slope7d * 100).toFixed(2)}%
- RSI(14): ${rsi14.toFixed(1)}

RULES-BASED CLASSIFICATION: ${rulesRegime} (confidence ${rulesConfidence.toFixed(2)})

RECENT NEWS HEADLINES:
- ${headlines || 'No recent news available.'}

Validate or correct the regime classification. Respond with:
{"regime":"<one of: bull_trending|bull_volatile|bear_trending|bear_volatile|sideways|accumulation|distribution>","confidence":<0.0-1.0>,"rationale":"<1-2 sentences>"}`,
    },
  ]

  try {
    const result = await callLLMJson<LLMRegimeResponse>({
      messages,
      userWallet,
      temperature: 0.2,
      maxTokens: 200,
    })

    if (!VALID_REGIMES.includes(result.regime)) {
      return { regime: rulesRegime, confidence: rulesConfidence, rationale: 'LLM returned invalid regime; using rules-based result.' }
    }

    return {
      regime: result.regime,
      confidence: Math.min(Math.max(result.confidence ?? rulesConfidence, 0), 1),
      rationale: result.rationale ?? '',
    }
  } catch {
    return {
      regime: rulesRegime,
      confidence: rulesConfidence,
      rationale: 'LLM unavailable; using rules-based regime classification.',
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Classifies the market regime for the asset described in `data`.
 * Also provides an AgentVote based on whether the regime is bullish/bearish.
 */
export async function runRegimeAgent(
  data: DataBundle,
  news: NewsBundle,
  userWallet: string | undefined,
  emit: (event: RunEvent) => void,
  run_id: string,
): Promise<RegimeAgentResult> {
  emit({
    type: 'agent.thinking',
    run_id,
    ts: new Date().toISOString(),
    agent: 'regime',
    message: `Classifying market regime for ${data.ticker}…`,
  })

  // Compute daily returns from candles_daily (last 30)
  const dailyCandles = data.candles_daily.slice(-31)
  const closes = dailyCandles.map((c) => c.close)
  const returns30d: number[] = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) {
      returns30d.push((closes[i] - closes[i - 1]) / closes[i - 1])
    }
  }

  const vol30d = stdDev(returns30d)

  // 7-day slope from candles (use last 7 closing prices)
  const last7 = closes.slice(-7)
  const slope7d = normalisedSlope(last7)

  // Volume ratio: avg 7d volume / avg 30d volume
  const volumes30d = dailyCandles.map((c) => c.volume).filter((v) => v > 0)
  const volumes7d = volumes30d.slice(-7)
  const avgVol30d = volumes30d.length > 0
    ? volumes30d.reduce((a, b) => a + b, 0) / volumes30d.length
    : 0
  const avgVol7d = volumes7d.length > 0
    ? volumes7d.reduce((a, b) => a + b, 0) / volumes7d.length
    : 0
  const volumeRatio7d = avgVol30d > 0 ? avgVol7d / avgVol30d : 1.0

  // Technical signals for RSI
  const tech = computeTechnicalSignals(
    dailyCandles.length > 0 ? dailyCandles : data.candles_hourly,
  )
  const rsi14 = tech.rsi_14

  // Rules classification
  const { regime: rulesRegime, confidence: rulesConf } = rulesClassify(
    rsi14, slope7d, vol30d, volumeRatio7d,
  )

  // LLM validation
  const headlines = news.items.slice(0, 8).map((i) => i.title)
  const llmResult = await llmValidateRegime(
    data.ticker, data.current_price, data.price_change_24h,
    vol30d, rsi14, slope7d, rulesRegime, rulesConf,
    headlines, userWallet,
  )

  const { regime, confidence, rationale } = llmResult

  // Derive a vote from the regime
  const bullishRegimes: Regime[] = ['bull_trending', 'bull_volatile', 'accumulation']
  const bearishRegimes: Regime[] = ['bear_trending', 'bear_volatile', 'distribution']
  const vote: AgentVote['vote'] = bullishRegimes.includes(regime)
    ? 'BUY'
    : bearishRegimes.includes(regime)
      ? 'SELL'
      : 'HOLD'

  const agentVote: AgentVote = {
    agent: 'regime',
    vote,
    confidence,
    rationale: rationale || `Market regime classified as ${regime}.`,
  }

  emit({
    type: 'regime.classified',
    run_id,
    ts: new Date().toISOString(),
    agent: 'regime',
    message: `Regime: ${regime} · confidence ${(confidence * 100).toFixed(0)}% · vote ${vote}`,
    payload: {
      regime,
      confidence,
      vote,
      rationale,
      vol30d: parseFloat(vol30d.toFixed(4)),
      slope7d: parseFloat(slope7d.toFixed(4)),
      rsi14: parseFloat(rsi14.toFixed(1)),
      volume_ratio_7d: parseFloat(volumeRatio7d.toFixed(2)),
    },
  })

  emit({
    type: 'agent.done',
    run_id,
    ts: new Date().toISOString(),
    agent: 'regime',
    message: `Regime agent complete: ${regime}`,
  })

  return { vote: agentVote, regime, confidence, volatility_30d: vol30d }
}
