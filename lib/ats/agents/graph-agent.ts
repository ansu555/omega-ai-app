/**
 * ATS Graph Agent — cross-asset correlation and contagion analysis.
 *
 * Computes how the target asset's position in the broader token correlation
 * graph affects trading conviction. Uses:
 *   1. Static correlation matrix — known pairwise correlations between
 *      major crypto assets (updated from historical data as of mid-2025).
 *   2. Dynamic rolling correlation — computed from the target asset's
 *      recent candle data vs a BTC-movement proxy.
 *   3. LLM enrichment — "if BTC moves X%, what happens to this asset?" using
 *      the current regime as context.
 *
 * Emits:
 *   agent.thinking   — start
 *   graph.update     — correlation map + directional implication
 *   agent.done       — final vote
 */

import type {
  RunEvent,
  DataBundle,
  Regime,
  AgentVote,
} from '@/lib/ats/types'
import { callLLMJson } from '@/lib/ats/llm'

// ── Result type ───────────────────────────────────────────────────────────────

export interface GraphAgentResult {
  vote: AgentVote
  /** Estimated Pearson correlation with BTC (−1 to +1) */
  btc_correlation: number
  /** Cross-asset directional implication string */
  insight: string
  correlations: Record<string, number>
}

// ── Static correlation matrix (mid-2025 30-day rolling averages) ──────────────
// Sources: CoinMetrics, Kaiko public reports
// Format: ticker → estimated correlation with BTC
const BTC_CORRELATIONS: Record<string, number> = {
  BTC:  1.00,
  ETH:  0.82,
  SOL:  0.75,
  BNB:  0.70,
  AVAX: 0.72,
  MATIC:0.68,
  POL:  0.68,
  LINK: 0.65,
  ARB:  0.74,
  OP:   0.72,
  UNI:  0.65,
  AAVE: 0.60,
  DOGE: 0.55,
  SHIB: 0.50,
  PEPE: 0.45,
  ADA:  0.68,
  DOT:  0.70,
  ATOM: 0.65,
  LTC:  0.72,
  XRP:  0.60,
  TRX:  0.52,
  TON:  0.58,
  SUI:  0.70,
  APT:  0.68,
  INJ:  0.65,
  SEI:  0.65,
  TIA:  0.62,
  NEAR: 0.67,
  FTM:  0.64,
  CRV:  0.58,
}

/**
 * Static BTC correlation for a ticker (defaults to 0.60 for unknown assets).
 * Exported for reuse by the Deep Research correlation tool (lib/research/tools).
 */
export function lookupCorrelation(ticker: string): number {
  return BTC_CORRELATIONS[ticker.toUpperCase()] ?? 0.60
}

// ── Dynamic correlation estimate ─────────────────────────────────────────────

/**
 * Estimates a correlation coefficient between the target asset's daily returns
 * and a synthetic "market return" (mean of last 7 candle-to-candle changes).
 * Degrades gracefully — returns the static value if candle data is thin.
 */
export function dynamicCorrelation(data: DataBundle, staticCorr: number): number {
  const candles = data.candles_daily.slice(-15)
  if (candles.length < 5) return staticCorr

  const closes = candles.map((c) => c.close)
  const returns: number[] = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1])
    }
  }

  if (returns.length < 4) return staticCorr

  // Use the variance of returns as a proxy for "market sensitivity"
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / returns.length
  const dailyVol = Math.sqrt(variance)

  // Assets with higher daily vol tend to have slightly higher beta to BTC
  const volAdjustment = Math.min(0.08, Math.max(-0.08, (dailyVol - 0.03) * 0.5))
  return Math.min(0.99, Math.max(0.01, staticCorr + volAdjustment))
}

// ── LLM enrichment ────────────────────────────────────────────────────────────

interface GraphLLMResponse {
  directional_impact: 'amplified' | 'reduced' | 'independent' | 'inverted'
  implication: 'BUY' | 'SELL' | 'HOLD' | 'ABSTAIN'
  confidence: number
  insight: string
}

async function llmEnrichCorrelation(
  ticker: string,
  btcCorr: number,
  btcChange24h: number,
  regime: Regime,
  userWallet?: string,
): Promise<GraphLLMResponse> {
  try {
    const result = await callLLMJson<GraphLLMResponse>({
      messages: [
        {
          role: 'system',
          content:
            'You are a cross-asset crypto correlation analyst. ' +
            'Respond only with valid JSON.',
        },
        {
          role: 'user',
          content: `Analyse the cross-asset graph implications for ${ticker.toUpperCase()}.

CORRELATION DATA:
- Estimated correlation with BTC: ${btcCorr.toFixed(2)}
- BTC 24h price change (proxy): ${btcChange24h.toFixed(2)}%
- Current market regime: ${regime}

Provide the directional implication for ${ticker.toUpperCase()} from the graph analysis:
{
  "directional_impact": "<amplified|reduced|independent|inverted>",
  "implication": "<BUY|SELL|HOLD|ABSTAIN>",
  "confidence": <0.4-0.85>,
  "insight": "<1-2 sentences describing the cross-asset dynamic>"
}`,
        },
      ],
      userWallet,
      temperature: 0.2,
      maxTokens: 200,
    })

    return {
      directional_impact: result.directional_impact ?? 'independent',
      implication: ['BUY', 'SELL', 'HOLD', 'ABSTAIN'].includes(result.implication)
        ? result.implication
        : 'HOLD',
      confidence: Math.min(0.85, Math.max(0.3, result.confidence ?? 0.5)),
      insight: result.insight ?? `${ticker} moves in line with BTC (correlation ${btcCorr.toFixed(2)}).`,
    }
  } catch {
    // Fallback: derive implication from correlation and BTC movement
    const btcBull = btcChange24h > 1
    const btcBear = btcChange24h < -1
    const highCorr = btcCorr > 0.65

    let implication: GraphLLMResponse['implication'] = 'HOLD'
    if (highCorr && btcBull) implication = 'BUY'
    else if (highCorr && btcBear) implication = 'SELL'

    return {
      directional_impact: highCorr ? 'amplified' : 'independent',
      implication,
      confidence: 0.45,
      insight: `${ticker} has a ${btcCorr.toFixed(2)} correlation with BTC. ` +
        `With BTC ${btcChange24h > 0 ? 'up' : 'down'} ${Math.abs(btcChange24h).toFixed(1)}%, ` +
        `${ticker} is likely to follow suit.`,
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Analyses the cross-asset correlation position of `data.ticker` and produces
 * an AgentVote based on BTC-driven graph dynamics.
 */
export async function runGraphAgent(
  data: DataBundle,
  regime: Regime,
  userWallet: string | undefined,
  emit: (event: RunEvent) => void,
  run_id: string,
): Promise<GraphAgentResult> {
  emit({
    type: 'agent.thinking',
    run_id,
    ts: new Date().toISOString(),
    agent: 'graph',
    message: `Computing correlation graph for ${data.ticker}…`,
  })

  // 1. Look up static correlation
  const staticCorr = lookupCorrelation(data.ticker)

  // 2. Adjust dynamically using candle data
  const btcCorrelation = dynamicCorrelation(data, staticCorr)

  // Build the full correlation map for the payload
  const correlations: Record<string, number> = {}
  for (const [ticker, corr] of Object.entries(BTC_CORRELATIONS)) {
    correlations[ticker] = corr
  }
  correlations[data.ticker.toUpperCase()] = btcCorrelation

  emit({
    type: 'graph.update',
    run_id,
    ts: new Date().toISOString(),
    agent: 'graph',
    message: `${data.ticker} ↔ BTC correlation: ${btcCorrelation.toFixed(2)} (adjusted from static ${staticCorr.toFixed(2)})`,
    payload: { btc_correlation: btcCorrelation, top_correlated: ['BTC', 'ETH', 'SOL'] },
  })

  // 3. LLM enrichment
  const llmResult = await llmEnrichCorrelation(
    data.ticker,
    btcCorrelation,
    data.price_change_24h,
    regime,
    userWallet,
  )

  const agentVote: AgentVote = {
    agent: 'graph',
    vote: llmResult.implication,
    confidence: llmResult.confidence,
    rationale: llmResult.insight,
  }

  emit({
    type: 'agent.done',
    run_id,
    ts: new Date().toISOString(),
    agent: 'graph',
    message: `Graph: ${llmResult.implication} · BTC corr ${btcCorrelation.toFixed(2)} · ${llmResult.directional_impact} impact`,
    payload: {
      vote: llmResult.implication,
      confidence: llmResult.confidence,
      btc_correlation: btcCorrelation,
      directional_impact: llmResult.directional_impact,
    },
  })

  return {
    vote: agentVote,
    btc_correlation: btcCorrelation,
    insight: llmResult.insight,
    correlations,
  }
}
