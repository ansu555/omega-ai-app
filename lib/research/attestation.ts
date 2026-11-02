/**
 * Deep Research — sealed attestation (P6).
 *
 * The final step that makes a research report verifiable: it commits a compact
 * digest of the finished `ResearchReport` to 0G Compute via a SEALED inference
 * call (`computeInference({ sealed: true })`, blueprint §10). Sealed inference
 * returns an on-chain proof reference — anyone can later verify the model ran
 * over this exact digest without trusting our server. The reference is written
 * back into `ResearchReport.proof_ref` (the field P4 deliberately left null).
 *
 * Graceful degradation (this module never throws):
 *   • 0G Compute configured (ZEROG_COMPUTE_API_KEY set) → attempt the sealed
 *     call within a bounded timeout. Success with a proof → `0g-sealed:<ref>`.
 *   • Not configured, or the call fails / returns no proof → fall back to a
 *     deterministic local content hash (`sha256:<hex>`) so the report is still
 *     tamper-evident, flagged `sealed: false`.
 *
 * Per CLAUDE.md, any AI call that influences an on-chain transaction MUST use
 * `sealed: true`; an attested research thesis can drive a trade, so it qualifies.
 * 0G access goes through `@/lib/zerog` (never a raw endpoint).
 *
 * Server-only.
 */

import { createHash } from 'crypto'
import { computeInference } from '@/lib/zerog'
import type { ResearchReport } from '@/lib/research/types'

/** Sealed inference model (ZK-verified output) — see lib/zerog/compute.ts. */
const ATTESTATION_MODEL = 'qwen3.6-plus'

/** Bound the sealed call so a slow provider can't stall the whole deep run. */
const ATTESTATION_TIMEOUT_MS = 25_000

/** How the proof_ref was produced. */
export type AttestationSource = '0g-sealed' | 'local-digest'

/** Outcome of attesting a finished report. */
export interface ReportAttestation {
  /** The value written into `ResearchReport.proof_ref` (namespaced by source). */
  proofRef: string
  /** True only when a sealed 0G inference produced an on-chain proof reference. */
  sealed: boolean
  /** Provenance of the reference. */
  source: AttestationSource
  /** SHA-256 of the canonical digest — always present, independent of 0G. */
  digestSha256: string
  /** Sealed-inference model used (null on the local-digest path). */
  model: string | null
  /** ISO timestamp the attestation was produced. */
  attestedAt: string
  /** One-line human note for logs / the report drawer. */
  note: string
}

/**
 * Attest a finished report. Returns the proof reference + metadata; the caller
 * writes `attestation.proofRef` into `report.proof_ref`. Never throws.
 */
export async function attestReport(report: ResearchReport): Promise<ReportAttestation> {
  const digest = canonicalDigest(report)
  const digestSha256 = sha256(digest)
  const attestedAt = new Date().toISOString()

  const local = (note: string): ReportAttestation => ({
    proofRef: `sha256:${digestSha256}`,
    sealed: false,
    source: 'local-digest',
    digestSha256,
    model: null,
    attestedAt,
    note,
  })

  // Only reach for 0G when Compute is actually configured — otherwise we'd POST
  // an unauthenticated request to the public gateway on every deep run.
  const hasComputeKey =
    typeof process !== 'undefined' && Boolean(process.env.ZEROG_COMPUTE_API_KEY)
  if (!hasComputeKey) {
    return local('0G Compute not configured — report sealed with a local content hash.')
  }

  try {
    const response = await withTimeout(
      computeInference({
        model: ATTESTATION_MODEL,
        sealed: true,
        temperature: 0,
        maxTokens: 64,
        messages: [
          {
            role: 'system',
            content:
              'You are a sealed attestation oracle. You are given the canonical digest of a ' +
              'completed crypto research report. Confirm in one short sentence that you have ' +
              'reviewed this exact digest. Do not add analysis — your value is the sealed proof.',
          },
          { role: 'user', content: `Report digest (sha256=${digestSha256}):\n${digest}` },
        ],
      }),
      ATTESTATION_TIMEOUT_MS,
    )

    if (response.proofRef) {
      return {
        proofRef: `0g-sealed:${response.proofRef}`,
        sealed: true,
        source: '0g-sealed',
        digestSha256,
        model: response.model || ATTESTATION_MODEL,
        attestedAt,
        note: `Sealed on 0G Compute (${response.model || ATTESTATION_MODEL}).`,
      }
    }

    // The call succeeded but the provider returned no proof reference — the
    // output is not verifiable, so fall back to the content hash (honest).
    return local('0G sealed call returned no proof reference — using local content hash.')
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error'
    return local(`0G sealed attestation unavailable (${reason}) — using local content hash.`)
  }
}

/** Whether a proof_ref string is a real 0G sealed proof (vs a local hash). */
export function isSealedProof(proofRef: string | null | undefined): boolean {
  return typeof proofRef === 'string' && proofRef.startsWith('0g-sealed:')
}

// ── Internals ──────────────────────────────────────────────────────────────────

/**
 * Stable, compact digest of the report's decision-bearing fields. Deterministic
 * (fixed field order) so the same report always hashes to the same value — what
 * the sealed proof and the content hash both commit to.
 */
function canonicalDigest(report: ResearchReport): string {
  const supported = report.citations.filter((c) => c.status === 'supported').length
  const payload = {
    run_id: report.run_id,
    query: report.query,
    query_type: report.queryType,
    goal: report.goal,
    stance: report.recommendation.stance,
    headline: report.recommendation.headline,
    allocation: report.recommendation.allocation.map((a) => ({
      asset: a.asset,
      weight_pct: a.weightPct,
    })),
    confidence: report.confidence,
    risks: report.risks,
    claims: report.citations.length,
    supported_claims: supported,
    unsupported_claims: report.unsupportedClaims.length,
    evidence: report.evidence.length,
    cross_verification: report.crossVerification
      ? {
          corroborated: report.crossVerification.corroborated.length,
          contradicted: report.crossVerification.contradicted.length,
          unverified: report.crossVerification.unverified.length,
        }
      : null,
    created_at: report.createdAt,
  }
  return JSON.stringify(payload)
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}
