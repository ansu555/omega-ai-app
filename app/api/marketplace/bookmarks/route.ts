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
      return NextResponse.json({ bookmarks: [] })
    }
    const { data, error } = await supabase
      .from('bookmarks')
      .select('strategy_id, created_at')
      .eq('user_wallet', w)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ bookmarks: data ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const w = requireWallet(req)
  if (w instanceof Response) return w

  try {
    const body = (await req.json()) as { strategy_id?: string }
    if (!body.strategy_id) {
      return NextResponse.json({ error: 'strategy_id required' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('bookmarks').upsert(
      {
        user_wallet: w,
        strategy_id: body.strategy_id,
      },
      { onConflict: 'user_wallet,strategy_id' },
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const w = requireWallet(req)
  if (w instanceof Response) return w

  try {
    const { searchParams } = new URL(req.url)
    const strategyId = searchParams.get('strategy_id')
    if (!strategyId) {
      return NextResponse.json({ error: 'strategy_id required' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('user_wallet', w)
      .eq('strategy_id', strategyId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
