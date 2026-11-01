import { type NextRequest, NextResponse } from 'next/server'

import { requireWallet } from '@/lib/marketplace/wallet-header'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const w = requireWallet(req)
  if (w instanceof Response) return w

  try {
    const { id } = await ctx.params
    const supabase = createSupabaseAdminClient()
    const { data: row, error: gErr } = await supabase
      .from('activations')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (gErr) {
      return NextResponse.json({ error: gErr.message }, { status: 500 })
    }
    if (!row || row.user_wallet !== w) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await req.json()) as {
      allocation_pct?: number
      max_position_pct?: number
      max_trades_per_day?: number
      max_daily_loss_pct?: number
      slippage_bps?: number
      requires_confirmation?: boolean
      status?: string
    }

    const patch: Record<string, unknown> = {}
    if (body.allocation_pct !== undefined) patch.allocation_pct = body.allocation_pct
    if (body.max_position_pct !== undefined) {
      patch.max_position_pct = body.max_position_pct
    }
    if (body.max_trades_per_day !== undefined) {
      patch.max_trades_per_day = body.max_trades_per_day
    }
    if (body.max_daily_loss_pct !== undefined) {
      patch.max_daily_loss_pct = body.max_daily_loss_pct
    }
    if (body.slippage_bps !== undefined) patch.slippage_bps = body.slippage_bps
    if (body.requires_confirmation !== undefined) {
      patch.requires_confirmation = body.requires_confirmation
    }
    if (body.status !== undefined) patch.status = body.status

    const { error: uErr } = await supabase
      .from('activations')
      .update(patch)
      .eq('id', id)

    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
