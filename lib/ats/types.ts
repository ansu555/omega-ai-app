/**
 * ATS Core Types
 *
 * Shared types used across the ATS orchestrator, agents, SSE streaming,
 * and Decision Receipt storage (doc § 3.1).
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

/** Market regime labels determined by the Regime Agent */
export type Regime =
  | 'bull_trending'
  | 'bull_volatile'
  | 'bear_trending'
  | 'bear_volatile'
  | 'sideways'
  | 'accumulation'
  | 'distribution'

/** User trading mode from user_settings */
export type Mode = 'autonomous' | 'assisted' | 'solo'

/** Decision the orchestrator can reach after consensus */
export type Decision = 'BUY' | 'SELL' | 'HOLD' | 'VETO'

/** The six ATS agent names + orchestrator */
export type AgentName =
  | 'data'
  | 'regime'
  | 'signal'
  | 'graph'
  | 'risk'
  | 'execution'
  | 'orchestrator'

// ── Agent Votes ───────────────────────────────────────────────────────────────

/** A single agent's vote in the consensus round */
export interface AgentVote {
  agent: AgentName
  vote: 'BUY' | 'SELL' | 'HOLD' | 'ABSTAIN'
  confidence: number // 0–1
  rationale: string
  /** Whether this agent exercised an absolute veto */
  vetoed?: boolean
}

// ── Risk Sizing ───────────────────────────────────────────────────────────────

export interface RiskSizing {
  /** Fractional Kelly position size (0–1) */
  kelly_fraction: number
  /** Dollar value to trade */
  size_usd: number
  /** Maximum acceptable dollar loss on this trade */
  max_loss_usd: number
  /** True if the Risk Agent triggered a hard veto */
  veto_triggered: boolean
  /** Which hard rule was breached (when veto_triggered is true) */
  veto_reason?: string
}

// ── Causal Chain ──────────────────────────────────────────────────────────────

/** A single entry from lib/ats/causal-chains.json */
export interface CausalChainEntry {
  id: string
  name: string
  description: string
  trigger_condition: string
  expected_impact: 'positive' | 'negative' | 'neutral'
  affected_assets: string[]
  typical_duration_hours: number
  historical_reliability: number // 0–1
}

/** Causal chain analysis produced by the Signal Agent */
export interface CausalChainAnalysis {
  active_chains: Array<{
    chain: CausalChainEntry
    /** LLM-validated probability this chain is currently active */
    active_probability: number
    supporting_evidence: string
  }>
  net_directional_bias: 'bullish' | 'bearish' | 'neutral'
}

// ── Consensus ─────────────────────────────────────────────────────────────────

export interface Consensus {
  decision: Decision
  confidence: number
  rationale: string
  /** Agent names that voted in favour of the decision */
  approved_by: AgentName[]
  /** Agent names that voted against or were vetoed */
  vetoed_by: AgentName[]
}

export interface ResearchBriefEvidenceItem {
  title: string
  source: string
  url: string
  published_at: string
  summary: string
}

export interface ResearchBriefAgentFinding {
  agent: AgentName
  label: string
  summary: string
  vote?: AgentVote['vote']
  confidence?: number | null
}

export interface ResearchBriefExecution {
  mode: Mode
  status: 'ready' | 'approval_required' | 'submitted' | 'blocked' | 'not_applicable'
  summary: string
  chain_id: number
  tx_hash?: string | null
}

export interface ResearchBrief {
  verdict: Decision
  worth_it: 'yes' | 'no' | 'watch'
  headline: string
  summary: string
  conviction_label: 'high' | 'medium' | 'low'
  confidence: number
  suggested_allocation_usd: number
  max_loss_usd: number
  allocation_note: string
  thesis: string[]
  counter_points: string[]
  risk_flags: string[]
  execution: ResearchBriefExecution
  agent_findings: ResearchBriefAgentFinding[]
  evidence: ResearchBriefEvidenceItem[]
}

// ── Decision Receipt (doc § 3.1) ──────────────────────────────────────────────

export interface DecisionReceipt {
  id?: string
  run_id: string
  user_wallet: string
  ticker: string
  /** ISO timestamp */
  created_at?: string

  // Trigger metadata
  trigger_type: 'user_query' | 'scheduled' | 'alert'
  query?: string

  // Chain info
  chain_id: number
  tx_hash?: string | null
  storage_root_hash?: string | null

  // ATS structured fields
  agent_votes: AgentVote[]
  regime: Regime
  causal_chain: CausalChainAnalysis
  risk_sizing: RiskSizing
  consensus: Consensus
  research_brief?: ResearchBrief | null

  /** Stub for future 0G Compute sealed-inference proof reference */
  proof_ref?: string | null
}

// ── SSE Run Events ────────────────────────────────────────────────────────────

/** Event types emitted by the orchestrator via SSE */
export type RunEventType =
  | 'run.start'
  | 'intake.parsed'     // Deep Research: free-form query understood (lib/research/intake)
  | 'clarify.needed'    // Deep Research: intake wants clarification before proceeding
  | 'plan.created'      // Deep Research: lead researcher published its plan (lib/research/lead)
  | 'subagent.spawned'  // Deep Research: a specialist subagent started (lib/research/subagent-runtime)
  | 'subagent.progress' // Deep Research: subagent reasoning/step update
  | 'tool.called'       // Deep Research: a research tool was invoked
  | 'evidence.found'    // Deep Research: a tool produced normalised evidence
  | 'round.evaluated'   // Deep Research: evaluation gate verdict after a round (lib/research/lead)
  | 'synthesis.draft'   // Deep Research: lead began composing the final document
  | 'citation.attached' // Deep Research: citation pass mapped claims → evidence (lib/research/citation)
  | 'report.done'       // Deep Research: full ResearchReport composed (payload.report)
  | 'agent.thinking'
  | 'agent.done'
  | 'agent.vetoed'
  | 'agent.data'        // Data Agent published its bundle
  | 'regime.classified' // Regime Agent emits regime label
  | 'signal.update'     // Signal Agent emits an intermediate signal
  | 'graph.update'      // Graph Agent emits a correlation update
  | 'risk.sizing'       // Risk Agent emits sizing output
  | 'consensus.reached' // Orchestrator finished voting round
  | 'execution.pending' // Execution Agent about to sign tx
  | 'execution.done'    // Tx submitted
  | 'run.done'          // Full run complete (receipt attached)
  | 'run.error'         // Fatal error

/** A single SSE event emitted by the ATS orchestrator */
export interface RunEvent {
  type: RunEventType
  run_id: string
  /** Wall-clock ISO timestamp */
  ts: string
  /** Agent responsible (when applicable) */
  agent?: AgentName
  /** Human-readable status message for the chat UI */
  message?: string
  /** Arbitrary structured payload (agent-specific) */
  payload?: Record<string, unknown>
  /** Attached when type === 'run.done' */
  receipt?: DecisionReceipt
  /**
   * Monotonic per-run sequence number, assigned by the Deep Research run
   * manager (lib/research/run-manager) for durable, replayable streaming.
   * Absent on legacy ATS events that are not persisted. The client tracks the
   * highest seq seen so a reconnect can resume from `?afterSeq=`.
   */
  seq?: number
}

// ── OHLCV Candle ─────────────────────────────────────────────────────────────

/** OHLCV candle */
export interface Candle {
  time: number // Unix timestamp (seconds)
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// ── Data Bundle ───────────────────────────────────────────────────────────────

/** Enriched price bundle produced by the Data Agent */
export interface DataBundle {
  ticker: string
  coingecko_id: string
  current_price: number
  market_cap: number
  volume_24h: number
  price_change_24h: number
  candles_daily: Candle[]   // up to 90 daily candles
  candles_hourly: Candle[]  // up to ~42 four-hour candles (7 days)
  quality_score: number     // 0–1 combined data quality score
  fetched_at: string        // ISO timestamp
}

// ── News Bundle ───────────────────────────────────────────────────────────────

export interface NewsItem {
  title: string
  description: string
  url: string
  source: string
  published_at: string // ISO timestamp
  /** Tagged ticker symbols found in headline / description */
  tickers: string[]
}

export interface NewsBundle {
  items: NewsItem[]
  fetched_at: string
}

// ── Signal Bundle ─────────────────────────────────────────────────────────────

export interface TechnicalSignals {
  rsi_14: number
  macd_line: number
  macd_signal: number
  macd_histogram: number
  ema_20: number
  ema_50: number
  sma_200: number
  bollinger_upper: number
  bollinger_mid: number
  bollinger_lower: number
  atr_14: number
  trend: 'up' | 'down' | 'sideways'
}

export interface SentimentScore {
  /** -1 (very bearish) to +1 (very bullish) */
  score: number
  sarcasm_probability: number
  dominant_theme: string
  sample_headlines: string[]
}
