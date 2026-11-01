/**
 * GET /api/marketplace/featured
 *
 * Returns curated strategy sections for the Marketplace home page:
 *
 *   {
 *     platformPicks:  StrategyCard[],  // highest alpha_score (avg_alpha desc), up to 6
 *     trending:       StrategyCard[],  // highest win_rate_pct, up to 12
 *     newArrivals:    StrategyCard[],  // published in last 7 days, newest first, up to 8
 *   }
 *
 * Each card includes the strategy row, activation_count, alpha score metrics,
 * is_free / price info, and creator handle.
 *
 * No authentication required — all data is public.
 */

import { type NextRequest, NextResponse } from 'next/server'

import { tryCreateSupabaseAdminClient } from '@/lib/supabase/server'
import { isSupabaseSchemaUnavailableError } from '@/lib/marketplace/supabase-read-fallback'

const EMPTY = { platformPicks: [], trending: [], newArrivals: [] }

const PUBLIC_STATUSES = ['published', 'paper_only', 'live_eligible', 'watch'] as const

/** Columns returned for each strategy card. */
const STRATEGY_COLS = [
  'id',
  'name',
  'slug',
  'description',
  'tags',
  'asset_pairs',
  'risk_level',
  'status',
  'creator_wallet',
  'current_version_id',
  'is_free',
  'price_amount',
  'price_token',
  'created_at',
].join(', ')

type StrategyRow = {
  id: string
  name: string
  slug: string | null
  description: string | null
  tags: unknown
  asset_pairs: unknown
  risk_level: string | null
  status: string
  creator_wallet: string
  current_version_id: string | null
  is_free: boolean | null
  price_amount: number | null
  price_token: string | null
  created_at: string
}

type AlphaRow = {
  strategy_version_id: string
  total_trades: number
  win_rate_pct: number | null
  avg_alpha: number | null
  max_drawdown_pct: number | null
}

type CreatorRow = {
  wallet_address: string
  handle: string | null
}

type EnrichedCard = StrategyRow & {
  activation_count: number
  alpha: AlphaRow | null
  creator_handle: string | null
}

export async function GET(_req: NextRequest) {
  try {
    const supabase = tryCreateSupabaseAdminClient()
    if (!supabase) {
      return NextResponse.json(EMPTY)
    }

    // ── 1. Fetch published strategies ──────────────────────────────────────
    const { data: strategies, error: sErr } = await supabase
      .from('strategies')
      .select(STRATEGY_COLS)
      .in('status', [...PUBLIC_STATUSES])
      .order('created_at', { ascending: false })

    if (sErr) {
      if (isSupabaseSchemaUnavailableError(sErr)) {
        return NextResponse.json(EMPTY)
      }
      console.error('[featured] strategies query error', sErr)
      return NextResponse.json({ error: sErr.message }, { status: 500 })
    }

    const rows = (strategies ?? []) as unknown as StrategyRow[]
    if (rows.length === 0) {
      return NextResponse.json(EMPTY)
    }

    const strategyIds = rows.map((s) => s.id)
    const versionIds = rows.map((s) => s.current_version_id).filter(Boolean) as string[]

    // ── 2. Activation counts ───────────────────────────────────────────────
    const activationCounts: Record<string, number> = {}
    if (strategyIds.length > 0) {
      const { data: actRows } = await supabase
        .from('activations')
        .select('strategy_id')
        .in('strategy_id', strategyIds)

      for (const r of actRows ?? []) {
        const sid = r.strategy_id as string
        activationCounts[sid] = (activationCounts[sid] ?? 0) + 1
      }
    }

    // ── 3. Alpha scores (joined via current_version_id) ───────────────────
    const alphaByVersionId = new Map<string, AlphaRow>()
    if (versionIds.length > 0) {
      const { data: alphaRows } = await supabase
        .from('alpha_scores')
        .select('strategy_version_id, total_trades, win_rate_pct, avg_alpha, max_drawdown_pct')
        .in('strategy_version_id', versionIds)

      for (const a of alphaRows ?? []) {
        alphaByVersionId.set(a.strategy_version_id as string, a as AlphaRow)
      }
    }

    // ── 4. Creator handles ─────────────────────────────────────────────────
    const creatorWallets = [...new Set(rows.map((s) => s.creator_wallet))]
    const handleByWallet = new Map<string, string | null>()
    if (creatorWallets.length > 0) {
      const { data: creatorRows } = await supabase
        .from('creators')
        .select('wallet_address, handle')
        .in('wallet_address', creatorWallets)

      for (const c of (creatorRows ?? []) as CreatorRow[]) {
        handleByWallet.set(c.wallet_address, c.handle)
      }
    }

    // ── 5. Enrich each row ────────────────────────────────────────────────
    const cards: EnrichedCard[] = rows.map((s) => ({
      ...s,
      activation_count: activationCounts[s.id] ?? 0,
      alpha: s.current_version_id ? (alphaByVersionId.get(s.current_version_id) ?? null) : null,
      creator_handle: handleByWallet.get(s.creator_wallet) ?? null,
    }))

    // ── 6. Platform picks — highest avg_alpha, up to 6 ───────────────────
    const platformPicks = [...cards]
      .filter((c) => c.alpha?.avg_alpha != null)
      .sort((a, b) => (b.alpha!.avg_alpha ?? 0) - (a.alpha!.avg_alpha ?? 0))
      .slice(0, 6)

    // Fall back to newest strategies if no alpha data exists yet.
    const platformPicksFinal =
      platformPicks.length > 0 ? platformPicks : cards.slice(0, 6)

    // ── 7. Trending — highest win_rate_pct, up to 12 ─────────────────────
    const trending = [...cards]
      .filter((c) => c.alpha?.win_rate_pct != null)
      .sort((a, b) => (b.alpha!.win_rate_pct ?? 0) - (a.alpha!.win_rate_pct ?? 0))
      .slice(0, 12)

    // ── 8. New arrivals — published in last 7 days, newest first, up to 8 ─
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const newArrivals = cards
      .filter((c) => c.created_at >= cutoff)
      .slice(0, 8)

    return NextResponse.json({
      platformPicks: platformPicksFinal,
      trending,
      newArrivals,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
