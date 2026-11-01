import { type NextRequest, NextResponse } from 'next/server'

import { ensureCreator } from '@/lib/marketplace/creator'
import { requireWallet } from '@/lib/marketplace/wallet-header'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const w = requireWallet(req)
  if (w instanceof Response) return w

  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('strategies')
      .select(
        'id, name, slug, description, status, current_version_id, created_at, updated_at',
      )
      .eq('creator_wallet', w)
      .order('updated_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ strategies: data ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const w = requireWallet(req)
  if (w instanceof Response) return w

  try {
    const body = (await req.json()) as {
      name?: string
      description?: string
    }
    const name = body.name?.trim()
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    await ensureCreator(supabase, w)

    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${crypto.randomUUID().slice(0, 8)}`

    const { data, error } = await supabase
      .from('strategies')
      .insert({
        creator_wallet: w,
        name,
        slug,
        description: body.description?.trim() ?? '',
        status: 'draft',
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ id: data.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
