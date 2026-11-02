/**
 * Deep Research — core types (P0: intake layer).
 *
 * This module holds the contracts produced by the intake/understanding stage
 * (`lib/research/intake.ts`) that replaces the old hardcoded regex gate. As the
 * system grows (lead planner → subagents → synthesis → citations) richer
 * artifacts (ResearchReport, FindingsReport, Evidence, …) will live here too.
 *
 * See the architecture blueprint for the full picture; only the intake contract
 * is realised in P0.
 */

/**
 * Coarse classification of what the user is actually asking for. Drives routing:
 * a single-asset deep dive drills through the existing ATS pipeline; everything
 * else is handled by the v2 research brain (a stub in P0).
 */
export type QueryType =
  | 'asset_deep_dive' // "is WHSK worth buying right now?"
  | 'allocation'      // "I have 50 USDC, where should I invest?"
  | 'market_overview' // "what's happening in the market?"
  | 'comparison'      // "compare WHSK vs ETH for a 3-month hold"
  | 'defi_yield'      // "best place to park stablecoins for yield?"
  | 'conceptual'      // open-ended / educational

export type RiskTolerance = 'low' | 'medium' | 'high'

/**
 * Structured understanding of a free-form query — the output of intake.
 *
 * Replaces the brittle "exactly one known ticker or 400" gate: every query now
 * produces a ResearchRequest, and the route decides where to send it.
 */
export interface ResearchRequest {
  /** Original free-text query, untouched. */
  query: string
  /** Classified intent. */
  queryType: QueryType
  /** Tickers mentioned/implied, normalised to canonical symbols (may be empty). */
  tokens: string[]
  /** Investable amount in USD when the user stated one. */
  amountUsd: number | null
  /** Holding/horizon expressed in free text (e.g. "3 months", "long term"). */
  horizon: string | null
  /** Risk tolerance when stated or confidently inferable. */
  riskTolerance: RiskTolerance | null
  /** Chain the user cares about (defaults to HashKey Chain when unstated). */
  chain: string | null
  /**
   * Explicit assumptions intake made in order to proceed without blocking on a
   * clarifying round-trip. Surfaced to the user for transparency.
   */
  assumptions: string[]
  /**
   * Up to 2 questions intake would ask to sharpen a decision-critical gap.
   * In P0 these are informational only (no clarify round-trip UI yet).
   */
  clarifyingQuestions: string[]
  /** True when intake judges clarification would materially improve the answer. */
  needsClarification: boolean
  /**
   * The single primary ticker when this is a single-asset deep dive over a token
   * the ATS can cover — the signal to route into the existing ATS pipeline.
   * Null for every other shape (allocation, comparison, market overview, …).
   */
  primaryTicker: string | null
  /** How the request was parsed: 'llm' (understood) or 'fallback' (regex). */
  source: 'llm' | 'fallback'
}

// ── Evidence & findings (P1: tool + subagent layer) ──────────────────────────
//
// Every tool normalises its output to `Evidence`, and every subagent returns a
// `FindingsReport` (claims + the evidence backing them + confidence + gaps). These
// are the shared contracts the lead planner (P2), hybrid retrieval (P3) and the
// citation/verification pass (P4) all build on. Pure data — no server imports —
// so they are safe to import from anywhere.

/**
 * Provenance tier of a piece of evidence, ordered most → least authoritative.
 * Drives ranking and the cross-verification policy (on-chain ground truth
 * confirms or refutes web/news narrative — see blueprint §6).
 */
export type TrustTier =
  | 'onchain'      // on-chain reads — ground truth (highest)
  | 'market_data'  // exchange/aggregator price & volume (e.g. CoinGecko)
  | 'derived'      // computed from raw data (indicators, ATS verdict)
  | 'news'         // editorial / RSS headlines
  | 'web'          // open web / social (P3, lowest external)
  | 'model'        // unsourced LLM assertion

/** A single normalised observation produced by a tool. */
export interface Evidence {
  /** One-line factual claim this evidence supports. */
  claim: string
  /** Human-readable origin, e.g. 'CoinGecko', 'ATS', 'CoinDesk'. */
  source: string
  /** Canonical URL when one exists (empty string otherwise). */
  url: string
  /** ISO timestamp the underlying data was observed/fetched. */
  timestamp: string
  /** Provenance tier for ranking + cross-verification. */
  trustTier: TrustTier
  /** Structured payload backing the claim (numbers, objects). */
  data: Record<string, unknown>
}

// ── Hybrid retrieval & cross-verification (P3) ───────────────────────────────
//
// The RetrievalOrchestrator (lib/research/retrieval.ts) normalises, dedupes and
// ranks Evidence from every source, then runs the cross-verification loop that
// is the crypto-specific moat (blueprint §6): web/news narrative is triangulated
// against on-chain / market ground truth, so no qualitative claim stands alone.

/** A single narrative claim after triangulation against ground-truth evidence. */
export interface VerifiedClaim {
  /** The narrative/qualitative claim that was checked. */
  claim: string
  /** Whether ground truth supports, refutes, or is silent on the claim. */
  status: 'corroborated' | 'contradicted' | 'unverified'
  /** Sources / trust tiers that bear on the verdict. */
  support: string[]
  /** One-line rationale for the verdict. */
  reasoning: string
}

/** Output of the cross-verification pass over a merged evidence set. */
export interface CrossVerification {
  corroborated: VerifiedClaim[]
  contradicted: VerifiedClaim[]
  unverified: VerifiedClaim[]
  /** One-line headline of how well narrative reconciled with ground truth. */
  summary: string
  /** How the verdicts were produced: 'llm' reconciliation or 'heuristic' fallback. */
  source: 'llm' | 'heuristic'
}

/** An assertion a subagent makes, with the evidence it rests on. */
export interface Claim {
  statement: string
  /** 0–1 confidence in this individual claim. */
  confidence: number
  /**
   * Indices into the owning `FindingsReport.evidence` array. Best-effort in P1;
   * the citation pass (P4) is the authority on claim → evidence mapping.
   */
  evidenceRefs?: number[]
}

/** Why a subagent's ReAct loop terminated. */
export type SubagentStopReason =
  | 'objective_met'  // model produced a final answer with no further tool calls
  | 'max_steps'      // hit the iteration cap
  | 'budget'         // hit the tool-call or wall-clock budget
  | 'error'          // the loop failed; report is best-effort

/**
 * The structured deliverable every specialist subagent returns to the lead.
 * Superset-friendly: claims + the evidence backing them + open gaps + how it ran.
 */
export interface FindingsReport {
  /** Stable id of the producing subagent (e.g. 'market_intelligence'). */
  agent: string
  /** The objective the lead assigned. */
  objective: string
  /** Short narrative of what was found. */
  summary: string
  claims: Claim[]
  evidence: Evidence[]
  /** 0–1 confidence in the overall findings. */
  confidence: number
  /** Open questions / data the agent could not obtain. */
  gaps: string[]
  /** Tool names the agent invoked (deduped, in first-call order). */
  toolsUsed: string[]
  /** Why the loop stopped. */
  stopReason: SubagentStopReason
}

// ── Planning & synthesis (P2: lead researcher) ───────────────────────────────
//
// The lead researcher turns a `ResearchRequest` into a `ResearchPlan` (which
// specialists to spawn and what each must find out), runs them in parallel,
// runs an evaluation gate (`RoundEvaluation`) that decides whether to iterate,
// and finally composes a `DeepResearchResult`. The full cited `ResearchReport`
// (methodology, allocation, citations, proof_ref) is a P4 superset of this.

/** One research objective the lead assigns to a single specialist subagent. */
export interface PlanObjective {
  /** Subagent id to handle this objective (e.g. 'market_intelligence'). */
  agentId: string
  /** Self-contained statement of what that subagent must find out. */
  objective: string
  /** Optional extra scoping — constraints, focus, what to ignore. */
  scope?: string
}

/** The lead researcher's decomposition of a query into parallel subagent work. */
export interface ResearchPlan {
  /** One-line statement of what the overall run is trying to answer. */
  goal: string
  /** Objectives assigned to subagents (run in parallel, ≤1 per subagent). */
  objectives: PlanObjective[]
  /** How the plan was produced: 'llm' (planned) or 'fallback' (deterministic map). */
  source: 'llm' | 'fallback'
}

/** The evaluation gate's verdict after a round of subagent findings. */
export interface RoundEvaluation {
  /** True when the collected findings are enough to answer the query well. */
  sufficient: boolean
  /** Gaps / contradictions still blocking a confident answer. */
  missing: string[]
  /** Targeted follow-up objectives to run next round (empty when sufficient). */
  followups: PlanObjective[]
  /** One-line rationale for the verdict. */
  reasoning: string
}

/**
 * Lightweight deep-research result (P2). Carries the plan, the raw findings, and
 * a best-effort synthesis so the route can stream a useful answer in `run.done`.
 * The full cited `ResearchReport` (per-domain sections, allocation table,
 * citations, attestation `proof_ref`) is the P4 superset.
 */
export interface DeepResearchResult {
  query: string
  queryType: QueryType
  plan: ResearchPlan
  findings: FindingsReport[]
  /** Composed narrative answer (markdown). */
  synthesis: string
  /** 0–1 overall confidence across the findings. */
  confidence: number
  /** Assumptions carried from intake (+ any the lead added). */
  assumptions: string[]
  /** Rounds of subagent work actually run. */
  rounds: number
  /** Cross-verification of narrative vs ground truth (P3), when it ran. */
  crossVerification?: CrossVerification
  /**
   * The full cited research document (P4). Present when synthesis + the
   * citation pass succeeded; absent on catastrophic failure.
   */
  report?: ResearchReport
}

// ── Document, citations & attestation (P4: the deliverable) ──────────────────
//
// The lightweight DeepResearchResult above carries enough to stream an answer.
// P4 turns it into a structured, sourced DOCUMENT: per-domain sections, a
// concrete recommendation (with an allocation table for investment questions),
// risks, and — crucially — a citation pass that maps every material claim back
// to the Evidence backing it (blueprint §8, the Anthropic "separate citation
// pass"). The report is the artifact persisted (Supabase + 0G Storage, P5) and
// rendered by the report drawer (P6).

/** One report claim mapped to the evidence that supports it. */
export interface Citation {
  /** The asserted claim, verbatim from the report. */
  claim: string
  /** Indices into `ResearchReport.evidence` that support the claim. */
  evidenceIndices: number[]
  /** Verdict of the citation/verification pass over this claim. */
  status: 'supported' | 'unsupported' | 'contradicted'
  /** Short rationale for the mapping decision. */
  note?: string
}

/** Output of the citation/verification pass (blueprint §5, §9). */
export interface CitationResult {
  /** Claim → evidence mappings, one per material claim considered. */
  citations: Citation[]
  /** Claims the pass could not back with evidence (quality-gate signal). */
  unsupported: string[]
  /** 0–1 fraction of material claims that are evidence-backed. */
  coverage: number
  /** How the mapping was produced: 'llm' or deterministic 'heuristic' fallback. */
  source: 'llm' | 'heuristic'
}

/** A per-domain findings section in the final document. */
export interface DomainFinding {
  /** Producing subagent id (e.g. 'market_intelligence'). */
  agentId: string
  /** Display name of the domain (e.g. 'Market Intelligence'). */
  domain: string
  /** Short narrative of what this domain found. */
  summary: string
  /** The domain's key evidence-backed claim statements. */
  keyPoints: string[]
  /** 0–1 confidence in this domain's findings. */
  confidence: number
  /** Open questions / data the domain could not obtain. */
  gaps: string[]
}

/** One line of an allocation recommendation (investment-style queries). */
export interface AllocationItem {
  /** Asset symbol or label (e.g. 'WHSK', 'USDC (hold)'). */
  asset: string
  /** Percent of the budget to deploy (0–100). */
  weightPct: number
  /** USD amount when the user stated a budget; null otherwise. */
  amountUsd?: number | null
  /** One-line reason for the weight. */
  reason: string
}

/** The actionable recommendation distilled from the findings. */
export interface Recommendation {
  /** Direct, decisive one-paragraph answer to the query. */
  headline: string
  /**
   * Discrete stance for asset-style questions; 'n/a' for market overviews,
   * conceptual questions, etc.
   */
  stance: 'buy' | 'sell' | 'hold' | 'avoid' | 'watch' | 'n/a'
  /** Allocation table for allocation/comparison queries (empty otherwise). */
  allocation: AllocationItem[]
  /** Concrete next actions the user can take. */
  actions: string[]
}

/**
 * The full cited research document (blueprint §8) — the P4 deliverable and a
 * superset of the legacy single-asset `ResearchBrief`. Pure data, persisted to
 * `research_runs` + 0G Storage and rendered by the report drawer.
 */
export interface ResearchReport {
  /** Run id that produced this report. */
  run_id: string
  /** Original free-text query. */
  query: string
  queryType: QueryType
  /** One-line statement of what the run set out to answer. */
  goal: string
  /** Explicit assumptions carried from intake (+ any the lead added). */
  assumptions: string[]
  /** How the answer was produced — plan, tools, rounds, verification. */
  methodology: string
  /** The lead's decomposition into specialist objectives. */
  plan: ResearchPlan
  /** Evidence-backed findings, grouped by specialist domain. */
  findingsByDomain: DomainFinding[]
  /** The actionable recommendation / allocation. */
  recommendation: Recommendation
  /** Main downside risks and what would invalidate the view. */
  risks: string[]
  /** The composed narrative answer (markdown). */
  narrative: string
  /** 0–1 overall confidence across the findings. */
  confidence: number
  /** Deduped, ranked evidence pool the `citations` index into. */
  evidence: Evidence[]
  /** Claim → evidence mappings produced by the citation pass. */
  citations: Citation[]
  /** Material claims the citation pass could not support. */
  unsupportedClaims: string[]
  /** Narrative-vs-ground-truth triangulation (P3), when it ran. */
  crossVerification?: CrossVerification
  /** 0G sealed-attestation proof reference (P6 fills this; null until then). */
  proof_ref: string | null
  /** ISO timestamp the report was composed. */
  createdAt: string
}

// ── Durable execution (P5) ───────────────────────────────────────────────────
//
// Deep runs can exceed the serverless ceiling, so they run as a durable
// background job whose RunEvents are persisted (Supabase `research_events` + 0G
// `appendLog`) and replayable. A client can reconnect to a run by id and resume
// the stream from a sequence cursor (blueprint §7).

/** Lifecycle status of a persisted deep-research run. */
export type ResearchRunStatus = 'running' | 'done' | 'error'
