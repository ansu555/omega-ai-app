/**
 * Deep Research — Lead Researcher / Planner (P2).
 *
 * The brain of the v2 research system (blueprint §2, steps [1]–[4]). It takes the
 * structured `ResearchRequest` produced by intake (P0) and:
 *
 *   [1] PLAN      — decompose the query into focused objectives, each assigned to
 *                   one specialist subagent. Emits `plan.created`.
 *   [2] DISPATCH  — run the selected subagents IN PARALLEL via the generic ReAct
 *                   runtime (P1). Each emits its own subagent / tool / evidence
 *                   events and returns a `FindingsReport`.
 *   [3] EVALUATE  — merge findings and ask "enough to answer? gaps? contradictions?".
 *                   If not — and budget allows — spawn targeted follow-up subagents
 *                   for one more round. Emits `round.evaluated`.
 *   [4] SYNTHESIS — compose the answer document grounded in the findings. Emits
 *                   `synthesis.draft`, then `run.done` carrying the text.
 *
 * Reasoning uses a frontier model (blueprint §5) with a graceful degradation
 * chain: frontier → the user's configured model → a deterministic fallback. The
 * whole entrypoint never throws — on catastrophic failure it emits `run.error`.
 *
 * After the document is composed (P4) the lead runs the P6 sealed attestation
 * (`attestReport` → 0G Compute, with a content-hash fallback) and fills the
 * report's `proof_ref` before emitting `report.done`, so the persisted document
 * and the UI both carry a verifiable proof reference.
 *
 * Server-only.
 */

import { callLLM, callLLMJson, type LLMMessage } from '@/lib/ats/llm'
import type { RunEvent, RunEventType } from '@/lib/ats/types'
import type {
  DeepResearchResult,
  FindingsReport,
  PlanObjective,
  ResearchPlan,
  ResearchRequest,
  RoundEvaluation,
} from '@/lib/research/types'
import { runSubagent } from '@/lib/research/subagent-runtime'
import type { ToolContext } from '@/lib/research/tools/types'
import {
  allSubagentIds,
  getSubagent,
  subagentDirectory,
} from '@/lib/research/subagents'
import { crossVerify, crossVerificationNote } from '@/lib/research/retrieval'
import { buildResearchReport } from '@/lib/research/report'
import { attestReport } from '@/lib/research/attestation'
import type { CrossVerification } from '@/lib/research/types'

// ── Tuning ───────────────────────────────────────────────────────────────────

/** Frontier model for the lead's hardest reasoning (plan / evaluate / synthesise). */
const LEAD_MODEL = 'anthropic/claude-sonnet-4-5'

/** Defaults — keep the deep path inside the serverless ceiling until P5's runner. */
const DEFAULT_MAX_ROUNDS = 2
const DEFAULT_WALLCLOCK_MS = 8 * 60_000

/** Caps so a plan / follow-up round can never fan out unbounded. */
const MAX_OBJECTIVES = 5
const MAX_FOLLOWUPS = 3

// ── Public API ────────────────────────────────────────────────────────────────

export interface DeepResearchOptions {
  /** Structured understanding of the query from intake (P0). */
  request: ResearchRequest
  /** Run id minted by the route. */
  run_id: string
  /** Chain the research is scoped to. */
  chainId: number
  /** Caller wallet — resolves their stored OpenRouter key + funds ATS reads. */
  userWallet?: string
  /** SSE sink — the same `send` the route streams to the client. */
  emit: (event: RunEvent) => void
  /** Optional run-level guardrails. */
  budget?: { maxRounds?: number; wallClockMs?: number }
}

/**
 * Run the full deep-research brain for a non-single-asset query. Streams events
 * through `emit` (incl. its own `run.start` / `run.done`) and returns the
 * lightweight result. Never throws.
 */
export async function runDeepResearch(opts: DeepResearchOptions): Promise<DeepResearchResult> {
  const { request, run_id, chainId, userWallet } = opts
  const maxRounds = opts.budget?.maxRounds ?? DEFAULT_MAX_ROUNDS
  const wallClockMs = opts.budget?.wallClockMs ?? DEFAULT_WALLCLOCK_MS
  const started = Date.now()

  const ctx: ToolContext = { userWallet, chainId, run_id, emit: opts.emit }

  send(opts, 'run.start', `Starting deep research — ${humanType(request)}.`, {
    query: request.query,
    query_type: request.queryType,
    tokens: request.tokens,
    amount_usd: request.amountUsd,
    chain_id: chainId,
    source: request.source,
    deep: true,
  })

  try {
    // ── [1] Plan ──────────────────────────────────────────────────────────────
    const plan = await planResearch(request, userWallet)
    send(
      opts,
      'plan.created',
      `Plan ready — ${plan.objectives.length} specialist(s): ${plan.objectives
        .map((o) => o.agentId)
        .join(', ')}.`,
      { goal: plan.goal, objectives: plan.objectives, source: plan.source },
    )

    // ── [2]/[3] Dispatch + evaluate, bounded by round/time budget ────────────────
    const findings: FindingsReport[] = []
    let objectives = plan.objectives
    let round = 0

    while (round < maxRounds && objectives.length > 0) {
      round++
      findings.push(...(await runRound(request, objectives, ctx)))

      // Last allowed round, or out of time → stop without spending an eval call.
      if (round >= maxRounds || Date.now() - started > wallClockMs) {
        send(opts, 'round.evaluated', `Round ${round}: budget reached — proceeding to synthesis.`, {
          round,
          sufficient: true,
          missing: collectGaps(findings),
          reason: round >= maxRounds ? 'max_rounds' : 'wall_clock',
        })
        break
      }

      const evaluation = await evaluateRound(request, findings, userWallet)
      send(
        opts,
        'round.evaluated',
        `Round ${round}: ${evaluation.sufficient ? 'sufficient' : 'gaps remain'}${
          evaluation.missing.length ? ` — ${evaluation.missing.slice(0, 3).join('; ')}` : ''
        }.`,
        {
          round,
          sufficient: evaluation.sufficient,
          missing: evaluation.missing,
          followups: evaluation.followups.map((f) => f.agentId),
        },
      )

      if (evaluation.sufficient || evaluation.followups.length === 0) break
      objectives = evaluation.followups
    }

    // ── [3.5] Cross-verification — triangulate narrative vs ground truth (P3) ────
    // Merge every subagent's evidence and reconcile web/news claims against the
    // on-chain/market hard data before composing the answer (blueprint §6).
    const allEvidence = findings.flatMap((f) => f.evidence)
    const crossVerification = await crossVerify(allEvidence, request.query, userWallet)

    // ── [4] Synthesis ───────────────────────────────────────────────────────────
    const confidence = overallConfidence(findings)
    send(opts, 'synthesis.draft', 'Composing the research document…', {
      findings: findings.length,
      confidence,
      cross_verification: {
        source: crossVerification.source,
        corroborated: crossVerification.corroborated.length,
        contradicted: crossVerification.contradicted.length,
        unverified: crossVerification.unverified.length,
        summary: crossVerification.summary,
      },
    })

    const synthesis = await synthesise(request, plan, findings, confidence, crossVerification, userWallet)

    // ── [5] Citation pass + document composition (P4) ────────────────────────────
    // Map every material claim back to its evidence (the separate Anthropic-style
    // citation pass), then assemble the full sourced ResearchReport.
    const { report, citation } = await buildResearchReport({
      run_id,
      request,
      plan,
      findings,
      narrative: synthesis,
      confidence,
      crossVerification,
      userWallet,
    })

    send(
      opts,
      'citation.attached',
      `Mapped ${report.citations.length} claim(s) to evidence — ${Math.round(citation.coverage * 100)}% supported` +
        (report.unsupportedClaims.length ? `, ${report.unsupportedClaims.length} unsupported.` : '.'),
      {
        coverage: citation.coverage,
        citations: report.citations.length,
        unsupported: report.unsupportedClaims.length,
        evidence: report.evidence.length,
        source: citation.source,
      },
    )

    // ── [6] Sealed attestation (P6) ──────────────────────────────────────────────
    // Commit a digest of the finished document to 0G Compute (sealed inference)
    // and write the proof reference into the report. Degrades to a local content
    // hash when 0G is unavailable; never throws.
    const attestation = await attestReport(report)
    report.proof_ref = attestation.proofRef
    const attestationPayload = {
      proof_ref: attestation.proofRef,
      sealed: attestation.sealed,
      source: attestation.source,
      digest_sha256: attestation.digestSha256,
      model: attestation.model,
      note: attestation.note,
    }

    // The full document — carried in the payload so the client/store can render
    // it without lib/ats depending on lib/research types (RunEvent stays clean).
    send(opts, 'report.done', report.recommendation.headline || 'Research document ready.', {
      report,
      attestation: attestationPayload,
    })

    send(opts, 'run.done', synthesis, {
      deep: true,
      query_type: request.queryType,
      tokens: request.tokens,
      confidence,
      rounds: round,
      assumptions: request.assumptions,
      report_available: true,
      attestation: attestationPayload,
      cross_verification: {
        source: crossVerification.source,
        corroborated: crossVerification.corroborated.length,
        contradicted: crossVerification.contradicted.length,
        unverified: crossVerification.unverified.length,
        summary: crossVerification.summary,
      },
      agents: findings.map((f) => ({
        agent: f.agent,
        confidence: f.confidence,
        claims: f.claims.length,
        evidence: f.evidence.length,
        gaps: f.gaps,
      })),
    })

    return {
      query: request.query,
      queryType: request.queryType,
      plan,
      findings,
      synthesis,
      confidence,
      assumptions: request.assumptions,
      rounds: round,
      crossVerification,
      report,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    send(opts, 'run.error', `Deep research failed: ${msg}`, { error: msg })
    return {
      query: request.query,
      queryType: request.queryType,
      plan: deterministicPlan(request),
      findings: [],
      synthesis: '',
      confidence: 0,
      assumptions: request.assumptions,
      rounds: 0,
    }
  }
}

// ── [1] Planning ───────────────────────────────────────────────────────────────

interface RawPlan {
  goal?: unknown
  objectives?: unknown
}

const PLANNER_SYSTEM =
  'You are the lead researcher of a crypto deep-research team. You do not answer ' +
  'the question yourself — you decompose it into focused objectives and assign each ' +
  'to ONE specialist subagent best suited to it. Be economical: assign only the ' +
  'specialists that materially help, never the same one twice. Respond with JSON only.'

function buildPlannerPrompt(request: ResearchRequest): string {
  return [
    `User query: """${request.query}"""`,
    requestFacts(request),
    '',
    'Available specialist subagents:',
    subagentDirectory(),
    '',
    `Decompose the query into 2–${MAX_OBJECTIVES} objectives, each assigned to one ` +
      'well-suited subagent. Give each a concrete, self-contained objective (what to ' +
      'find out) and an optional scope. Do not assign the same subagent twice. Skip ' +
      'specialists irrelevant to this query.',
    '',
    'Return JSON: {"goal": string, "objectives": [{"agentId": string, "objective": string, "scope": string}]}',
    `agentId must be one of: ${allSubagentIds().join(', ')}.`,
  ].join('\n')
}

async function planResearch(
  request: ResearchRequest,
  userWallet: string | undefined,
): Promise<ResearchPlan> {
  const raw = await leadJson<RawPlan>(
    [
      { role: 'system', content: PLANNER_SYSTEM },
      { role: 'user', content: buildPlannerPrompt(request) },
    ],
    userWallet,
    900,
  )

  if (raw) {
    const objectives = normaliseObjectives(raw.objectives, MAX_OBJECTIVES)
    if (objectives.length > 0) {
      const goal =
        typeof raw.goal === 'string' && raw.goal.trim() ? raw.goal.trim() : request.query
      return { goal, objectives, source: 'llm' }
    }
  }

  return deterministicPlan(request)
}

/** Deterministic queryType → specialists map used when LLM planning is unavailable. */
function deterministicPlan(request: ResearchRequest): ResearchPlan {
  const map: Record<ResearchRequest['queryType'], string[]> = {
    asset_deep_dive: ['market_intelligence', 'news_sentiment', 'onchain_liquidity', 'risk_portfolio'],
    allocation: ['market_intelligence', 'risk_portfolio', 'defi_yield', 'news_sentiment'],
    market_overview: ['market_intelligence', 'news_sentiment', 'onchain_liquidity'],
    comparison: ['market_intelligence', 'risk_portfolio', 'news_sentiment', 'onchain_liquidity'],
    defi_yield: ['defi_yield', 'onchain_liquidity', 'risk_portfolio'],
    conceptual: ['market_intelligence', 'news_sentiment'],
  }
  const ids = (map[request.queryType] ?? ['market_intelligence', 'news_sentiment']).slice(
    0,
    MAX_OBJECTIVES,
  )
  return {
    goal: request.query,
    objectives: ids.map((agentId) => ({ agentId, objective: defaultObjective(agentId, request) })),
    source: 'fallback',
  }
}

/** Per-agent default objective text used by the deterministic plan. */
function defaultObjective(agentId: string, request: ResearchRequest): string {
  const subject = request.tokens.length ? request.tokens.join(', ') : 'the broad crypto market'
  switch (agentId) {
    case 'market_intelligence':
      return `Assess current price action, volume, volatility and technical setup for ${subject}.`
    case 'onchain_liquidity':
      return `Assess DEX liquidity, tradability and on-chain activity for ${subject}.`
    case 'news_sentiment':
      return `Surface the current narrative, catalysts and sentiment around ${subject}.`
    case 'defi_yield':
      return request.amountUsd != null
        ? `Find where ~$${request.amountUsd} could earn yield safely, with risk context.`
        : `Identify notable yield opportunities and protocol risks relevant to ${subject}.`
    case 'fundamentals':
      return `Evaluate the fundamentals, legitimacy and key risks of ${subject}.`
    case 'risk_portfolio':
      return request.amountUsd != null
        ? `Recommend how to allocate ~$${request.amountUsd} across the candidates, with sizing and max downside.`
        : `Produce a risk-aware recommendation for ${subject}, with sizing and key downside risks.`
    default:
      return `Research ${subject} within your domain for: "${request.query}".`
  }
}

// ── [2] Dispatch ───────────────────────────────────────────────────────────────

/** Run one round of objectives as parallel subagents. */
async function runRound(
  request: ResearchRequest,
  objectives: PlanObjective[],
  ctx: ToolContext,
): Promise<FindingsReport[]> {
  return Promise.all(
    objectives.map(async (o): Promise<FindingsReport> => {
      const spec = getSubagent(o.agentId)
      if (!spec) return placeholderReport(o, `Unknown subagent id "${o.agentId}".`)
      // No explicit model → subagents use the user's configured (mid-tier) model
      // for cost control; the lead reserves the frontier model for itself.
      return runSubagent({
        spec,
        task: { objective: o.objective, scope: o.scope, context: taskContext(request) },
        ctx,
      })
    }),
  )
}

function taskContext(request: ResearchRequest): Record<string, unknown> {
  const ctx: Record<string, unknown> = {}
  if (request.tokens.length) ctx.tokens = request.tokens
  if (request.amountUsd != null) ctx.amountUsd = request.amountUsd
  if (request.horizon) ctx.horizon = request.horizon
  if (request.riskTolerance) ctx.riskTolerance = request.riskTolerance
  ctx.chain = request.chain ?? 'HashKey Chain'
  return ctx
}

function placeholderReport(o: PlanObjective, reason: string): FindingsReport {
  return {
    agent: o.agentId,
    objective: o.objective,
    summary: `No findings — ${reason}`,
    claims: [],
    evidence: [],
    confidence: 0,
    gaps: [reason],
    toolsUsed: [],
    stopReason: 'error',
  }
}

// ── [3] Evaluation gate ─────────────────────────────────────────────────────────

interface RawEval {
  sufficient?: unknown
  missing?: unknown
  followups?: unknown
  reasoning?: unknown
}

const EVAL_SYSTEM =
  'You are the lead researcher running the evaluation gate of a deep-research run. ' +
  'Given the findings gathered so far, decide whether they are enough to write a ' +
  'confident, useful answer, or whether targeted follow-up research is needed. Be ' +
  'strict but practical — do not demand perfection. Respond with JSON only.'

function buildEvalPrompt(request: ResearchRequest, findings: FindingsReport[]): string {
  return [
    `User query: """${request.query}""" (intent: ${request.queryType})`,
    '',
    'Findings so far (agent · confidence · summary · gaps):',
    findingsDigest(findings),
    '',
    'Decide if these are sufficient to write a confident, useful answer. If not, ' +
      `list what is missing and propose up to ${MAX_FOLLOWUPS} targeted follow-up ` +
      'objectives for specific subagents to close the gaps.',
    `Available subagents: ${allSubagentIds().join(', ')}.`,
    '',
    'Return JSON: {"sufficient": boolean, "missing": string[], "followups": [{"agentId": string, "objective": string}], "reasoning": string}',
  ].join('\n')
}

async function evaluateRound(
  request: ResearchRequest,
  findings: FindingsReport[],
  userWallet: string | undefined,
): Promise<RoundEvaluation> {
  const raw = await leadJson<RawEval>(
    [
      { role: 'system', content: EVAL_SYSTEM },
      { role: 'user', content: buildEvalPrompt(request, findings) },
    ],
    userWallet,
    600,
  )

  if (raw) {
    return {
      sufficient: raw.sufficient === true,
      missing: asStringList(raw.missing, 6),
      followups: normaliseObjectives(raw.followups, MAX_FOLLOWUPS),
      reasoning: typeof raw.reasoning === 'string' ? raw.reasoning.trim() : '',
    }
  }

  // Heuristic fallback: good-enough if the average finding confidence clears 0.5.
  const avg = overallConfidence(findings)
  return {
    sufficient: avg >= 0.5,
    missing: collectGaps(findings),
    followups: [],
    reasoning: 'Heuristic evaluation (LLM gate unavailable).',
  }
}

// ── [4] Synthesis ────────────────────────────────────────────────────────────────

const SYNTH_SYSTEM =
  'You are the lead researcher composing the final research document for the user. ' +
  'Write a clear, well-structured answer grounded ONLY in the findings provided — ' +
  'never invent prices, yields, addresses or facts not present in them. Where the ' +
  'findings are thin or disagree, say so honestly and temper your confidence. Be ' +
  'specific and decision-useful.'

function buildSynthesisPrompt(
  request: ResearchRequest,
  plan: ResearchPlan,
  findings: FindingsReport[],
  crossVerification: CrossVerification,
): string {
  const findingsSection = `2. **Key findings** — the most important evidence-backed points, grouped by domain.`
  const allocationSection = `2. **Allocation** — a concrete split of the budget across assets, with a one-line reason per weight.`
  const second = request.queryType === 'allocation' ? allocationSection : findingsSection

  return [
    `User query: """${request.query}"""`,
    requestFacts(request),
    `Research goal: ${plan.goal}`,
    '',
    'Specialist findings:',
    findingsFullDigest(findings),
    '',
    'Cross-verification (narrative triangulated against on-chain/market ground truth):',
    crossVerificationNote(crossVerification),
    '',
    'Write the answer in markdown with these short sections:',
    '1. **Answer** — a direct, decisive response to the query.',
    second,
    '3. **Risks** — the main downside and what would invalidate this view.',
    '4. **Assumptions & gaps** — what you assumed and what could not be verified.',
    '',
    'Respect the cross-verification: rely on corroborated claims, DROP or heavily caveat ' +
      'anything contradicted by ground truth, and hedge unverified narrative. Be concise. ' +
      'Do not fabricate numbers or sources not present in the findings above.',
  ].join('\n')
}

async function synthesise(
  request: ResearchRequest,
  plan: ResearchPlan,
  findings: FindingsReport[],
  confidence: number,
  crossVerification: CrossVerification,
  userWallet: string | undefined,
): Promise<string> {
  const text = await leadText(
    [
      { role: 'system', content: SYNTH_SYSTEM },
      { role: 'user', content: buildSynthesisPrompt(request, plan, findings, crossVerification) },
    ],
    userWallet,
    1600,
  )
  return text ?? templatedSynthesis(request, findings, confidence)
}

/** Deterministic answer assembled from findings when LLM synthesis is unavailable. */
function templatedSynthesis(
  request: ResearchRequest,
  findings: FindingsReport[],
  confidence: number,
): string {
  const lines: string[] = [`**Research summary — ${humanType(request)}**`, '']

  if (findings.length === 0) {
    lines.push(
      'I could not gather enough data to answer this confidently right now ' +
        '(the research tools or model were unavailable). Please try again shortly.',
    )
  } else {
    lines.push('Here is what the specialist team found:', '')
    for (const f of findings) {
      const name = getSubagent(f.agent)?.name ?? f.agent
      lines.push(`- **${name}** (${Math.round(f.confidence * 100)}%): ${f.summary}`)
      if (f.gaps.length) lines.push(`  - Gaps: ${f.gaps.slice(0, 2).join('; ')}`)
    }
  }

  lines.push('', `Overall confidence: ${Math.round(confidence * 100)}%.`)
  if (request.assumptions.length) lines.push(`Assumptions: ${request.assumptions.join('; ')}.`)
  return lines.join('\n')
}

// ── Findings digests ─────────────────────────────────────────────────────────

function findingsDigest(findings: FindingsReport[]): string {
  if (!findings.length) return '(none yet)'
  return findings
    .map((f) => {
      const name = getSubagent(f.agent)?.name ?? f.agent
      const gaps = f.gaps.length ? ` · gaps: ${f.gaps.join('; ')}` : ''
      return `- ${name} · ${Math.round(f.confidence * 100)}% · ${f.summary}${gaps}`
    })
    .join('\n')
}

function findingsFullDigest(findings: FindingsReport[]): string {
  if (!findings.length) return '(no findings were gathered)'
  return findings
    .map((f) => {
      const name = getSubagent(f.agent)?.name ?? f.agent
      const claims = f.claims.length
        ? f.claims.map((c) => `- ${c.statement} (${Math.round(c.confidence * 100)}%)`).join('\n')
        : '- (no distilled claims)'
      const evidence = f.evidence.length
        ? f.evidence
            .slice(0, 6)
            .map((e) => `- [${e.trustTier}/${e.source}] ${e.claim}${e.url ? ` (${e.url})` : ''}`)
            .join('\n')
        : '- (no evidence gathered)'
      const gaps = f.gaps.length ? `\nGaps: ${f.gaps.join('; ')}` : ''
      return `### ${name} (confidence ${Math.round(f.confidence * 100)}%)\n${f.summary}\nClaims:\n${claims}\nEvidence:\n${evidence}${gaps}`
    })
    .join('\n\n')
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

/** Emit a lead-owned event over the SSE sink (always attributed to the orchestrator). */
function send(
  opts: DeepResearchOptions,
  type: RunEventType,
  message: string,
  payload?: Record<string, unknown>,
): void {
  opts.emit({
    type,
    run_id: opts.run_id,
    ts: new Date().toISOString(),
    agent: 'orchestrator',
    message,
    payload,
  })
}

function humanType(request: ResearchRequest): string {
  return request.queryType.replace(/_/g, ' ')
}

function requestFacts(request: ResearchRequest): string {
  return (
    `Intent: ${request.queryType}. ` +
    `Tokens: ${request.tokens.length ? request.tokens.join(', ') : '(none)'}. ` +
    `Budget: ${request.amountUsd != null ? `$${request.amountUsd}` : '(none)'}. ` +
    `Horizon: ${request.horizon ?? '(none)'}. ` +
    `Risk tolerance: ${request.riskTolerance ?? '(unspecified)'}. ` +
    `Chain: ${request.chain ?? 'HashKey Chain'}.`
  )
}

/**
 * Run a JSON lead call with graceful model degradation: frontier first, then the
 * user's configured/default model. Returns null if both fail (→ deterministic
 * fallback at the call site). Never throws.
 */
async function leadJson<T>(
  messages: LLMMessage[],
  userWallet: string | undefined,
  maxTokens: number,
): Promise<T | null> {
  for (const model of [LEAD_MODEL, undefined] as const) {
    try {
      return await callLLMJson<T>({ messages, userWallet, model, temperature: 0.2, maxTokens })
    } catch {
      // try the next model tier
    }
  }
  return null
}

/** Text variant of {@link leadJson}. Returns null if every tier fails. */
async function leadText(
  messages: LLMMessage[],
  userWallet: string | undefined,
  maxTokens: number,
): Promise<string | null> {
  for (const model of [LEAD_MODEL, undefined] as const) {
    try {
      const text = await callLLM({ messages, userWallet, model, temperature: 0.3, maxTokens })
      if (text && text.trim()) return text.trim()
    } catch {
      // try the next model tier
    }
  }
  return null
}

/** Validate + normalise a raw objectives array into ≤max deduped PlanObjectives. */
function normaliseObjectives(value: unknown, max: number): PlanObjective[] {
  if (!Array.isArray(value)) return []
  const known = new Set(allSubagentIds())
  const seen = new Set<string>()
  const out: PlanObjective[] = []

  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const agentId = typeof obj.agentId === 'string' ? obj.agentId.trim() : ''
    const objective = typeof obj.objective === 'string' ? obj.objective.trim() : ''
    if (!known.has(agentId) || !objective || seen.has(agentId)) continue
    seen.add(agentId)
    const scope = typeof obj.scope === 'string' && obj.scope.trim() ? obj.scope.trim() : undefined
    out.push({ agentId, objective, scope })
    if (out.length >= max) break
  }

  return out
}

function asStringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim())
    .slice(0, max)
}

/** Deduped, flattened gaps across all findings (for transparency payloads). */
function collectGaps(findings: FindingsReport[]): string[] {
  const seen = new Set<string>()
  for (const f of findings) for (const g of f.gaps) seen.add(g)
  return Array.from(seen).slice(0, 5)
}

/** Mean confidence across findings that actually produced something. */
function overallConfidence(findings: FindingsReport[]): number {
  const scored = findings.filter((f) => f.evidence.length > 0 || f.claims.length > 0)
  const pool = scored.length ? scored : findings
  if (!pool.length) return 0.3
  const mean = pool.reduce((s, f) => s + f.confidence, 0) / pool.length
  return Math.round(Math.max(0, Math.min(1, mean)) * 100) / 100
}
