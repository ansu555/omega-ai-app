/**
 * Remote ATS agent adapters
 *
 * Each adapter has the same signature as the local `run*Agent` functions in
 * `lib/ats/agents/`, but instead of computing the result in-process it sends
 * the inputs to a remote AXL peer over MCP and re-emits any RunEvents that
 * the peer produced.
 *
 * The orchestrator can mix and match — e.g. run Regime + Signal + Graph
 * remotely while still computing Risk locally — without changing its public
 * shape (`OrchestratorInput` / `runOrchestrator` / SSE wire format).
 */
import type {
  AgentVote,
  CausalChainAnalysis,
  DataBundle,
  NewsBundle,
  Regime,
  RiskSizing,
  RunEvent,
  TechnicalSignals,
} from '@/lib/ats/types'
import type { RegimeAgentResult } from '@/lib/ats/agents/regime-agent'
import type { SignalAgentResult } from '@/lib/ats/agents/signal-agent'
import type { GraphAgentResult } from '@/lib/ats/agents/graph-agent'
import type { RiskAgentResult } from '@/lib/ats/agents/risk-agent'
import { invokeRemoteAgent } from '@/lib/axl/client'
import type { AgentInvokeResponse, AxlAgentRole } from '@/lib/axl/types'

// ── Shared helpers ───────────────────────────────────────────────────────────

function ts(): string {
  return new Date().toISOString()
}

/**
 * Re-emit RunEvents returned by a peer through the orchestrator's emit fn.
 * Stamps each event with the local `run_id` and tags `payload.axl` so the
 * UI can highlight events that crossed the AXL mesh.
 */
function replayEvents(
  envelope: AgentInvokeResponse,
  emit: (event: RunEvent) => void,
  run_id: string,
): void {
  for (const evt of envelope.events ?? []) {
    const payload = {
      ...(evt.payload ?? {}),
      axl: {
        peer_id: envelope.peer_id,
        role:    envelope.role,
      },
    }
    emit({ ...evt, run_id, payload })
  }
}

/**
 * Emit a uniform error event when a remote agent call fails. Returns the
 * fallback ABSTAIN vote that callers should use so consensus can still
 * proceed.
 */
function emitRemoteError(
  role: AxlAgentRole,
  envelope: AgentInvokeResponse,
  emit: (event: RunEvent) => void,
  run_id: string,
): AgentVote {
  const message = envelope.error ?? 'unknown remote error'
  emit({
    type: 'agent.done',
    run_id,
    ts: ts(),
    agent: role,
    message: `Remote ${role} agent failed over AXL: ${message}`,
    payload: {
      axl: { peer_id: envelope.peer_id, role, error: message },
    },
  })

  return {
    agent: role,
    vote: 'ABSTAIN',
    confidence: 0,
    rationale: `Remote ${role} agent unreachable over AXL (${message}); abstaining.`,
  }
}

// ── Tool argument types (must match scripts/axl-agent-service.ts) ────────────

export interface RegimeRemoteArgs {
  data: DataBundle
  news: NewsBundle
  userWallet?: string
  run_id: string
}

export interface SignalRemoteArgs {
  data: DataBundle
  news: NewsBundle
  regime: Regime
  userWallet?: string
  run_id: string
}

export interface GraphRemoteArgs {
  data: DataBundle
  regime: Regime
  userWallet?: string
  run_id: string
}

export interface RiskRemoteArgs {
  data: DataBundle
  votes: AgentVote[]
  technical: TechnicalSignals
  agentBalanceUSD?: number
  run_id: string
}

// ── Public adapters ──────────────────────────────────────────────────────────

const FALLBACK_REGIME: Regime = 'sideways'
const FALLBACK_CAUSAL: CausalChainAnalysis = {
  active_chains: [],
  net_directional_bias: 'neutral',
}
const FALLBACK_TECHNICAL: TechnicalSignals = {
  rsi_14: 50,
  macd_line: 0,
  macd_signal: 0,
  macd_histogram: 0,
  ema_20: 0,
  ema_50: 0,
  sma_200: 0,
  bollinger_upper: 0,
  bollinger_mid: 0,
  bollinger_lower: 0,
  atr_14: 0,
  trend: 'sideways',
}

export async function runRegimeAgentRemote(
  data: DataBundle,
  news: NewsBundle,
  userWallet: string | undefined,
  emit: (event: RunEvent) => void,
  run_id: string,
): Promise<RegimeAgentResult> {
  emit({
    type: 'agent.thinking',
    run_id,
    ts: ts(),
    agent: 'regime',
    message: `Dispatching regime classification for ${data.ticker} over AXL…`,
    payload: { axl: { role: 'regime', dispatch: true } },
  })

  const envelope = await invokeRemoteAgent<RegimeAgentResult, RegimeRemoteArgs>(
    'regime',
    { data, news, userWallet, run_id },
  )

  if (!envelope.ok || !envelope.result) {
    const vote = emitRemoteError('regime', envelope, emit, run_id)
    return { vote, regime: FALLBACK_REGIME, confidence: 0, volatility_30d: 0 }
  }

  replayEvents(envelope, emit, run_id)
  return envelope.result
}

export async function runSignalAgentRemote(
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
    ts: ts(),
    agent: 'signal',
    message: `Dispatching signal sub-modules for ${data.ticker} over AXL…`,
    payload: { axl: { role: 'signal', dispatch: true } },
  })

  const envelope = await invokeRemoteAgent<SignalAgentResult, SignalRemoteArgs>(
    'signal',
    { data, news, regime, userWallet, run_id },
  )

  if (!envelope.ok || !envelope.result) {
    const vote = emitRemoteError('signal', envelope, emit, run_id)
    return {
      vote,
      technical: FALLBACK_TECHNICAL,
      sentiment: { score: 0, sarcasm_probability: 0, dominant_theme: 'unavailable', sample_headlines: [] },
      causal: FALLBACK_CAUSAL,
      scores: { technical: 0, sentiment: 0, causal: 0, institutional: 0 },
    }
  }

  replayEvents(envelope, emit, run_id)
  return envelope.result
}

export async function runGraphAgentRemote(
  data: DataBundle,
  regime: Regime,
  userWallet: string | undefined,
  emit: (event: RunEvent) => void,
  run_id: string,
): Promise<GraphAgentResult> {
  emit({
    type: 'agent.thinking',
    run_id,
    ts: ts(),
    agent: 'graph',
    message: `Dispatching correlation graph analysis for ${data.ticker} over AXL…`,
    payload: { axl: { role: 'graph', dispatch: true } },
  })

  const envelope = await invokeRemoteAgent<GraphAgentResult, GraphRemoteArgs>(
    'graph',
    { data, regime, userWallet, run_id },
  )

  if (!envelope.ok || !envelope.result) {
    const vote = emitRemoteError('graph', envelope, emit, run_id)
    return { vote, btc_correlation: 0.6, insight: 'Graph agent unavailable over AXL.', correlations: {} }
  }

  replayEvents(envelope, emit, run_id)
  return envelope.result
}

export async function runRiskAgentRemote(
  data: DataBundle,
  votes: AgentVote[],
  technical: TechnicalSignals,
  agentBalanceUSD: number | undefined,
  emit: (event: RunEvent) => void,
  run_id: string,
): Promise<RiskAgentResult> {
  emit({
    type: 'agent.thinking',
    run_id,
    ts: ts(),
    agent: 'risk',
    message: `Dispatching Kelly sizing and veto checks over AXL…`,
    payload: { axl: { role: 'risk', dispatch: true } },
  })

  const envelope = await invokeRemoteAgent<RiskAgentResult, RiskRemoteArgs>(
    'risk',
    { data, votes, technical, agentBalanceUSD, run_id },
  )

  if (!envelope.ok || !envelope.result) {
    const vote = emitRemoteError('risk', envelope, emit, run_id)
    const fallbackSizing: RiskSizing = {
      kelly_fraction: 0,
      size_usd: 0,
      max_loss_usd: 0,
      veto_triggered: true,
      veto_reason: vote.rationale,
    }
    return { vote: { ...vote, vetoed: true }, sizing: fallbackSizing }
  }

  replayEvents(envelope, emit, run_id)
  return envelope.result
}
