import { type NextRequest, NextResponse } from 'next/server'

import { requireWallet } from '@/lib/marketplace/wallet-header'
import {
  createSupabaseAdminClient,
  tryCreateSupabaseAdminClient,
} from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const w = requireWallet(req)
  if (w instanceof Response) return w

  try {
    const supabase = tryCreateSupabaseAdminClient()
    if (!supabase) {
      return NextResponse.json({ activations: [] })
    }
    const { data: acts, error } = await supabase
      .from('activations')
      .select('*')
      .eq('user_wallet', w)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const list = acts ?? []
    const sids = [...new Set(list.map((a) => a.strategy_id as string))]
    let strategyMap: Record<string, { id: string; name: string; status: string }> = {}
    if (sids.length > 0) {
      const { data: strats } = await supabase
        .from('strategies')
        .select('id, name, status')
        .in('id', sids)
      strategyMap = Object.fromEntries(
        (strats ?? []).map((s) => [
          s.id as string,
          {
            id: s.id as string,
            name: s.name as string,
            status: s.status as string,
          },
        ]),
      )
    }

    const enriched = list.map((a) => ({
      ...a,
      strategy: strategyMap[a.strategy_id as string] ?? null,
    }))

    return NextResponse.json({ activations: enriched })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const w = requireWallet(req)
  if (w instanceof Response) return w

  try {
    const body = (await req.json()) as {
      strategy_id?: string
      strategy_version_id?: string
      mode?: string
      allocation_pct?: number
      max_position_pct?: number
      max_trades_per_day?: number
      max_daily_loss_pct?: number
      slippage_bps?: number
      requires_confirmation?: boolean
    }

    if (!body.strategy_id || !body.strategy_version_id) {
      return NextResponse.json(
        { error: 'strategy_id and strategy_version_id required' },
        { status: 400 },
      )
    }

    const supabase = createSupabaseAdminClient()

    const { data: strat, error: sErr } = await supabase
      .from('strategies')
      .select('id, status, current_version_id')
      .eq('id', body.strategy_id)
      .maybeSingle()

    if (sErr || !strat) {
      return NextResponse.json({ error: 'Strategy not found' }, { status: 404 })
    }

    if (strat.status === 'delisted' || strat.status === 'paused') {
      return NextResponse.json(
        { error: 'Strategy not available for activation' },
        { status: 400 },
      )
    }

    const mode = body.mode ?? 'research'
    if (mode === 'live' && strat.status !== 'live_eligible') {
      return NextResponse.json(
        {
          error:
            'Live activation requires live_eligible status (admin approval). Use research mode to explore signals.',
        },
        { status: 400 },
      )
    }
    if (
      mode === 'research' &&
      (strat.status === 'delisted' || strat.status === 'paused')
    ) {
      return NextResponse.json(
        { error: 'Strategy is not available' },
        { status: 400 },
      )
    }

    const { data: ins, error: iErr } = await supabase
      .from('activations')
      .insert({
        user_wallet: w,
        strategy_id: body.strategy_id,
        strategy_version_id: body.strategy_version_id,
        mode: mode === 'research' ? 'research' : 'live',
        allocation_pct: body.allocation_pct ?? 5,
        max_position_pct: body.max_position_pct ?? 2,
        max_trades_per_day: body.max_trades_per_day ?? 3,
        max_daily_loss_pct: body.max_daily_loss_pct ?? 3,
        slippage_bps: body.slippage_bps ?? 75,
        requires_confirmation: body.requires_confirmation ?? true,
        status: 'active',
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
