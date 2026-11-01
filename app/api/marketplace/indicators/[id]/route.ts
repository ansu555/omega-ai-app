import { type NextRequest, NextResponse } from 'next/server'

import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params
    const supabase = createSupabaseAdminClient()

    const { data: indicator, error: e1 } = await supabase
      .from('indicators')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
    if (!indicator) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const vid = indicator.current_version_id as string | null
    let currentVersion = null
    if (vid) {
      const { data: v } = await supabase
        .from('indicator_versions')
        .select('*')
        .eq('id', vid)
        .maybeSingle()
      currentVersion = v
    }

    const { data: versions } = await supabase
      .from('indicator_versions')
      .select('id, version_number, created_at')
      .eq('indicator_id', id)
      .order('version_number', { ascending: false })

    const strategyNames: { strategy_id: string; name: string }[] = []
    if (vid) {
      const { data: deps } = await supabase
        .from('strategy_indicator_dependencies')
        .select('strategy_version_id')
        .eq('indicator_version_id', vid)

      const svIds = [...new Set((deps ?? []).map((d) => d.strategy_version_id))]
      if (svIds.length > 0) {
        const { data: svers } = await supabase
          .from('strategy_versions')
          .select('id, strategy_id')
          .in('id', svIds)

        const stratIds = [...new Set((svers ?? []).map((s) => s.strategy_id))]
        const { data: strats } = await supabase
          .from('strategies')
          .select('id, name')
          .in('id', stratIds)

        const nameById = new Map((strats ?? []).map((s) => [s.id, s.name]))
        for (const sid of stratIds) {
          strategyNames.push({
            strategy_id: sid as string,
            name: (nameById.get(sid) as string) ?? 'Strategy',
          })
        }
      }
    }

    return NextResponse.json({
      indicator,
      currentVersion,
      versions: versions ?? [],
      strategiesUsing: strategyNames,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
