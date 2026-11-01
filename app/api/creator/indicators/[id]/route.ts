import { type NextRequest, NextResponse } from 'next/server'

import { requireWallet } from '@/lib/marketplace/wallet-header'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import type { IndicatorDraftPayload } from '@/lib/marketplace/validate-strategy'

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
      .from('indicators')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!row || row.creator_wallet !== w) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ indicator: row })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

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
      .from('indicators')
      .select('id, creator_wallet, status')
      .eq('id', id)
      .maybeSingle()

    if (gErr) {
      return NextResponse.json({ error: gErr.message }, { status: 500 })
    }
    if (!row || row.creator_wallet !== w) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await req.json()) as {
      name?: string
      description?: string
      output_type?: string
      draft_payload?: IndicatorDraftPayload
    }

    const patch: Record<string, unknown> = {}
    if (body.name !== undefined) patch.name = body.name.trim()
    if (body.description !== undefined) patch.description = body.description
    if (body.output_type !== undefined) patch.output_type = body.output_type
    if (body.draft_payload !== undefined) patch.draft_payload = body.draft_payload

    const { error: uErr } = await supabase
      .from('indicators')
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
