import { type NextRequest, NextResponse } from 'next/server'

import { requireWallet } from '@/lib/marketplace/wallet-header'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function GET(
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
      .select('user_wallet')
      .eq('id', id)
      .maybeSingle()

    if (gErr) {
      return NextResponse.json({ error: gErr.message }, { status: 500 })
    }
    if (!act || act.user_wallet !== w) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('decision_receipts')
      .select('*')
      .eq('activation_id', id)
      .order('opened_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ receipts: data ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
