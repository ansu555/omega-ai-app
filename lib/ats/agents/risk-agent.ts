/**
 * ATS Risk Agent — Kelly position sizing + hard veto rules.
 *
 * Applies a fractional Kelly criterion to compute position size, then checks
 * every hard rule from the ATS risk framework. Any rule breach triggers an
 * absolute VETO that blocks the execution agent.
 *
 * Kelly formula:
 *   f* = (p·b − (1−p)) / b          full Kelly fraction
 *   f  = KELLY_FRACTION · f*         fractional (conservative) Kelly
 *   size_usd = f · portfolio_value
 *
 * where:
 *   p  = estimated win probability (from combined agent confidence)
 *   b  = expected profit/risk ratio (ATR-derived target / stop)
 *
 * Hard veto rules (doc § 8.2):
 *   1. Data quality < DATA_QUALITY_MIN
 *   2. Combined agent confidence < MIN_CONFIDENCE
 *   3. 30-day drawdown > MAX_DRAWDOWN_PCT
 *   4. Kelly fraction ≤ 0 (negative edge)
 *   5. Insufficient agent wallet balance (< MIN_TRADE_USD)
 *   6. All votes are HOLD/ABSTAIN (no directional consensus)
 *
 * Emits:
 *   agent.thinking   — start
 *   risk.sizing      — sizing output + veto flag
 *   agent.done       — final vote
 */

import type { RunEvent, DataBundle, AgentVote, RiskSizing, TechnicalSignals } from '@/lib/ats/types'

// ── Result type ───────────────────────────────────────────────────────────────

export interface RiskAgentResult {
  vote: AgentVote
  sizing: RiskSizing
}

// ── Risk constants ────────────────────────────────────────────────────────────

const KELLY_FRACTION       = 0.25   // fractional Kelly multiplier (conservative)
const MAX_KELLY_PCT        = 0.20   // hard cap: 20% of portfolio
const DEFAULT_PORTFOLIO    = 1000   // USD — conservative assumption when unknown
const MIN_TRADE_USD        = 5      // minimum viable trade size
const DATA_QUALITY_MIN     = 0.25   // below this → veto
const MIN_CONFIDENCE       = 0.30   // below this → veto
const MAX_DRAWDOWN_PCT     = 0.50   // 50% 30d drawdown → veto
const ATR_REWARD_MULT      = 1.5    // reward target = 1.5 × ATR
const ATR_RISK_MULT        = 1.0    // stop loss = 1.0 × ATR

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Compute 30-day peak-to-trough drawdown from daily candles */
function compute30dDrawdown(data: DataBundle): number {
  const closes = data.candles_daily.slice(-30).map((c) => c.close)
  if (closes.length < 2) return 0
  let peak = closes[0]
  let maxDD = 0
  for (const c of closes) {
    if (c > peak) peak = c
    const dd = peak > 0 ? (peak - c) / peak : 0
    if (dd > maxDD) maxDD = dd
  }
  return maxDD
}

/** Compute win probability from an array of agent votes */
function estimateWinProb(votes: AgentVote[], direction: 'BUY' | 'SELL'): number {
  const relevant = votes.filter((v) => v.vote === direction)
  if (relevant.length === 0) return 0.5
  const avgConf = relevant.reduce((s, v) => s + v.confidence, 0) / relevant.length
  // Scale from confidence space (0.5-1.0) to probability (0.5-0.85)
  return 0.50 + avgConf * 0.35
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Runs the risk sizing model and applies hard veto rules.
 *
 * @param data        DataBundle from the Data Agent
 * @param votes       AgentVotes collected from Regime, Signal, and Graph agents
 * @param technical   TechnicalSignals from the Signal Agent (for ATR)
 * @param agentBalanceUSD  Estimated agent wallet USD balance (optional)
 */
export async function runRiskAgent(
  data: DataBundle,
  votes: AgentVote[],
  technical: TechnicalSignals,
  agentBalanceUSD: number = DEFAULT_PORTFOLIO,
  emit: (event: RunEvent) => void,
  run_id: string,
): Promise<RiskAgentResult> {
  emit({
    type: 'agent.thinking',
    run_id,
    ts: new Date().toISOString(),
    agent: 'risk',
    message: `Computing Kelly sizing and checking veto rules…`,
  })

  // ── Determine directional consensus from prior votes ─────────────────────
  const buyCount  = votes.filter((v) => v.vote === 'BUY').length
  const sellCount = votes.filter((v) => v.vote === 'SELL').length
  const holdCount = votes.filter((v) => v.vote === 'HOLD' || v.vote === 'ABSTAIN').length
  const totalVotes = votes.length

  const direction: 'BUY' | 'SELL' | null =
    buyCount > sellCount && buyCount > holdCount ? 'BUY' :
    sellCount > buyCount && sellCount > holdCount ? 'SELL' :
    null

  // ── Hard rule: all votes are HOLD ────────────────────────────────────────
  if (!direction) {
    const sizing: RiskSizing = {
      kelly_fraction: 0,
      size_usd: 0,
      max_loss_usd: 0,
      veto_triggered: true,
      veto_reason: `No directional consensus: ${buyCount} BUY, ${sellCount} SELL, ${holdCount} HOLD/ABSTAIN`,
    }

    const vote: AgentVote = {
      agent: 'risk',
      vote: 'HOLD',
      confidence: 0.8,
      rationale: sizing.veto_reason ?? 'No consensus.',
      vetoed: true,
    }

    emitRiskDone(emit, run_id, sizing, vote)
    return { vote, sizing }
  }

  // ── Hard rule 1: Data quality ─────────────────────────────────────────────
  if (data.quality_score < DATA_QUALITY_MIN) {
    const reason = `Data quality too low (${data.quality_score.toFixed(2)} < ${DATA_QUALITY_MIN}). Cannot make a reliable decision.`
    return buildVeto(reason, emit, run_id)
  }

  // ── Hard rule 2: Combined confidence ─────────────────────────────────────
  const avgConf = totalVotes > 0
    ? votes.reduce((s, v) => s + v.confidence, 0) / totalVotes
    : 0
  if (avgConf < MIN_CONFIDENCE) {
    return buildVeto(
      `Combined agent confidence too low (${(avgConf * 100).toFixed(0)}% < ${MIN_CONFIDENCE * 100}%).`,
      emit, run_id,
    )
  }

  // ── Hard rule 3: Extreme drawdown ─────────────────────────────────────────
  const drawdown30d = compute30dDrawdown(data)
  if (drawdown30d > MAX_DRAWDOWN_PCT) {
    return buildVeto(
      `Extreme 30-day drawdown of ${(drawdown30d * 100).toFixed(1)}% exceeds ${MAX_DRAWDOWN_PCT * 100}% maximum.`,
      emit, run_id,
    )
  }

  // ── Kelly sizing — use pre-computed ATR from Signal Agent's technical output ─
  const atr14 = technical.atr_14 > 0
    ? technical.atr_14
    : data.candles_daily.length > 1
      ? data.candles_daily.slice(-2).reduce((_, c) => c.high - c.low, 0)
      : data.current_price * 0.02   // 2% fallback
  const price = data.current_price

  // b = reward/risk ratio derived from ATR
  const reward = price > 0 && atr14 > 0 ? (atr14 * ATR_REWARD_MULT) / price : 0.02
  const risk   = price > 0 && atr14 > 0 ? (atr14 * ATR_RISK_MULT)   / price : 0.01
  const b = risk > 0 ? reward / risk : 1.5

  // p = win probability
  const p = estimateWinProb(votes, direction)

  // Full Kelly: f* = (p*b - (1-p)) / b
  const fullKelly = b > 0 ? (p * b - (1 - p)) / b : 0

  // ── Hard rule 4: Negative Kelly (no edge) ─────────────────────────────────
  if (fullKelly <= 0) {
    return buildVeto(
      `Kelly fraction is negative (${fullKelly.toFixed(3)}): insufficient edge for this trade.`,
      emit, run_id,
    )
  }

  // Apply fractional Kelly and hard cap
  const kellyFraction = Math.min(KELLY_FRACTION * fullKelly, MAX_KELLY_PCT)
  const portfolioValue = Math.max(agentBalanceUSD, DEFAULT_PORTFOLIO)
  const sizeUsd = Math.round(kellyFraction * portfolioValue * 100) / 100

  // ── Hard rule 5: Minimum trade size ───────────────────────────────────────
  if (sizeUsd < MIN_TRADE_USD) {
    return buildVeto(
      `Computed trade size $${sizeUsd.toFixed(2)} is below the minimum $${MIN_TRADE_USD}.`,
      emit, run_id,
    )
  }

  const maxLossUsd = Math.round(sizeUsd * risk * 100) / 100

  const sizing: RiskSizing = {
    kelly_fraction: parseFloat(kellyFraction.toFixed(4)),
    size_usd: sizeUsd,
    max_loss_usd: maxLossUsd,
    veto_triggered: false,
  }

  const rationale =
    `Kelly: p=${p.toFixed(2)} b=${b.toFixed(2)} → f*=${fullKelly.toFixed(3)} → ` +
    `fractional ${(kellyFraction * 100).toFixed(1)}% → $${sizeUsd} of ~$${portfolioValue.toFixed(0)} portfolio. ` +
    `Max loss: $${maxLossUsd} (ATR-based stop).`

  const vote: AgentVote = {
    agent: 'risk',
    vote: direction,
    confidence: Math.min(0.9, 0.5 + kellyFraction * 2),
    rationale,
  }

  emitRiskDone(emit, run_id, sizing, vote)
  return { vote, sizing }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildVeto(
  reason: string,
  emit: (event: RunEvent) => void,
  run_id: string,
): RiskAgentResult {
  const sizing: RiskSizing = {
    kelly_fraction: 0,
    size_usd: 0,
    max_loss_usd: 0,
    veto_triggered: true,
    veto_reason: reason,
  }

  const vote: AgentVote = {
    agent: 'risk',
    vote: 'HOLD',
    confidence: 0.9,
    rationale: reason,
    vetoed: true,
  }

  emitRiskDone(emit, run_id, sizing, vote)
  return { vote, sizing }
}

function emitRiskDone(
  emit: (event: RunEvent) => void,
  run_id: string,
  sizing: RiskSizing,
  vote: AgentVote,
): void {
  emit({
    type: 'risk.sizing',
    run_id,
    ts: new Date().toISOString(),
    agent: 'risk',
    message: sizing.veto_triggered
      ? `VETO: ${sizing.veto_reason}`
      : `Size: $${sizing.size_usd} · Kelly ${(sizing.kelly_fraction * 100).toFixed(1)}% · max loss $${sizing.max_loss_usd}`,
    payload: {
      veto_triggered: sizing.veto_triggered,
      veto_reason: sizing.veto_reason,
      kelly_fraction: sizing.kelly_fraction,
      size_usd: sizing.size_usd,
      max_loss_usd: sizing.max_loss_usd,
    },
  })

  emit({
    type: vote.vetoed ? 'agent.vetoed' : 'agent.done',
    run_id,
    ts: new Date().toISOString(),
    agent: 'risk',
    message: vote.vetoed ? `Risk agent VETOED: ${vote.rationale}` : `Risk agent: ${vote.vote}`,
    payload: {
      vote: vote.vote,
      confidence: vote.confidence,
      vetoed: vote.vetoed ?? false,
    },
  })
}
