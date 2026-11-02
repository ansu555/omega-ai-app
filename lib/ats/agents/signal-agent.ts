/**
 * ATS Signal Agent — multi-sub-module signal generator.
 *
 * Runs four sub-modules in parallel:
 *   1. Technical   — RSI, MACD, EMA crossovers, Bollinger Band position
 *   2. Sentiment   — LLM sentiment scoring of recent news headlines
 *   3. Causal      — LLM validation of active causal chains from the library
 *   4. Institutional — Volume/market-cap pattern analysis via LLM
 *
 * Each sub-module produces a score in [-1, +1] and a confidence. The final
 * AgentVote is a weighted combination (35/30/20/15 split).
 *
 * Emits:
 *   agent.thinking   — start
 *   signal.update    — intermediate result after each sub-module
 *   agent.done       — final combined vote
 */

import type {
  RunEvent,
  DataBundle,
  NewsBundle,
  Regime,
  AgentVote,
  TechnicalSignals,
  SentimentScore,
  CausalChainAnalysis,
  CausalChainEntry,
} from '@/lib/ats/types'
import { computeTechnicalSignals } from '@/lib/ats/indicators'
import { callLLMJson } from '@/lib/ats/llm'
import causalChainsRaw from '@/lib/ats/causal-chains.json'

const causalChains = causalChainsRaw as CausalChainEntry[]

// ── Result type ───────────────────────────────────────────────────────────────

export interface SignalAgentResult {
  vote: AgentVote
  technical: TechnicalSignals
  sentiment: SentimentScore
  causal: CausalChainAnalysis
  scores: {
    technical: number
    sentiment: number
    causal: number
    institutional: number
  }
}

// ── Sub-module weights ────────────────────────────────────────────────────────

const WEIGHTS = { technical: 0.35, sentiment: 0.30, causal: 0.20, institutional: 0.15 }

// ── 1. Technical sub-module ───────────────────────────────────────────────────

function scoreTechnical(tech: TechnicalSignals, currentPrice: number): number {
  let score = 0

  // RSI (range: −1 to +1)
  if (tech.rsi_14 < 30) score += 1.0
  else if (tech.rsi_14 < 45) score += 0.5
  else if (tech.rsi_14 > 70) score -= 1.0
  else if (tech.rsi_14 > 55) score -= 0.5

  // MACD histogram direction
  if (tech.macd_histogram > 0) score += 0.4
  else if (tech.macd_histogram < 0) score -= 0.4

  // EMA crossover: price vs EMA20 vs EMA50
  if (tech.ema_20 > 0 && tech.ema_50 > 0) {
    if (currentPrice > tech.ema_20 && tech.ema_20 > tech.ema_50) score += 0.4
    if (currentPrice < tech.ema_20 && tech.ema_20 < tech.ema_50) score -= 0.4
  }

  // Bollinger Band position
  if (tech.bollinger_lower > 0 && tech.bollinger_upper > 0) {
    const range = tech.bollinger_upper - tech.bollinger_lower
    if (range > 0) {
      const pos = (currentPrice - tech.bollinger_lower) / range
      if (pos < 0.1) score += 0.5   // near lower band: oversold
      if (pos > 0.9) score -= 0.5   // near upper band: overbought
    }
  }

  return Math.max(-1, Math.min(1, score / 2.3))
}

// ── 2. Sentiment sub-module (LLM) ─────────────────────────────────────────────

interface SentimentLLMResponse {
  score: number
  sarcasm_probability: number
  dominant_theme: string
  confidence: number
}

async function runSentimentSubmodule(
  ticker: string,
  news: NewsBundle,
  userWallet?: string,
): Promise<{ sentimentScore: SentimentScore; score: number }> {
  const items = news.items.slice(0, 12)
  if (items.length === 0) {
    return {
      sentimentScore: { score: 0, sarcasm_probability: 0, dominant_theme: 'no data', sample_headlines: [] },
      score: 0,
    }
  }

  const headlines = items.map((i) => `• ${i.title}`).join('\n')

  try {
    const result = await callLLMJson<SentimentLLMResponse>({
      messages: [
        {
          role: 'system',
          content:
            'You are a crypto news sentiment analyser trained on financial text. ' +
            'Mimic FinBERT-style scoring. Respond only with valid JSON.',
        },
        {
          role: 'user',
          content: `Analyse the sentiment of these recent news headlines for ${ticker.toUpperCase()}.

${headlines}

Respond with:
{
  "score": <number from -1.0 (very bearish) to +1.0 (very bullish)>,
  "sarcasm_probability": <0.0-1.0>,
  "dominant_theme": "<the main theme in 3-5 words>",
  "confidence": <0.0-1.0>
}`,
        },
      ],
      userWallet,
      temperature: 0.15,
      maxTokens: 200,
    })

    const score = Math.max(-1, Math.min(1, result.score ?? 0))
    return {
      sentimentScore: {
        score,
        sarcasm_probability: result.sarcasm_probability ?? 0,
        dominant_theme: result.dominant_theme ?? '',
        sample_headlines: items.slice(0, 3).map((i) => i.title),
      },
      score,
    }
  } catch {
    return {
      sentimentScore: {
        score: 0, sarcasm_probability: 0, dominant_theme: 'analysis unavailable',
        sample_headlines: items.slice(0, 3).map((i) => i.title),
      },
      score: 0,
    }
  }
}

// ── 3. Causal chain sub-module (LLM) ─────────────────────────────────────────

interface CausalChainLLMItem {
  id: string
  active_probability: number
  supporting_evidence: string
}

interface CausalChainLLMResponse {
  active_chains: CausalChainLLMItem[]
  net_directional_bias: 'bullish' | 'bearish' | 'neutral'
}

async function runCausalSubmodule(
  ticker: string,
  news: NewsBundle,
  userWallet?: string,
): Promise<{ analysis: CausalChainAnalysis; score: number }> {
  // Pre-filter: only consider chains that affect this ticker
  const relevantChains = causalChains.filter((chain) =>
    chain.affected_assets.includes(ticker.toUpperCase()) ||
    ticker.toUpperCase() === 'BTC'  // BTC affects all
      ? true
      : chain.affected_assets.some((a) => ['BTC', 'ETH'].includes(a)),
  ).slice(0, 10)  // cap at 10 for token budget

  if (relevantChains.length === 0 || news.items.length === 0) {
    return {
      analysis: { active_chains: [], net_directional_bias: 'neutral' },
      score: 0,
    }
  }

  const headlines = news.items.slice(0, 8).map((i) => i.title).join('\n')
  const chainSummary = relevantChains.map((c) =>
    `id="${c.id}" trigger="${c.trigger_condition}" impact=${c.expected_impact} reliability=${c.historical_reliability}`
  ).join('\n')

  try {
    const result = await callLLMJson<CausalChainLLMResponse>({
      messages: [
        {
          role: 'system',
          content:
            'You are a causal-chain analyst for crypto markets. ' +
            'Assess which known causal chains appear active based on current news. ' +
            'Respond only with valid JSON.',
        },
        {
          role: 'user',
          content: `Assess which of the following causal chains appear ACTIVE for ${ticker.toUpperCase()} based on the recent headlines.

CAUSAL CHAINS TO ASSESS:
${chainSummary}

RECENT HEADLINES:
${headlines}

Respond with:
{
  "active_chains": [
    { "id": "<chain_id>", "active_probability": <0.0-1.0>, "supporting_evidence": "<1 sentence>" }
  ],
  "net_directional_bias": "<bullish|bearish|neutral>"
}
Only include chains with active_probability > 0.3. Empty array is valid if none are active.`,
        },
      ],
      userWallet,
      temperature: 0.2,
      maxTokens: 500,
    })

    const activeChains = (result.active_chains ?? [])
      .filter((item: CausalChainLLMItem) => item.active_probability > 0.3)
      .map((item: CausalChainLLMItem) => {
        const chain = causalChains.find((c) => c.id === item.id)
        if (!chain) return null
        return {
          chain,
          active_probability: Math.min(1, Math.max(0, item.active_probability)),
          supporting_evidence: item.supporting_evidence ?? '',
        }
      })
      .filter(Boolean) as CausalChainAnalysis['active_chains']

    // Compute a net score from active chains
    let weightedScore = 0
    let totalWeight = 0
    for (const entry of activeChains) {
      const impact = entry.chain.expected_impact === 'positive' ? 1
        : entry.chain.expected_impact === 'negative' ? -1 : 0
      const weight = entry.active_probability * entry.chain.historical_reliability
      weightedScore += impact * weight
      totalWeight += weight
    }
    const netScore = totalWeight > 0 ? weightedScore / totalWeight : 0

    const bias = result.net_directional_bias ?? 'neutral'
    const validBias = ['bullish', 'bearish', 'neutral'].includes(bias) ? bias : 'neutral'

    return {
      analysis: {
        active_chains: activeChains,
        net_directional_bias: validBias as CausalChainAnalysis['net_directional_bias'],
      },
      score: Math.max(-1, Math.min(1, netScore)),
    }
  } catch {
    return { analysis: { active_chains: [], net_directional_bias: 'neutral' }, score: 0 }
  }
}

// ── 4. Institutional sub-module (LLM) ────────────────────────────────────────

async function runInstitutionalSubmodule(
  ticker: string,
  data: DataBundle,
  regime: Regime,
  userWallet?: string,
): Promise<{ score: number; rationale: string }> {
  const volumeRatioDesc =
    data.volume_24h > 0 && data.market_cap > 0
      ? `Volume/Market Cap ratio: ${((data.volume_24h / data.market_cap) * 100).toFixed(2)}%`
      : 'Volume data unavailable'

  try {
    const result = await callLLMJson<{ score: number; rationale: string }>({
      messages: [
        {
          role: 'system',
          content:
            'You are an institutional flow analyst for crypto. ' +
            'Respond only with valid JSON.',
        },
        {
          role: 'user',
          content: `Assess institutional signal for ${ticker.toUpperCase()}.

METRICS:
- Market Cap: $${(data.market_cap / 1e9).toFixed(2)}B
- 24h Volume: $${(data.volume_24h / 1e6).toFixed(0)}M
- ${volumeRatioDesc}
- 24h Price Change: ${data.price_change_24h.toFixed(2)}%
- Market Regime: ${regime}

Based on these metrics, assess the institutional trading signal:
{"score": <-1.0 to +1.0>, "rationale": "<1 sentence>"}
+1 = strong institutional accumulation, -1 = strong institutional distribution`,
        },
      ],
      userWallet,
      temperature: 0.2,
      maxTokens: 150,
    })

    return {
      score: Math.max(-1, Math.min(1, result.score ?? 0)),
      rationale: result.rationale ?? '',
    }
  } catch {
    return { score: 0, rationale: 'Institutional analysis unavailable.' }
  }
}

// ── Score → vote conversion ───────────────────────────────────────────────────

function scoreToVote(score: number): AgentVote['vote'] {
  if (score > 0.2) return 'BUY'
  if (score < -0.2) return 'SELL'
  return 'HOLD'
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Runs all four signal sub-modules in parallel and combines their outputs
 * into a single AgentVote with confidence.
 */
export async function runSignalAgent(
  data: DataBundle,
  news: NewsBundle,
  regime: Regime,
  userWallet: string | undefined,
  emit: (event: RunEvent) => void,
  run_id: string,
): Promise<SignalAgentResult> {
  emit({
    type: 'agent.thinking',
    run_id,
    ts: new Date().toISOString(),
    agent: 'signal',
    message: `Running technical, sentiment, causal, and institutional sub-modules for ${data.ticker}…`,
  })

  // Phase A: technical (synchronous, no LLM)
  const candles = data.candles_daily.length >= 14 ? data.candles_daily : data.candles_hourly
  const technical = computeTechnicalSignals(candles)
  const techScore = scoreTechnical(technical, data.current_price)

  emit({
    type: 'signal.update',
    run_id,
    ts: new Date().toISOString(),
    agent: 'signal',
    message: `Technical: RSI ${technical.rsi_14.toFixed(1)} · MACD ${technical.macd_histogram > 0 ? '+' : ''}${technical.macd_histogram.toFixed(4)} · trend ${technical.trend}`,
    payload: { submodule: 'technical', score: techScore },
  })

  // Phase B: LLM sub-modules in parallel
  const [sentimentResult, causalResult, institutionalResult] = await Promise.all([
    runSentimentSubmodule(data.ticker, news, userWallet),
    runCausalSubmodule(data.ticker, news, userWallet),
    runInstitutionalSubmodule(data.ticker, data, regime, userWallet),
  ])

  emit({
    type: 'signal.update',
    run_id,
    ts: new Date().toISOString(),
    agent: 'signal',
    message: `Sentiment: ${sentimentResult.sentimentScore.score.toFixed(2)} · Causal bias: ${causalResult.analysis.net_directional_bias} · Institutional: ${institutionalResult.score.toFixed(2)}`,
    payload: {
      submodule: 'llm',
      sentiment_score: sentimentResult.score,
      causal_score: causalResult.score,
      institutional_score: institutionalResult.score,
      active_causal_chains: causalResult.analysis.active_chains.length,
    },
  })

  // Weighted combination
  const combinedScore =
    techScore * WEIGHTS.technical +
    sentimentResult.score * WEIGHTS.sentiment +
    causalResult.score * WEIGHTS.causal +
    institutionalResult.score * WEIGHTS.institutional

  const vote = scoreToVote(combinedScore)
  const confidence = Math.min(0.95, 0.45 + Math.abs(combinedScore) * 0.5)

  // Build rationale
  const techLabel = techScore > 0.1 ? 'bullish' : techScore < -0.1 ? 'bearish' : 'neutral'
  const rationale =
    `Technical signals are ${techLabel} (RSI ${technical.rsi_14.toFixed(0)}); ` +
    `sentiment is ${sentimentResult.sentimentScore.dominant_theme || (sentimentResult.score > 0 ? 'positive' : 'negative')}; ` +
    `${causalResult.analysis.active_chains.length} active causal chains with ${causalResult.analysis.net_directional_bias} bias. ` +
    institutionalResult.rationale

  const agentVote: AgentVote = { agent: 'signal', vote, confidence, rationale }

  emit({
    type: 'agent.done',
    run_id,
    ts: new Date().toISOString(),
    agent: 'signal',
    message: `Signal: ${vote} (confidence ${(confidence * 100).toFixed(0)}%) · combined score ${combinedScore.toFixed(3)}`,
    payload: {
      vote,
      confidence,
      combined_score: combinedScore,
      scores: {
        technical: techScore,
        sentiment: sentimentResult.score,
        causal: causalResult.score,
        institutional: institutionalResult.score,
      },
    },
  })

  return {
    vote: agentVote,
    technical,
    sentiment: sentimentResult.sentimentScore,
    causal: causalResult.analysis,
    scores: {
      technical: techScore,
      sentiment: sentimentResult.score,
      causal: causalResult.score,
      institutional: institutionalResult.score,
    },
  }
}
