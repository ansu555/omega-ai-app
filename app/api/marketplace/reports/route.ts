import { type NextRequest, NextResponse } from 'next/server'

import { requireWallet } from '@/lib/marketplace/wallet-header'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const w = requireWallet(req)
  if (w instanceof Response) return w

  try {
    const body = (await req.json()) as {
      target_type?: string
      target_id?: string
      reason?: string
    }
    if (!body.target_type || !body.target_id || !body.reason?.trim()) {
      return NextResponse.json(
        { error: 'target_type, target_id, reason required' },
        { status: 400 },
      )
    }
    if (body.target_type !== 'strategy' && body.target_type !== 'indicator') {
      return NextResponse.json({ error: 'Invalid target_type' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_wallet: w,
        target_type: body.target_type,
        target_id: body.target_id,
        reason: body.reason.trim(),
        status: 'open',
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (body.target_type === 'strategy') {
      await supabase
        .from('strategies')
        .update({ status: 'watch' })
        .eq('id', body.target_id)
    }

    return NextResponse.json({ id: data.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
