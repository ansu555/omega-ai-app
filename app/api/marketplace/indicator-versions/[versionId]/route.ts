import { type NextRequest, NextResponse } from 'next/server'

import { createSupabaseAdminClient } from '@/lib/supabase/server'

/** Public payload for executing a published indicator subgraph (client-side BotRunner). */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ versionId: string }> },
) {
  try {
    const { versionId } = await ctx.params
    const supabase = createSupabaseAdminClient()
    const { data: ver, error: vErr } = await supabase
      .from('indicator_versions')
      .select('id, payload, input_schema, output_handle, indicator_id')
      .eq('id', versionId)
      .maybeSingle()

    if (vErr) {
      return NextResponse.json({ error: vErr.message }, { status: 500 })
    }
    if (!ver) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: ind } = await supabase
      .from('indicators')
      .select('status')
      .eq('id', ver.indicator_id as string)
      .maybeSingle()

    if (ind?.status !== 'published') {
      return NextResponse.json({ error: 'Not available' }, { status: 403 })
    }

    return NextResponse.json({
      versionId: ver.id,
      payload: ver.payload,
      input_schema: ver.input_schema,
      output_handle: ver.output_handle,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
