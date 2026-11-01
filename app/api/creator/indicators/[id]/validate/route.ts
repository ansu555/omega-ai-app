import { type NextRequest, NextResponse } from 'next/server'

import { requireWallet } from '@/lib/marketplace/wallet-header'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  validateIndicatorPayload,
  type IndicatorDraftPayload,
} from '@/lib/marketplace/validate-strategy'

export async function POST(
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
      .select('creator_wallet, draft_payload')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!row || row.creator_wallet !== w) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      draft_payload?: IndicatorDraftPayload
    }
    const payload =
      body.draft_payload ??
      (row.draft_payload as IndicatorDraftPayload | null) ??
      undefined

    const v = validateIndicatorPayload(payload)
    if (!v.ok) {
      return NextResponse.json({ valid: false, errors: v.errors })
    }

    return NextResponse.json({ valid: true, errors: [] as string[] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
