/**
 * Deep Research — Report composer (P4).
 *
 * Turns the lead's lightweight result (plan + findings + narrative + cross-
 * verification) into the structured, sourced `ResearchReport` document
 * (blueprint §8): per-domain sections, a concrete recommendation (with an
 * allocation table for investment questions), risks, a methodology note, and a
 * citation pass that maps every material claim to its evidence.
 *
 * `buildResearchReport` runs one structured extraction (recommendation + risks)
 * and the citation pass; both degrade gracefully so the function never throws —
 * a model failure yields a templated recommendation and heuristic citations.
 *
 * Server-only.
 */

import { callLLMJson } from '@/lib/ats/llm'
import { getSubagent } from '@/lib/research/subagents'
import { buildEvidencePool, collectClaims, runCitationPass } from '@/lib/research/citation'
import type {
  AllocationItem,
  CitationResult,
  CrossVerification,
  DomainFinding,
  FindingsReport,
  Recommendation,
  ResearchPlan,
  ResearchReport,
  ResearchRequest,
} from '@/lib/research/types'

const STANCES = new Set(['buy', 'sell', 'hold', 'avoid', 'watch', 'n/a'])

export interface BuildReportOptions {
  run_id: string
  request: ResearchRequest
  plan: ResearchPlan
  findings: FindingsReport[]
  /** The composed markdown narrative from the lead's synthesis step. */
  narrative: string
  /** Overall confidence the lead computed. */
  confidence: number
  crossVerification?: CrossVerification
  userWallet?: string
}

export interface BuildReportOutcome {
  report: ResearchReport
  /** Citation-pass stats so the lead can emit a `citation.attached` event. */
  citation: CitationResult
}

/**
 * Compose the full cited research document. Builds the evidence pool, the
 * per-domain sections, a recommendation, risks and methodology, then runs the
 * citation pass over the material claims. Never throws.
 */
export async function buildResearchReport(opts: BuildReportOptions): Promise<BuildReportOutcome> {
  const { run_id, request, plan, findings, narrative, confidence, crossVerification, userWallet } = opts

  // 1. Evidence pool the citations index into (deduped + ranked, P3).
  const evidence = buildEvidencePool(findings, request.query)

  // 2. Per-domain sections.
  const findingsByDomain = toDomainFindings(findings)

  // 3. Recommendation + risks (structured extraction, with templated fallback).
  const { recommendation, risks } = await extractRecommendation(
    request,
    findings,
    crossVerification,
    userWallet,
  )

  // 4. Citation pass over the material claims.
  const citation = await runCitationPass(collectClaims(findings), evidence, request.query, userWallet)

  // 5. Methodology note (deterministic — describes how the answer was produced).
  const methodology = buildMethodology(plan, findings, crossVerification, citation)

  const report: ResearchReport = {
    run_id,
    query: request.query,
    queryType: request.queryType,
    goal: plan.goal,
    assumptions: request.assumptions,
    methodology,
    plan,
    findingsByDomain,
    recommendation,
    risks,
    narrative,
    confidence,
    evidence,
    citations: citation.citations,
    unsupportedClaims: citation.unsupported,
    crossVerification,
    proof_ref: null, // P6 attaches the 0G sealed-attestation reference.
    createdAt: new Date().toISOString(),
  }

  return { report, citation }
}

// ── Per-domain sections ────────────────────────────────────────────────────────

function toDomainFindings(findings: FindingsReport[]): DomainFinding[] {
  return findings.map((f) => ({
    agentId: f.agent,
    domain: getSubagent(f.agent)?.name ?? f.agent,
    summary: f.summary,
    keyPoints: f.claims.map((c) => c.statement).slice(0, 8),
    confidence: f.confidence,
    gaps: f.gaps,
  }))
}

// ── Recommendation + risks extraction ────────────────────────────────────────

interface RawRecommendation {
  headline?: unknown
  stance?: unknown
  allocation?: Array<{ asset?: unknown; weightPct?: unknown; reason?: unknown }>
  actions?: unknown
  risks?: unknown
}

function findingsDigest(findings: FindingsReport[]): string {
  if (!findings.length) return '(no findings)'
  return findings
    .map((f) => {
      const name = getSubagent(f.agent)?.name ?? f.agent
      const claims = f.claims.length
        ? f.claims.map((c) => `  - ${c.statement} (${Math.round(c.confidence * 100)}%)`).join('\n')
        : '  - (no distilled claims)'
      const gaps = f.gaps.length ? `\n  gaps: ${f.gaps.join('; ')}` : ''
      return `### ${name} (${Math.round(f.confidence * 100)}%)\n${f.summary}\n${claims}${gaps}`
    })
    .join('\n\n')
}

async function extractRecommendation(
  request: ResearchRequest,
  findings: FindingsReport[],
  crossVerification: CrossVerification | undefined,
  userWallet: string | undefined,
): Promise<{ recommendation: Recommendation; risks: string[] }> {
  const wantsAllocation = request.queryType === 'allocation' || request.queryType === 'comparison'

  try {
    const raw = await callLLMJson<RawRecommendation>({
      messages: [
        {
          role: 'system',
          content:
            'You are the lead researcher distilling specialist findings into a concrete, decision-useful ' +
            'recommendation. Ground everything ONLY in the findings provided — never invent prices, yields, ' +
            'weights or assets not present. If the findings are thin, say so and keep the recommendation ' +
            'cautious. Respond with JSON only.',
        },
        {
          role: 'user',
          content: [
            `User query: """${request.query}""" (intent: ${request.queryType})`,
            request.amountUsd != null ? `Budget: $${request.amountUsd}.` : 'Budget: not stated.',
            request.riskTolerance ? `Risk tolerance: ${request.riskTolerance}.` : '',
            '',
            'Specialist findings:',
            findingsDigest(findings),
            crossVerification ? `\nCross-verification: ${crossVerification.summary}` : '',
            '',
            'Produce a recommendation. Rules:',
            '- headline: one decisive paragraph answering the query.',
            "- stance: one of buy|sell|hold|avoid|watch for a single-asset judgement, else \"n/a\".",
            wantsAllocation
              ? '- allocation: a split across assets; weightPct are percentages that sum to ~100. One short reason each.'
              : '- allocation: [] (this query is not an allocation question).',
            '- actions: 1–4 concrete next steps.',
            '- risks: the main downside risks and what would invalidate the view.',
            '',
            'Return JSON: {"headline": string, "stance": string, "allocation": [{"asset": string, "weightPct": number, "reason": string}], "actions": string[], "risks": string[]}',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
      userWallet,
      temperature: 0.2,
      maxTokens: 900,
    })

    const stance =
      typeof raw.stance === 'string' && STANCES.has(raw.stance.toLowerCase())
        ? (raw.stance.toLowerCase() as Recommendation['stance'])
        : 'n/a'

    const allocation = wantsAllocation
      ? normaliseAllocation(raw.allocation, request.amountUsd)
      : []

    const recommendation: Recommendation = {
      headline:
        typeof raw.headline === 'string' && raw.headline.trim()
          ? raw.headline.trim()
          : templatedHeadline(request, findings),
      stance,
      allocation,
      actions: asStringList(raw.actions, 4),
    }

    return { recommendation, risks: asStringList(raw.risks, 6) }
  } catch {
    return {
      recommendation: {
        headline: templatedHeadline(request, findings),
        stance: 'n/a',
        allocation: [],
        actions: [],
      },
      risks: collectGaps(findings),
    }
  }
}

/** Normalise + renormalise allocation weights to sum to 100, attaching USD amounts. */
function normaliseAllocation(
  raw: RawRecommendation['allocation'],
  amountUsd: number | null,
): AllocationItem[] {
  if (!Array.isArray(raw)) return []
  const items = raw
    .map((a) => ({
      asset: typeof a.asset === 'string' ? a.asset.trim() : '',
      weightPct: typeof a.weightPct === 'number' && Number.isFinite(a.weightPct) ? Math.max(0, a.weightPct) : 0,
      reason: typeof a.reason === 'string' ? a.reason.trim() : '',
    }))
    .filter((a) => a.asset.length > 0)
    .slice(0, 8)

  const total = items.reduce((s, a) => s + a.weightPct, 0)
  return items.map((a) => {
    const weightPct = total > 0 ? Math.round((a.weightPct / total) * 1000) / 10 : Math.round((100 / items.length) * 10) / 10
    return {
      asset: a.asset,
      weightPct,
      amountUsd: amountUsd != null ? Math.round(amountUsd * (weightPct / 100) * 100) / 100 : null,
      reason: a.reason,
    }
  })
}

function templatedHeadline(request: ResearchRequest, findings: FindingsReport[]): string {
  if (findings.length === 0) {
    return 'The research tools could not gather enough data to give a confident answer right now. Please try again shortly.'
  }
  const subject = request.tokens.length ? request.tokens.join(', ') : 'the market'
  return `Based on the specialist findings on ${subject}, here is a best-effort summary — review the per-domain findings and risks below before acting.`
}

// ── Methodology ──────────────────────────────────────────────────────────────

function buildMethodology(
  plan: ResearchPlan,
  findings: FindingsReport[],
  crossVerification: CrossVerification | undefined,
  citation: CitationResult,
): string {
  const specialists = plan.objectives.map((o) => getSubagent(o.agentId)?.name ?? o.agentId)
  const tools = Array.from(new Set(findings.flatMap((f) => f.toolsUsed)))
  const lines = [
    `Decomposed the query into ${plan.objectives.length} objective(s) handled by: ${specialists.join(', ')} ` +
      `(plan source: ${plan.source}).`,
    tools.length
      ? `Specialists gathered evidence via ${tools.length} tool(s): ${tools.join(', ')}.`
      : 'Specialists answered from prior knowledge (no tools resolved).',
    crossVerification
      ? `Narrative was triangulated against on-chain/market ground truth (${crossVerification.source}): ${crossVerification.summary}`
      : 'No external narrative required cross-verification.',
    `Every material claim was run through a citation pass (${citation.source}); ` +
      `${Math.round(citation.coverage * 100)}% of claims are evidence-backed` +
      (citation.unsupported.length ? `, ${citation.unsupported.length} flagged unsupported.` : '.'),
  ]
  return lines.join(' ')
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function asStringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim())
    .slice(0, max)
}

function collectGaps(findings: FindingsReport[]): string[] {
  const seen = new Set<string>()
  for (const f of findings) for (const g of f.gaps) seen.add(g)
  return Array.from(seen).slice(0, 6)
}
