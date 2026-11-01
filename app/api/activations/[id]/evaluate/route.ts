import { type NextRequest, NextResponse } from 'next/server'

import { requireWallet } from '@/lib/marketplace/wallet-header'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

/** Placeholder: full evaluation runs BotRunner client-side; server acknowledges request. */
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
      .from('activations')
      .select('user_wallet, status')
      .eq('id', id)
      .maybeSingle()

    if (gErr) {
      return NextResponse.json({ error: gErr.message }, { status: 500 })
    }
    if (!row || row.user_wallet !== w) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (row.status !== 'active') {
      return NextResponse.json({ error: 'Activation not active' }, { status: 400 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      note?: string
    }

    return NextResponse.json({
      ok: true,
      message:
        'Run evaluation in the Agent builder or library UI with this activation id.',
      activationId: id,
      note: body.note ?? null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
