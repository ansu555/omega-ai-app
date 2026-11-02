/**
 * Deep Research — Fundamentals tool (P3).
 *
 * Wraps the Kryll X-Ray audit (already proxied by `app/api/token/[id]`) as the
 * Fundamentals & Project specialist's primary structured source (blueprint §1
 * agent #5): tokenomics/supply, audit + security grade, development activity,
 * maturity, social reach, and red-flag alerts — "is this project real and sound?"
 *
 * Calls the same upstream Kryll endpoint directly so it works inside the tool
 * runtime without an internal HTTP hop. Evidence is tagged `derived` (Kryll's
 * composite scores) — supply facts the model should still cross-check against
 * `onchain_reader` ground truth. Degrades gracefully when a token is not covered.
 *
 * Server-only.
 */

import type { KryllAuditData, KryllAuditResponse } from '@/app/api/crypto/types'
import type { Evidence } from '@/lib/research/types'
import type { ResearchTool, ToolResult } from '@/lib/research/tools/types'
import { asString, evidence, fail, ok, round } from '@/lib/research/tools/helpers'

const KRYLL_HEADERS = {
  Accept: '*/*',
  Origin: 'https://app.kryll.io',
  Referer: 'https://app.kryll.io/',
}
const FETCH_TIMEOUT_MS = 12_000

async function fetchAudit(tokenId: string, signal?: AbortSignal): Promise<KryllAuditData | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const res = await fetch(`https://dapi.kryll.io/xray/audit/${encodeURIComponent(tokenId)}`, {
      method: 'GET',
      headers: KRYLL_HEADERS,
      signal: controller.signal,
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const json = (await res.json()) as KryllAuditResponse
    return json.data ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

function gradeLabel(score: number): string {
  if (score >= 80) return 'strong'
  if (score >= 60) return 'solid'
  if (score >= 40) return 'mixed'
  return 'weak'
}

/** Flatten Kryll's alert maps into a deduped red-flag list. */
function collectAlerts(audit: KryllAuditData): string[] {
  const out = new Set<string>()
  const sources = [
    audit.financial?.alerts,
    audit.fundamental?.alerts,
    audit.social?.alerts,
    audit.security?.alerts,
  ]
  for (const map of sources) {
    if (map && typeof map === 'object') {
      for (const v of Object.values(map)) {
        if (typeof v === 'string' && v.trim()) out.add(v.trim())
      }
    }
  }
  return Array.from(out).slice(0, 8)
}

export const tokenAuditTool: ResearchTool = {
  name: 'token_audit',
  description:
    'Fetch a structured project audit (Kryll X-Ray) for a token: financial / ' +
    'fundamental / social / security scores, supply & tokenomics, development ' +
    'activity, maturity, audit grade and red-flag alerts. Use to judge project ' +
    'legitimacy and soundness. Supply figures should be cross-checked against ' +
    'onchain_reader. Not every token is covered — treat a miss as a coverage gap.',
  trustTier: 'derived',
  parameters: {
    type: 'object',
    properties: {
      token: { type: 'string', description: 'Token symbol or id, e.g. BTC, ETH, HSK.' },
    },
    required: ['token'],
    additionalProperties: false,
  },
  async execute(args, ctx): Promise<ToolResult> {
    const token = asString(args.token)
    if (!token) return fail('Missing required argument: token.')

    const id = token.toLowerCase().replace(/[^a-z0-9-]/g, '')
    const audit = await fetchAudit(id, ctx.signal)
    if (!audit) {
      return fail(`No Kryll audit coverage for "${token}". Record fundamentals as a gap.`)
    }

    const fin = Math.round(audit.financial?.score ?? 0)
    const fund = Math.round(audit.fundamental?.score ?? 0)
    const soc = Math.round(audit.social?.score ?? 0)
    const sec = Math.round(audit.security?.score ?? 0)
    const overall = round(audit.global_score ?? 0, 1)

    const supply = audit.fundamental?.supply ?? audit.financial?.market?.supply
    const maturityMonths = audit.fundamental?.maturity?.age_in_months ?? 0
    const git = audit.fundamental?.git
    const secGrade = audit.security?.web?.rate || 'N/A'
    const alerts = collectAlerts(audit)
    const url = `https://app.kryll.io/xray/${id}`

    const ev: Evidence[] = []

    ev.push(
      evidence(
        `${audit.symbol?.toUpperCase() ?? token.toUpperCase()} audit scores — overall ${overall}/10 ` +
          `(financial ${fin}, fundamental ${fund}, social ${soc}, security ${sec}); ${gradeLabel(overall * 10)}.`,
        'Kryll X-Ray',
        'derived',
        {
          symbol: audit.symbol,
          name: audit.name,
          global_score: overall,
          financial_score: fin,
          fundamental_score: fund,
          social_score: soc,
          security_score: sec,
          security_grade: secGrade,
          maturity_months: maturityMonths,
        },
        url,
      ),
    )

    if (supply) {
      ev.push(
        evidence(
          `${audit.symbol?.toUpperCase() ?? token.toUpperCase()} supply — circulating ` +
            `${(supply.circulating ?? 0).toLocaleString()}, total ${(supply.total ?? 0).toLocaleString()}` +
            `${supply.max ? `, max ${supply.max.toLocaleString()}` : ''} (circ/total ratio ${round(supply.ratio ?? 0, 2)}).`,
          'Kryll X-Ray',
          'derived',
          {
            circulating: supply.circulating,
            total: supply.total,
            max: supply.max,
            ratio: supply.ratio,
          },
          url,
        ),
      )
    }

    if (git?.name) {
      ev.push(
        evidence(
          `${audit.name ?? token} development: GitHub "${git.name}" — ${git.forks ?? 0} forks, ` +
            `${git.watchers ?? 0} watchers, last push ${git.pushed_at ?? 'unknown'}.`,
          'Kryll X-Ray (GitHub)',
          'derived',
          { repo: git.name, forks: git.forks, watchers: git.watchers, pushed_at: git.pushed_at },
          git.html_url || url,
        ),
      )
    }

    for (const alert of alerts) {
      ev.push(
        evidence(`Red flag: ${alert}`, 'Kryll X-Ray', 'derived', { alert }, url),
      )
    }

    const summaryLines = [
      `${audit.name ?? token} (${audit.symbol?.toUpperCase() ?? token.toUpperCase()}) — Kryll overall ${overall}/10, ` +
        `${gradeLabel(overall * 10)} (financial ${fin} · fundamental ${fund} · social ${soc} · security ${sec}, grade ${secGrade}).`,
      `Maturity: ${maturityMonths} months. Development: ${git?.name ? `active (${git.forks ?? 0} forks)` : 'no tracked repo'}.`,
    ]
    if (alerts.length) summaryLines.push(`Alerts (${alerts.length}): ${alerts.slice(0, 3).join('; ')}.`)

    return ok(summaryLines.join('\n'), ev)
  },
}
