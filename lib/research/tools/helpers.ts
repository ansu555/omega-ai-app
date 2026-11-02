/**
 * Deep Research — tool helpers (P1).
 *
 * Small shared utilities for building normalised `Evidence` / `ToolResult`
 * objects and coercing the loosely-typed argument objects the model passes.
 */

import type { Evidence, TrustTier } from '@/lib/research/types'
import type { ToolResult } from '@/lib/research/tools/types'

/** Build one Evidence record. `timestamp` defaults to now. */
export function evidence(
  claim: string,
  source: string,
  trustTier: TrustTier,
  data: Record<string, unknown>,
  url = '',
  timestamp = new Date().toISOString(),
): Evidence {
  return { claim, source, url, timestamp, trustTier, data }
}

/** A successful tool result. */
export function ok(summary: string, evidenceList: Evidence[] = []): ToolResult {
  return { ok: true, evidence: evidenceList, summary }
}

/** A failed tool result (never throw — return this instead). */
export function fail(error: string): ToolResult {
  return { ok: false, evidence: [], summary: `Tool failed: ${error}`, error }
}

// ── Argument coercion ────────────────────────────────────────────────────────

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

export function asUpperTicker(value: unknown): string {
  return asString(value).toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/[^0-9.-]/g, ''))
    if (Number.isFinite(n)) return n
  }
  return fallback
}

/** Round to `dp` decimal places, tolerating non-finite input. */
export function round(value: number, dp = 2): number {
  if (!Number.isFinite(value)) return 0
  const f = 10 ** dp
  return Math.round(value * f) / f
}

// ── Untrusted-content sanitization (blueprint §9) ─────────────────────────────
//
// Text fetched from the open web / social is DATA, never instructions. Web tools
// run this over anything they pull before it becomes Evidence, neutralising the
// most common prompt-injection patterns and collapsing markup/whitespace so the
// model treats it as a quoted observation rather than a directive.

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (?:all |any |the )?(?:previous|prior|above)\s+instructions?/gi,
  /disregard (?:all |any |the )?(?:previous|prior|above)/gi,
  /forget (?:everything|all|your) (?:previous|prior|above|instructions)/gi,
  /you are now\b/gi,
  /\bnew (?:system )?(?:instructions?|prompt)\b/gi,
  /\b(?:system|developer|assistant)\s*:/gi,
  /<\/?(?:system|user|assistant|instructions?)>/gi,
]

/**
 * Strip HTML markup, collapse whitespace, neutralise instruction-like content,
 * and truncate. Returns a compact plain-text excerpt safe to embed as evidence.
 */
export function sanitizeUntrustedText(raw: string, maxChars = 4000): string {
  if (typeof raw !== 'string' || !raw) return ''
  let text = raw
    // Drop entire script/style blocks before tag stripping.
    .replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, ' ')
    // Strip remaining tags.
    .replace(/<[^>]+>/g, ' ')
    // Common HTML entities → spaces/quotes.
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;|&#34;/gi, '"')
    // Collapse whitespace.
    .replace(/\s+/g, ' ')
    .trim()

  for (const pattern of INJECTION_PATTERNS) {
    text = text.replace(pattern, '[redacted-instruction]')
  }

  return text.length > maxChars ? `${text.slice(0, maxChars)}…[truncated]` : text
}
