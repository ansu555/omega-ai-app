import { type NextRequest, NextResponse } from 'next/server'

import { isSupabaseSchemaUnavailableError } from '@/lib/marketplace/supabase-read-fallback'
import { requireWallet } from '@/lib/marketplace/wallet-header'
import { tryCreateSupabaseAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const w = requireWallet(req)
  if (w instanceof Response) return w

  try {
    const supabase = tryCreateSupabaseAdminClient()
    if (!supabase) {
      return NextResponse.json({
        strategies: [],
        indicators: [],
        activationCount: 0,
      })
    }

    const { data: strategyRows, error: sErr } = await supabase
      .from('strategies')
      .select('id, name, status, current_version_id, created_at, updated_at')
      .eq('creator_wallet', w)
      .order('updated_at', { ascending: false })

    if (sErr) {
      if (isSupabaseSchemaUnavailableError(sErr)) {
        return NextResponse.json({
          strategies: [],
          indicators: [],
          activationCount: 0,
        })
      }
      return NextResponse.json({ error: sErr.message }, { status: 500 })
    }

    const { data: indicatorRows, error: iErr } = await supabase
      .from('indicators')
      .select('id, name, status, current_version_id, created_at, updated_at')
      .eq('creator_wallet', w)
      .order('updated_at', { ascending: false })

    if (iErr) {
      if (isSupabaseSchemaUnavailableError(iErr)) {
        return NextResponse.json({
          strategies: strategyRows ?? [],
          indicators: [],
          activationCount: 0,
        })
      }
      return NextResponse.json({ error: iErr.message }, { status: 500 })
    }

    const stratIds = (strategyRows ?? []).map((r) => r.id as string)
    let activationCount = 0
    if (stratIds.length > 0) {
      const { count, error: aErr } = await supabase
        .from('activations')
        .select('*', { count: 'exact', head: true })
        .in('strategy_id', stratIds)
      if (!aErr) activationCount = count ?? 0
    }

    return NextResponse.json({
      strategies: strategyRows ?? [],
      indicators: indicatorRows ?? [],
      activationCount,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
