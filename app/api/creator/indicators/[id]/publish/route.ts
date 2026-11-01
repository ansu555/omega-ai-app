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
    const { data: row, error: gErr } = await supabase
      .from('indicators')
      .select('id, creator_wallet, draft_payload, output_type')
      .eq('id', id)
      .maybeSingle()

    if (gErr) {
      return NextResponse.json({ error: gErr.message }, { status: 500 })
    }
    if (!row || row.creator_wallet !== w) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      draft_payload?: IndicatorDraftPayload
    }
    const draft =
      body.draft_payload ??
      (row.draft_payload as IndicatorDraftPayload | null) ??
      undefined

    const v = validateIndicatorPayload(draft)
    if (!v.ok) {
      return NextResponse.json({ error: 'Validation failed', errors: v.errors }, { status: 400 })
    }

    const { data: versions } = await supabase
      .from('indicator_versions')
      .select('version_number')
      .eq('indicator_id', id)
      .order('version_number', { ascending: false })
      .limit(1)

    const lastVer = versions?.[0]?.version_number
    const nextNum = typeof lastVer === 'number' ? lastVer + 1 : 1

    const outputHandle = draft!.outputHandle ?? 'out'
    const payload = {
      nodes: draft!.nodes ?? [],
      edges: draft!.edges ?? [],
      configs: draft!.configs ?? {},
      outputNodeId: draft!.outputNodeId,
      outputHandle,
    }

    const { data: ver, error: vErr } = await supabase
      .from('indicator_versions')
      .insert({
        indicator_id: id,
        version_number: nextNum,
        payload,
        input_schema: draft!.inputSchema ?? [],
        output_handle: outputHandle,
      })
      .select('id')
      .single()

    if (vErr || !ver) {
      return NextResponse.json(
        { error: vErr?.message ?? 'Version insert failed' },
        { status: 500 },
      )
    }

    const versionId = ver.id as string

    await supabase
      .from('indicators')
      .update({
        current_version_id: versionId,
        status: 'published',
      })
      .eq('id', id)

    return NextResponse.json({ versionId, versionNumber: nextNum })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
