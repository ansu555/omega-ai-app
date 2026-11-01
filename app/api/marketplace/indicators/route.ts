import { type NextRequest, NextResponse } from 'next/server'

import { isSupabaseSchemaUnavailableError } from '@/lib/marketplace/supabase-read-fallback'
import { tryCreateSupabaseAdminClient } from '@/lib/supabase/server'

const PUBLIC_STATUSES = ['published', 'paused'] as const

export async function GET(req: NextRequest) {
  try {
    const supabase = tryCreateSupabaseAdminClient()
    if (!supabase) {
      return NextResponse.json({ indicators: [] })
    }
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim().toLowerCase() ?? ''
    const paletteOnly = searchParams.get('palette') === '1'

    let query = supabase
      .from('indicators')
      .select(
        'id, name, slug, description, output_type, status, creator_wallet, current_version_id, created_at',
      )

    if (paletteOnly) {
      query = query.eq('status', 'published')
    } else {
      query = query.in('status', [...PUBLIC_STATUSES])
    }

    const { data: rows, error } = await query.order('created_at', {
      ascending: false,
    })

    if (error) {
      if (isSupabaseSchemaUnavailableError(error)) {
        return NextResponse.json({ indicators: [] })
      }
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

    const enriched = await Promise.all(
      list.map(async (ind) => {
        let usedInCount = 0
        if (ind.current_version_id) {
          const { count, error: depErr } = await supabase
            .from('strategy_indicator_dependencies')
            .select('*', { count: 'exact', head: true })
            .eq('indicator_version_id', ind.current_version_id as string)
          if (!depErr) usedInCount = count ?? 0
        }
        return { ...ind, used_in_strategy_count: usedInCount }
      }),
    )

    return NextResponse.json({ indicators: enriched })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
