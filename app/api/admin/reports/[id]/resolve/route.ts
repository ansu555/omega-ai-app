import { type NextRequest, NextResponse } from 'next/server'

import { isAdminWallet } from '@/lib/admin'
import { getWalletFromRequest } from '@/lib/marketplace/wallet-header'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const w = getWalletFromRequest(req)
  if (!isAdminWallet(w)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await ctx.params
    const supabase = createSupabaseAdminClient()
    const { error: uErr } = await supabase
      .from('reports')
      .update({ status: 'resolved' })
      .eq('id', id)

    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 })
    }

    await supabase.from('admin_actions').insert({
      admin_wallet: w!,
      action_type: 'resolve_report',
      target_type: 'report',
      target_id: id,
      notes: null,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
