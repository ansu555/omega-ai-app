import { type NextRequest, NextResponse } from 'next/server'

import { requireWallet } from '@/lib/marketplace/wallet-header'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const w = requireWallet(req)
  if (w instanceof Response) return w

  try {
    const body = (await req.json()) as {
      activation_id?: string
      strategy_version_id?: string
      mode?: string
      asset_pair?: string
      signal?: unknown
      input_snapshot?: unknown
      risk_checks?: unknown
      execution_request?: unknown
      execution_result?: unknown
      status?: string
      failure_reason?: string
      tx_hash?: string
      fees_native?: string
      slippage_bps_actual?: number
      pnl_native?: string
    }

    if (!body.activation_id || !body.strategy_version_id) {
      return NextResponse.json(
        { error: 'activation_id and strategy_version_id required' },
        { status: 400 },
      )
    }

    const supabase = createSupabaseAdminClient()
    const { data: act, error: aErr } = await supabase
      .from('activations')
      .select('user_wallet, strategy_version_id, mode')
      .eq('id', body.activation_id)
      .maybeSingle()

    if (aErr || !act) {
      return NextResponse.json({ error: 'Activation not found' }, { status: 404 })
    }
    if (act.user_wallet !== w) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (act.strategy_version_id !== body.strategy_version_id) {
      return NextResponse.json({ error: 'Version mismatch' }, { status: 400 })
    }

    const { data: ins, error: iErr } = await supabase
      .from('decision_receipts')
      .insert({
        activation_id: body.activation_id,
        strategy_version_id: body.strategy_version_id,
        mode: body.mode ?? act.mode ?? 'live',
        asset_pair: body.asset_pair ?? null,
        signal: body.signal ?? null,
        input_snapshot: body.input_snapshot ?? null,
        risk_checks: body.risk_checks ?? null,
        execution_request: body.execution_request ?? null,
        execution_result: body.execution_result ?? null,
        status: body.status ?? 'confirmed',
        failure_reason: body.failure_reason ?? null,
        tx_hash: body.tx_hash ?? null,
        fees_native: body.fees_native ?? null,
        slippage_bps_actual: body.slippage_bps_actual ?? null,
        pnl_native: body.pnl_native ?? null,
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
