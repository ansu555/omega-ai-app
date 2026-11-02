/**
 * Deep Research — DeFi & Yield tool (P3).
 *
 * Wraps DefiLlama's free public API as the DeFi & Yield specialist's primary
 * data source (blueprint §1, agent #4): protocol TVL/health and where to deploy
 * stablecoins for yield. TVL is used as a trust metric — a large, sticky TVL is
 * a real-world vote of confidence; a thin/declining one is a risk flag.
 *
 * Two modes via the `mode` arg:
 *   • 'protocols' — top protocols by TVL (optionally filtered by chain/category),
 *                   or a single protocol's TVL + breakdown when `protocol` is set.
 *   • 'yields'    — top yield pools by APY (optionally filtered by chain/symbol),
 *                   surfaced for stablecoin/asset-parking questions.
 *
 * Protocol/TVL data comes from `DEFILLAMA_BASE_URL` (default https://api.llama.fi);
 * yield data from the sibling https://yields.llama.fi host. Both are public and
 * keyless. Evidence is tagged `market_data` (DefiLlama is the authoritative DeFi
 * aggregator, akin to CoinGecko for prices).
 *
 * Server-only.
 */

import type { Evidence } from '@/lib/research/types'
import type { ResearchTool, ToolResult } from '@/lib/research/tools/types'
import { asNumber, asString, evidence, fail, ok, round } from '@/lib/research/tools/helpers'

const BASE_URL = (process.env.DEFILLAMA_BASE_URL?.trim() || 'https://api.llama.fi').replace(/\/$/, '')
const YIELDS_URL = 'https://yields.llama.fi'
const FETCH_TIMEOUT_MS = 12_000
const MAX_ITEMS = 12

async function llamaFetch<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      next: { revalidate: 300 },
    })
    if (!res.ok) throw new Error(`DefiLlama HTTP ${res.status} (${url})`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '$0'
  if (n >= 1e9) return `$${round(n / 1e9, 2)}B`
  if (n >= 1e6) return `$${round(n / 1e6, 1)}M`
  if (n >= 1e3) return `$${round(n / 1e3, 1)}K`
  return `$${round(n, 0)}`
}

/** Loose contains match that tolerates casing + "Arbitrum One"/"arbitrum" etc. */
function matches(haystack: unknown, needle: string): boolean {
  if (typeof haystack !== 'string' || !needle) return false
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

// ── DefiLlama response shapes (subset we read) ────────────────────────────────

interface LlamaProtocol {
  name: string
  slug?: string
  symbol?: string
  category?: string
  chain?: string
  chains?: string[]
  tvl?: number
  change_1d?: number
  change_7d?: number
  url?: string
}

interface LlamaPool {
  pool: string
  chain: string
  project: string
  symbol: string
  tvlUsd: number
  apy?: number
  apyBase?: number
  apyReward?: number
  stablecoin?: boolean
  ilRisk?: string
  exposure?: string
}

// ── protocols mode ────────────────────────────────────────────────────────────

async function runProtocols(args: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult> {
  const chain = asString(args.chain)
  const category = asString(args.category)
  const protocolFilter = asString(args.protocol)
  const limit = Math.max(1, Math.min(MAX_ITEMS, asNumber(args.limit, 8)))

  let protocols: LlamaProtocol[]
  try {
    protocols = await llamaFetch<LlamaProtocol[]>(`${BASE_URL}/protocols`, signal)
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'DefiLlama protocols fetch failed.')
  }
  if (!Array.isArray(protocols) || protocols.length === 0) {
    return fail('DefiLlama returned no protocols.')
  }

  let filtered = protocols.filter((p) => Number.isFinite(p.tvl) && (p.tvl ?? 0) > 0)
  if (protocolFilter) {
    filtered = filtered.filter((p) => matches(p.name, protocolFilter) || matches(p.slug, protocolFilter))
  }
  if (chain) {
    filtered = filtered.filter(
      (p) => matches(p.chain, chain) || (p.chains ?? []).some((c) => matches(c, chain)),
    )
  }
  if (category) {
    filtered = filtered.filter((p) => matches(p.category, category))
  }

  filtered.sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
  const top = filtered.slice(0, limit)

  if (top.length === 0) {
    return ok(
      `No DefiLlama protocols matched ${describeFilters(chain, category, protocolFilter)}.`,
      [],
    )
  }

  const evidenceList: Evidence[] = top.map((p) =>
    evidence(
      `${p.name} TVL is ${fmtUsd(p.tvl ?? 0)}${p.category ? ` (${p.category})` : ''}` +
        `${Number.isFinite(p.change_7d) ? `, ${p.change_7d! >= 0 ? '+' : ''}${round(p.change_7d!, 1)}% 7d` : ''}.`,
      'DefiLlama',
      'market_data',
      {
        protocol: p.name,
        slug: p.slug,
        category: p.category,
        chains: p.chains ?? (p.chain ? [p.chain] : []),
        tvl_usd: p.tvl,
        change_1d_pct: p.change_1d,
        change_7d_pct: p.change_7d,
      },
      p.slug ? `https://defillama.com/protocol/${p.slug}` : 'https://defillama.com',
    ),
  )

  const summary =
    `Top ${top.length} protocol(s) by TVL ${describeFilters(chain, category, protocolFilter)}:\n` +
    top
      .map(
        (p, i) =>
          `${i + 1}. ${p.name} — ${fmtUsd(p.tvl ?? 0)}${p.category ? ` · ${p.category}` : ''}` +
          `${Number.isFinite(p.change_7d) ? ` · ${p.change_7d! >= 0 ? '+' : ''}${round(p.change_7d!, 1)}% 7d` : ''}`,
      )
      .join('\n')

  return ok(summary, evidenceList)
}

// ── yields mode ─────────────────────────────────────────────────────────────

async function runYields(args: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult> {
  const chain = asString(args.chain)
  const symbol = asString(args.symbol)
  const stableOnly = args.stablecoin === true
  const minTvl = asNumber(args.minTvlUsd, 1_000_000)
  const limit = Math.max(1, Math.min(MAX_ITEMS, asNumber(args.limit, 8)))

  let payload: { data?: LlamaPool[] }
  try {
    payload = await llamaFetch<{ data?: LlamaPool[] }>(`${YIELDS_URL}/pools`, signal)
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'DefiLlama yields fetch failed.')
  }
  const pools = payload.data
  if (!Array.isArray(pools) || pools.length === 0) {
    return fail('DefiLlama returned no yield pools.')
  }

  let filtered = pools.filter(
    (p) => Number.isFinite(p.apy) && (p.apy ?? 0) > 0 && (p.tvlUsd ?? 0) >= minTvl,
  )
  if (stableOnly) filtered = filtered.filter((p) => p.stablecoin === true)
  if (chain) filtered = filtered.filter((p) => matches(p.chain, chain))
  if (symbol) filtered = filtered.filter((p) => matches(p.symbol, symbol))

  filtered.sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0))
  const top = filtered.slice(0, limit)

  if (top.length === 0) {
    return ok(
      `No DefiLlama yield pools matched ${describeYieldFilters(chain, symbol, stableOnly, minTvl)}.`,
      [],
    )
  }

  const evidenceList: Evidence[] = top.map((p) =>
    evidence(
      `${p.project} ${p.symbol} pool on ${p.chain} yields ${round(p.apy ?? 0, 2)}% APY ` +
        `(TVL ${fmtUsd(p.tvlUsd)}${p.stablecoin ? ', stablecoin' : ''}).`,
      'DefiLlama',
      'market_data',
      {
        project: p.project,
        symbol: p.symbol,
        chain: p.chain,
        apy_pct: p.apy,
        apy_base_pct: p.apyBase,
        apy_reward_pct: p.apyReward,
        tvl_usd: p.tvlUsd,
        stablecoin: p.stablecoin,
        il_risk: p.ilRisk,
        exposure: p.exposure,
      },
      'https://defillama.com/yields',
    ),
  )

  const summary =
    `Top ${top.length} yield pool(s) ${describeYieldFilters(chain, symbol, stableOnly, minTvl)}:\n` +
    top
      .map(
        (p, i) =>
          `${i + 1}. ${round(p.apy ?? 0, 2)}% APY — ${p.project} ${p.symbol} on ${p.chain} ` +
          `(TVL ${fmtUsd(p.tvlUsd)}${p.stablecoin ? ', stable' : ''})`,
      )
      .join('\n')

  return ok(summary, evidenceList)
}

function describeFilters(chain: string, category: string, protocol: string): string {
  const parts: string[] = []
  if (protocol) parts.push(`matching "${protocol}"`)
  if (chain) parts.push(`on ${chain}`)
  if (category) parts.push(`in ${category}`)
  return parts.length ? parts.join(' ') : '(all chains)'
}

function describeYieldFilters(chain: string, symbol: string, stable: boolean, minTvl: number): string {
  const parts: string[] = []
  if (stable) parts.push('stablecoin')
  if (symbol) parts.push(`${symbol}`)
  if (chain) parts.push(`on ${chain}`)
  parts.push(`TVL ≥ ${fmtUsd(minTvl)}`)
  return parts.join(' ')
}

// ── tool ──────────────────────────────────────────────────────────────────────

export const defillamaTool: ResearchTool = {
  name: 'defillama',
  description:
    'Query DefiLlama for DeFi protocol TVL and yield opportunities. mode="protocols" ' +
    'returns top protocols by TVL (filter by chain/category, or pass protocol=<name> ' +
    'for one); mode="yields" returns top pools by APY (filter by chain/symbol, set ' +
    'stablecoin=true for stable yield). Use TVL as a health/trust signal and APY for ' +
    '"where to park funds" questions. HashKey-chain filters surface on-chain-relevant venues.',
  trustTier: 'market_data',
  parameters: {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['protocols', 'yields'], description: 'Which dataset to query. Default "protocols".' },
      chain: { type: 'string', description: 'Filter by chain, e.g. "HashKey Chain", "Ethereum". Optional.' },
      category: { type: 'string', description: 'protocols mode: filter by category, e.g. "Lending", "Dexes". Optional.' },
      protocol: { type: 'string', description: 'protocols mode: look up a single protocol by name/slug. Optional.' },
      symbol: { type: 'string', description: 'yields mode: filter pools by asset symbol, e.g. "USDC". Optional.' },
      stablecoin: { type: 'boolean', description: 'yields mode: restrict to stablecoin pools. Optional.' },
      minTvlUsd: { type: 'number', description: 'yields mode: minimum pool TVL in USD (default 1,000,000).' },
      limit: { type: 'number', description: `Max items to return (1–${MAX_ITEMS}, default 8).` },
    },
    additionalProperties: false,
  },
  async execute(args, ctx): Promise<ToolResult> {
    const mode = asString(args.mode) === 'yields' ? 'yields' : 'protocols'
    return mode === 'yields' ? runYields(args, ctx.signal) : runProtocols(args, ctx.signal)
  },
}
