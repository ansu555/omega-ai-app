import { type NextRequest, NextResponse } from 'next/server'

import { requireWallet } from '@/lib/marketplace/wallet-header'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { evaluateActivationRisk } from '@/lib/marketplace/risk-check'

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const w = requireWallet(req)
  if (w instanceof Response) return w

  try {
    const { id } = await ctx.params
    const supabase = createSupabaseAdminClient()
    const { data: act, error: gErr } = await supabase
      .from('activations')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (gErr) {
      return NextResponse.json({ error: gErr.message }, { status: 500 })
    }
    if (!act || act.user_wallet !== w) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (act.status !== 'active') {
      return NextResponse.json({ error: 'Activation not active' }, { status: 400 })
    }

    const risk = await evaluateActivationRisk(supabase, {
      id: act.id as string,
      user_wallet: act.user_wallet as string,
      max_trades_per_day: act.max_trades_per_day as number,
      max_daily_loss_pct: Number(act.max_daily_loss_pct),
      strategy_version_id: act.strategy_version_id as string,
    })

    if (!risk.ok) {
      return NextResponse.json({ approved: false, reason: risk.reason }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      proposed_size_hint?: string
    }

    return NextResponse.json({
      approved: true,
      activationId: id,
      strategy_version_id: act.strategy_version_id,
      slippage_bps: act.slippage_bps,
      requires_confirmation: act.requires_confirmation,
      hint: body.proposed_size_hint ?? null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
