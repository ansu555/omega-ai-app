/**
 * Deep Research — Intake & Understanding (P0).
 *
 * Replaces the hardcoded regex gate in `app/api/research/run/route.ts` that
 * demanded "exactly one known ticker" and 400'd on every free-form prompt.
 *
 * `runIntake()` turns any free-text query into a structured `ResearchRequest`:
 *   • classifies intent (asset deep-dive | allocation | market overview |
 *     comparison | defi/yield | conceptual)
 *   • extracts entities (tokens, amount, horizon, risk tolerance, chain)
 *   • records explicit assumptions + (optional) clarifying questions
 *   • picks a `primaryTicker` when — and only when — the query is a single-asset
 *     deep dive over a token the ATS can cover (the routing signal).
 *
 * Understanding is done by an LLM via the existing OpenRouter client
 * (`lib/ats/llm.ts`). If the model is unavailable or returns garbage, intake
 * degrades gracefully to a deterministic regex parse so the route never 400s.
 *
 * Server-only (imports the server LLM client).
 */

import { callLLMJson } from '@/lib/ats/llm'
import type { QueryType, ResearchRequest, RiskTolerance } from '@/lib/research/types'

// ── Known token registry ────────────────────────────────────────────────────
// Single source of truth for canonical-ticker resolution, moved here from the
// route. The ATS data layer can cover these symbols, so they are the only ones
// eligible to become a single-asset `primaryTicker`.

const TOKEN_ALIASES: Array<{ canonical: string; terms: string[] }> = [
  { canonical: 'WHSK', terms: ['WHSK', 'HSK', 'HASHKEY'] },
  { canonical: 'BTC', terms: ['BTC', 'BITCOIN'] },
  { canonical: 'ETH', terms: ['ETH', 'ETHEREUM'] },
  { canonical: 'SOL', terms: ['SOL', 'SOLANA'] },
  { canonical: 'BNB', terms: ['BNB', 'BINANCE'] },
  { canonical: 'XRP', terms: ['XRP', 'RIPPLE'] },
  { canonical: 'ADA', terms: ['ADA', 'CARDANO'] },
  { canonical: 'AVAX', terms: ['AVAX', 'AVALANCHE'] },
  { canonical: 'DOGE', terms: ['DOGE', 'DOGECOIN'] },
  { canonical: 'DOT', terms: ['DOT', 'POLKADOT'] },
  { canonical: 'MATIC', terms: ['MATIC', 'POLYGON'] },
  { canonical: 'LINK', terms: ['LINK', 'CHAINLINK'] },
  { canonical: 'UNI', terms: ['UNI', 'UNISWAP'] },
  { canonical: 'ATOM', terms: ['ATOM', 'COSMOS'] },
  { canonical: 'LTC', terms: ['LTC', 'LITECOIN'] },
  { canonical: 'BCH', terms: ['BCH', 'BITCOIN CASH'] },
  { canonical: 'NEAR', terms: ['NEAR'] },
  { canonical: 'APT', terms: ['APT', 'APTOS'] },
  { canonical: 'ARB', terms: ['ARB', 'ARBITRUM'] },
  { canonical: 'OP', terms: ['OP', 'OPTIMISM'] },
  { canonical: 'INJ', terms: ['INJ', 'INJECTIVE'] },
  { canonical: 'SUI', terms: ['SUI'] },
  { canonical: 'SEI', terms: ['SEI'] },
  { canonical: 'TIA', terms: ['TIA', 'CELESTIA'] },
  { canonical: 'RNDR', terms: ['RNDR', 'RENDER'] },
  { canonical: 'PEPE', terms: ['PEPE'] },
  { canonical: 'WIF', terms: ['WIF'] },
  { canonical: 'BONK', terms: ['BONK'] },
  { canonical: 'JUP', terms: ['JUP', 'JUPITER'] },
  { canonical: 'PYTH', terms: ['PYTH'] },
  { canonical: 'SHIB', terms: ['SHIB', 'SHIBA'] },
  { canonical: 'TRX', terms: ['TRX', 'TRON'] },
  { canonical: 'TON', terms: ['TON', 'TONCOIN'] },
  { canonical: 'FTM', terms: ['FTM', 'FANTOM'] },
  { canonical: 'CRV', terms: ['CRV', 'CURVE'] },
  { canonical: 'AAVE', terms: ['AAVE'] },
]

const QUERY_TYPES: QueryType[] = [
  'asset_deep_dive',
  'allocation',
  'market_overview',
  'comparison',
  'defi_yield',
  'conceptual',
]

const RISK_LEVELS: RiskTolerance[] = ['low', 'medium', 'high']

/** Map an arbitrary symbol/name to its canonical ticker, or null if unknown. */
export function canonicalizeTicker(raw: string): string | null {
  const term = raw.trim().toUpperCase()
  if (!term) return null
  for (const { canonical, terms } of TOKEN_ALIASES) {
    if (canonical === term) return canonical
    if (terms.includes(term)) return canonical
  }
  return null
}

/** True when `raw` resolves to a token the ATS can cover. */
export function isKnownTicker(raw: string): boolean {
  return canonicalizeTicker(raw) !== null
}

/** Deterministic word-boundary scan over the known-token registry. */
export function extractKnownTickers(query: string): string[] {
  const upper = query.toUpperCase()
  const matches = new Set<string>()

  for (const { canonical, terms } of TOKEN_ALIASES) {
    for (const term of terms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`(?<![A-Z0-9])${escaped}(?![A-Z0-9])`)
      if (re.test(upper)) {
        matches.add(canonical)
        break
      }
    }
  }

  return Array.from(matches)
}

// ── LLM understanding ───────────────────────────────────────────────────────

interface RawIntake {
  queryType?: unknown
  tokens?: unknown
  amountUsd?: unknown
  horizon?: unknown
  riskTolerance?: unknown
  chain?: unknown
  assumptions?: unknown
  clarifyingQuestions?: unknown
  needsClarification?: unknown
}

const SYSTEM_PROMPT =
  'You are the intake & understanding stage of a crypto deep-research system. ' +
  'Your job is to read a free-form user question and return a structured JSON ' +
  'understanding of it — never to answer it. Be decisive: prefer proceeding with ' +
  'explicit assumptions over asking the user questions. Respond with JSON only.'

function buildUserPrompt(query: string): string {
  const knownList = TOKEN_ALIASES.map((t) => t.canonical).join(', ')
  return [
    `User query: """${query}"""`,
    '',
    'Classify and extract. queryType must be exactly one of:',
    '- asset_deep_dive: a buy/sell/hold judgement on ONE specific token',
    '- allocation: how to deploy a budget across assets (e.g. "I have 50 USDC, where do I invest?")',
    '- market_overview: the state of the market generally, no single token required',
    '- comparison: weighing two or more named assets against each other',
    '- defi_yield: where to earn yield / park stablecoins / protocol APYs',
    '- conceptual: open-ended, educational, or "how does X work" questions',
    '',
    `Known tickers the system can analyse deeply: ${knownList}.`,
    'For "tokens", return canonical UPPERCASE symbols (e.g. Bitcoin -> BTC, HashKey -> WHSK).',
    'If the user states a budget, set amountUsd to the number of US dollars (USDC/USDT/USD count as USD).',
    'Set horizon to any stated time frame ("3 months", "long term") or null.',
    'Set riskTolerance to "low" | "medium" | "high" only if stated or strongly implied, else null.',
    'Set chain to the chain named, else null (the platform trades on HashKey Chain by default).',
    'assumptions: short statements of any gaps you are filling to proceed (e.g. "Assuming a medium risk tolerance").',
    'clarifyingQuestions: at most 2, only for genuinely decision-critical missing info; otherwise [].',
    'needsClarification: true only if you truly cannot give a useful answer without asking.',
    '',
    'Return JSON with exactly these keys:',
    '{"queryType": string, "tokens": string[], "amountUsd": number|null, "horizon": string|null,',
    ' "riskTolerance": string|null, "chain": string|null, "assumptions": string[],',
    ' "clarifyingQuestions": string[], "needsClarification": boolean}',
  ].join('\n')
}

function asStringArray(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim())
    .slice(0, max)
}

function coerceAmountUsd(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/[^0-9.]/g, ''))
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

/** Normalise the raw model output into a vetted ResearchRequest. */
function normalize(query: string, raw: RawIntake): ResearchRequest {
  const queryType: QueryType = QUERY_TYPES.includes(raw.queryType as QueryType)
    ? (raw.queryType as QueryType)
    : 'conceptual'

  // Canonicalise tokens; keep known ones first, preserve unknown uppercased.
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const t of asStringArray(raw.tokens, 8)) {
    const canonical = canonicalizeTicker(t) ?? t.toUpperCase()
    if (!seen.has(canonical)) {
      seen.add(canonical)
      tokens.push(canonical)
    }
  }

  const riskTolerance = RISK_LEVELS.includes(raw.riskTolerance as RiskTolerance)
    ? (raw.riskTolerance as RiskTolerance)
    : null

  const clarifyingQuestions = asStringArray(raw.clarifyingQuestions, 2)

  return {
    query,
    queryType,
    tokens,
    amountUsd: coerceAmountUsd(raw.amountUsd),
    horizon: typeof raw.horizon === 'string' && raw.horizon.trim() ? raw.horizon.trim() : null,
    riskTolerance,
    chain: typeof raw.chain === 'string' && raw.chain.trim() ? raw.chain.trim() : null,
    assumptions: asStringArray(raw.assumptions, 4),
    clarifyingQuestions,
    needsClarification: raw.needsClarification === true && clarifyingQuestions.length > 0,
    primaryTicker: resolvePrimaryTicker(queryType, tokens),
    source: 'llm',
  }
}

/**
 * A `primaryTicker` is set only for single-asset deep dives over a known token —
 * the exact condition under which we drill through the existing ATS pipeline.
 */
function resolvePrimaryTicker(queryType: QueryType, tokens: string[]): string | null {
  if (queryType !== 'asset_deep_dive') return null
  if (tokens.length !== 1) return null
  return canonicalizeTicker(tokens[0])
}

// ── Deterministic fallback ──────────────────────────────────────────────────

/** Regex-only understanding used when the LLM is unavailable or errors out. */
function regexFallback(query: string): ResearchRequest {
  const tokens = extractKnownTickers(query)
  const lower = query.toLowerCase()

  let queryType: QueryType
  if (tokens.length > 1) {
    queryType = 'comparison'
  } else if (tokens.length === 1) {
    queryType = 'asset_deep_dive'
  } else if (/\b(allocat|invest|portfolio|diversif|where (should|do|can) i (put|invest))/.test(lower)) {
    queryType = 'allocation'
  } else if (/\b(yield|apy|stake|staking|stablecoin|defi|farm)/.test(lower)) {
    queryType = 'defi_yield'
  } else {
    queryType = 'market_overview'
  }

  const amountMatch = lower.match(/(\d[\d,]*(?:\.\d+)?)\s*(usdc|usdt|usd|dollars?|\$)/)
  const amountUsd = amountMatch ? coerceAmountUsd(amountMatch[1]) : null

  return {
    query,
    queryType,
    tokens,
    amountUsd,
    horizon: null,
    riskTolerance: null,
    chain: null,
    assumptions: ['Parsed without AI understanding (fallback mode) — entities may be incomplete.'],
    clarifyingQuestions: [],
    needsClarification: false,
    primaryTicker: resolvePrimaryTicker(queryType, tokens),
    source: 'fallback',
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface IntakeOptions {
  query: string
  /** Wallet used to resolve the user's stored OpenRouter key + model. */
  userWallet?: string
}

/**
 * Turn a free-form query into a structured ResearchRequest. Never throws —
 * falls back to a deterministic regex parse if LLM understanding fails.
 */
export async function runIntake(opts: IntakeOptions): Promise<ResearchRequest> {
  const query = opts.query.trim()

  try {
    const raw = await callLLMJson<RawIntake>({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(query) },
      ],
      userWallet: opts.userWallet,
      temperature: 0.1,
      maxTokens: 600,
    })
    return normalize(query, raw ?? {})
  } catch (err) {
    console.warn(
      '[research/intake] LLM understanding failed, using regex fallback:',
      err instanceof Error ? err.message : err,
    )
    return regexFallback(query)
  }
}
