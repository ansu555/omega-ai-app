import { type NextRequest, NextResponse } from 'next/server'

import { requireWallet } from '@/lib/marketplace/wallet-header'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import type { StrategyDraftPayload } from '@/lib/marketplace/validate-strategy'

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
      .from('strategies')
      .select('id, creator_wallet, status')
      .eq('id', id)
      .maybeSingle()

    if (gErr) {
      return NextResponse.json({ error: gErr.message }, { status: 500 })
    }
    if (!row || row.creator_wallet !== w) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (row.status === 'delisted') {
      return NextResponse.json({ error: 'Cannot edit delisted strategy' }, { status: 400 })
    }

    const body = (await req.json()) as {
      name?: string
      description?: string
      tags?: string[]
      asset_pairs?: string[]
      risk_level?: string
      regime_gates?: string[]
      draft_payload?: StrategyDraftPayload
    }

    const patch: Record<string, unknown> = {}
    if (body.name !== undefined) patch.name = body.name.trim()
    if (body.description !== undefined) patch.description = body.description
    if (body.tags !== undefined) patch.tags = body.tags
    if (body.asset_pairs !== undefined) patch.asset_pairs = body.asset_pairs
    if (body.risk_level !== undefined) patch.risk_level = body.risk_level
    if (body.draft_payload !== undefined) {
      const dp = { ...body.draft_payload }
      if (body.regime_gates !== undefined) {
        dp.regimeGates = body.regime_gates
      }
      patch.draft_payload = dp
    } else if (body.regime_gates !== undefined) {
      const { data: cur } = await supabase
        .from('strategies')
        .select('draft_payload')
        .eq('id', id)
        .single()
      const prev = (cur?.draft_payload ?? {}) as StrategyDraftPayload
      patch.draft_payload = { ...prev, regimeGates: body.regime_gates }
    }

    const { error: uErr } = await supabase
      .from('strategies')
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

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const w = requireWallet(req)
  if (w instanceof Response) return w

  try {
    const { id } = await ctx.params
    const supabase = createSupabaseAdminClient()
    const { data: row, error } = await supabase
      .from('strategies')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!row || row.creator_wallet !== w) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ strategy: row })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
