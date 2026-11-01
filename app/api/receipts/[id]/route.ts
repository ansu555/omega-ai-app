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
    const { data: rec, error: rErr } = await supabase
      .from('decision_receipts')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (rErr) {
      return NextResponse.json({ error: rErr.message }, { status: 500 })
    }
    if (!rec?.activation_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: act } = await supabase
      .from('activations')
      .select('user_wallet')
      .eq('id', rec.activation_id as string)
      .maybeSingle()

    if (!act || act.user_wallet !== w) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ receipt: rec })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
