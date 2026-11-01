import { type NextRequest, NextResponse } from 'next/server'

import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params
    const supabase = createSupabaseAdminClient()

    const { data: strategy, error: sErr } = await supabase
      .from('strategies')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (sErr) {
      return NextResponse.json({ error: sErr.message }, { status: 500 })
    }
    if (!strategy) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const versionId = strategy.current_version_id as string | null
    let currentVersion = null
    if (versionId) {
      const { data: v } = await supabase
        .from('strategy_versions')
        .select('*')
        .eq('id', versionId)
        .maybeSingle()
      currentVersion = v
    }

    const { data: versions } = await supabase
      .from('strategy_versions')
      .select('id, version_number, validation_status, created_at')
      .eq('strategy_id', id)
      .order('version_number', { ascending: false })

    let indicatorVersionIds: string[] = []
    if (versionId) {
      const { data: deps } = await supabase
        .from('strategy_indicator_dependencies')
        .select('indicator_version_id')
        .eq('strategy_version_id', versionId)

      indicatorVersionIds = (deps ?? []).map(
        (d) => d.indicator_version_id as string,
      )
    }

    let indicatorRefs: { id: string; name: string; version_number: number }[] =
      []
    if (indicatorVersionIds.length > 0) {
      const { data: ivRows } = await supabase
        .from('indicator_versions')
        .select('id, version_number, indicator_id')
        .in('id', indicatorVersionIds)

      const indIds = [...new Set((ivRows ?? []).map((r) => r.indicator_id))]
      const { data: inds } = await supabase
        .from('indicators')
        .select('id, name')
        .in('id', indIds)

      const nameById = new Map((inds ?? []).map((i) => [i.id, i.name]))
      indicatorRefs = (ivRows ?? []).map((r) => ({
        id: r.indicator_id as string,
        name: (nameById.get(r.indicator_id as string) as string) ?? 'Indicator',
        version_number: r.version_number as number,
      }))
    }

    let sampleReceipts: Record<string, unknown>[] = []
    if (versionId) {
      const { data: receipts } = await supabase
        .from('decision_receipts')
        .select('id, mode, status, asset_pair, opened_at, tx_hash')
        .eq('strategy_version_id', versionId)
        .order('opened_at', { ascending: false })
        .limit(5)
      sampleReceipts = receipts ?? []
    }

    const { count: activationCount } = await supabase
      .from('activations')
      .select('*', { count: 'exact', head: true })
      .eq('strategy_id', id)

    const orClause =
      versionId ?
        `strategy_id.eq.${id},strategy_version_id.eq.${versionId}`
      : `strategy_id.eq.${id}`
    const { data: bt } = await supabase
      .from('backtest_runs')
      .select('id, summary, created_at, strategy_version_id')
      .or(orClause)
      .order('created_at', { ascending: false })
      .limit(8)
    const backtests = bt ?? []

    return NextResponse.json({
      strategy,
      currentVersion,
      versions: versions ?? [],
      indicatorRefs,
      sampleReceipts,
      activationCount: activationCount ?? 0,
      backtestRuns: backtests,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
