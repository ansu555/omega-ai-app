import { type NextRequest, NextResponse } from 'next/server'

import { requireWallet } from '@/lib/marketplace/wallet-header'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const w = requireWallet(req)
  if (w instanceof Response) return w

  try {
    const { id } = await ctx.params
    const supabase = createSupabaseAdminClient()
    const { data: row, error: gErr } = await supabase
      .from('strategies')
      .select('creator_wallet, current_version_id, id')
      .eq('id', id)
      .maybeSingle()

    if (gErr) {
      return NextResponse.json({ error: gErr.message }, { status: 500 })
    }
    if (!row || row.creator_wallet !== w) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await req.json()) as {
      summary?: Record<string, unknown>
      candles_source?: string
    }
    const versionId = row.current_version_id as string | null

    const { data: ins, error: iErr } = await supabase
      .from('backtest_runs')
      .insert({
        strategy_id: id,
        strategy_version_id: versionId,
        run_by_wallet: w,
        candles_source: body.candles_source ?? 'client',
        summary: body.summary ?? {},
      })
      .select('id')
      .single()

    if (iErr) {
      return NextResponse.json({ error: iErr.message }, { status: 500 })
    }
    return NextResponse.json({ id: ins.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
