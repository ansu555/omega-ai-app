import { type NextRequest, NextResponse } from 'next/server'

import { isSupabaseSchemaUnavailableError } from '@/lib/marketplace/supabase-read-fallback'
import { tryCreateSupabaseAdminClient } from '@/lib/supabase/server'

const PUBLIC_STATUSES = [
  'published',
  'paper_only',
  'live_eligible',
  'watch',
  'paused',
] as const

export async function GET(req: NextRequest) {
  try {
    const supabase = tryCreateSupabaseAdminClient()
    if (!supabase) {
      return NextResponse.json({ strategies: [] })
    }
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim().toLowerCase() ?? ''
    const statusFilter = searchParams.get('status')
    const riskLevel = searchParams.get('risk_level')
    const tag = searchParams.get('tag')
    const sort = searchParams.get('sort') ?? 'newest'

    let query = supabase
      .from('strategies')
      .select(
        'id, name, slug, description, tags, asset_pairs, risk_level, status, creator_wallet, current_version_id, created_at, updated_at',
      )

    if (statusFilter && PUBLIC_STATUSES.includes(statusFilter as (typeof PUBLIC_STATUSES)[number])) {
      query = query.eq('status', statusFilter)
    } else {
      query = query.in('status', [...PUBLIC_STATUSES])
    }

    if (riskLevel) query = query.eq('risk_level', riskLevel)

    const { data: rows, error } = await query.order('created_at', {
      ascending: sort === 'oldest',
    })

    if (error) {
      if (isSupabaseSchemaUnavailableError(error)) {
        return NextResponse.json({ strategies: [] })
      }
      console.error(error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let list = rows ?? []

    if (search) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          (s.description ?? '').toLowerCase().includes(search),
      )
    }

    if (tag) {
      list = list.filter((s) => {
        const tags = (s.tags as string[]) ?? []
        return tags.includes(tag)
      })
    }

    const ids = list.map((s) => s.id)
    const activationCounts: Record<string, number> = {}
    const livePnl: Record<string, number> = {}

    if (ids.length > 0) {
      const { data: actRows } = await supabase
        .from('activations')
        .select('strategy_id')
        .in('strategy_id', ids)

      for (const r of actRows ?? []) {
        const sid = r.strategy_id as string
        activationCounts[sid] = (activationCounts[sid] ?? 0) + 1
      }

      const versionToStrategy = new Map<string, string>()
      const { data: versions } = await supabase
        .from('strategy_versions')
        .select('id, strategy_id')
        .in('strategy_id', ids)

      for (const v of versions ?? []) {
        versionToStrategy.set(v.id as string, v.strategy_id as string)
      }

      const versionIds = [...versionToStrategy.keys()]
      if (versionIds.length > 0) {
        const { data: receiptRows } = await supabase
          .from('decision_receipts')
          .select('strategy_version_id, pnl_native, mode')
          .eq('mode', 'live')
          .in('strategy_version_id', versionIds)

        for (const r of receiptRows ?? []) {
          const sid = versionToStrategy.get(r.strategy_version_id as string)
          if (!sid || !ids.includes(sid)) continue
          const p = parseFloat(String(r.pnl_native ?? '0'))
          if (!Number.isNaN(p)) livePnl[sid] = (livePnl[sid] ?? 0) + p
        }
      }
    }

    if (sort === 'activated') {
      list = [...list].sort(
        (a, b) =>
          (activationCounts[b.id] ?? 0) - (activationCounts[a.id] ?? 0),
      )
    }
    if (sort === 'live_pnl') {
      list = [...list].sort(
        (a, b) => (livePnl[b.id] ?? 0) - (livePnl[a.id] ?? 0),
      )
    }
    if (sort === 'paper_pnl') {
      // Deferred — treat as newest
    }

    const enriched = list.map((s) => ({
      ...s,
      activation_count: activationCounts[s.id] ?? 0,
      paper_pnl: 0,
      live_pnl: livePnl[s.id] ?? 0,
      paper_trades: 0,
      live_trades: 0,
    }))

    return NextResponse.json({ strategies: enriched })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
