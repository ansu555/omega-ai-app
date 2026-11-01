import { type NextRequest, NextResponse } from 'next/server'

import { isAdminWallet } from '@/lib/admin'
import { getWalletFromRequest } from '@/lib/marketplace/wallet-header'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const w = getWalletFromRequest(req)
  if (!isAdminWallet(w)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('strategies')
      .select(
        'id, name, status, creator_wallet, current_version_id, created_at',
      )
      .neq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ strategies: data ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
