import { type NextRequest, NextResponse } from 'next/server'

import { requireWallet } from '@/lib/marketplace/wallet-header'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  validateMarketplaceStrategyPayload,
  type StrategyDraftPayload,
} from '@/lib/marketplace/validate-strategy'
import {
  sealStrategyPayload,
  generateHumanSummary,
} from '@/lib/zerog/private-strategy'
import type { Node } from '@xyflow/react'

function collectIndicatorRefsFromGraph(
  payload: StrategyDraftPayload,
): { indicatorVersionId: string }[] {
  const seen = new Set<string>()
  const out: { indicatorVersionId: string }[] = []
  const nodes = (payload.nodes ?? []) as Node[]
  const configs = payload.configs ?? {}
  for (const n of nodes) {
    const nt = n.data?.nodeType as string | undefined
    if (nt !== 'subgraph_indicator') continue
    const vid = String(configs[n.id]?.indicatorVersionId ?? '').trim()
    if (vid && !seen.has(vid)) {
      seen.add(vid)
      out.push({ indicatorVersionId: vid })
    }
  }
  return out
}

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
      .from('strategies')
      .select(
        'id, creator_wallet, draft_payload, name, description, asset_pairs, tags, risk_level',
      )
      .eq('id', id)
      .maybeSingle()

    if (gErr) {
      return NextResponse.json({ error: gErr.message }, { status: 500 })
    }
    if (!row || row.creator_wallet !== w) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      human_summary?: string
      draft_payload?: StrategyDraftPayload
      indicatorRefs?: { indicatorVersionId: string }[]
    }

    const draft =
      body.draft_payload ??
      (row.draft_payload as StrategyDraftPayload | null) ??
      undefined

    const merged: StrategyDraftPayload = {
      ...draft,
      assetPairs:
        draft?.assetPairs?.length ?
          draft.assetPairs
        : (row.asset_pairs as string[] | undefined),
    }

    const fromGraph = collectIndicatorRefsFromGraph(merged)
    const indicatorRefs = [
      ...(body.indicatorRefs ?? []),
      ...fromGraph,
    ]
    const uniq: { indicatorVersionId: string }[] = []
    const seen = new Set<string>()
    for (const r of indicatorRefs) {
      if (!r.indicatorVersionId || seen.has(r.indicatorVersionId)) continue
      seen.add(r.indicatorVersionId)
      uniq.push(r)
    }

    const v = validateMarketplaceStrategyPayload(merged)
    if (!v.ok) {
      return NextResponse.json({ error: 'Validation failed', errors: v.errors }, { status: 400 })
    }

    const { data: versions } = await supabase
      .from('strategy_versions')
      .select('version_number')
      .eq('strategy_id', id)
      .order('version_number', { ascending: false })
      .limit(1)

    const lastVer = versions?.[0]?.version_number
    const nextNum = typeof lastVer === 'number' ? lastVer + 1 : 1

    merged.indicatorRefs = uniq

    for (const ref of uniq) {
      const { data: iv } = await supabase
        .from('indicator_versions')
        .select('id, indicator_id')
        .eq('id', ref.indicatorVersionId)
        .maybeSingle()
      if (!iv) {
        return NextResponse.json(
          { error: `Unknown indicator version ${ref.indicatorVersionId}` },
          { status: 400 },
        )
      }
      const { data: ind } = await supabase
        .from('indicators')
        .select('status')
        .eq('id', iv.indicator_id as string)
        .maybeSingle()
      if (ind?.status !== 'published') {
        return NextResponse.json(
          { error: 'All indicator dependencies must be published' },
          { status: 400 },
        )
      }
    }

    const compiledPayload = {
      nodes: merged.nodes ?? [],
      edges: merged.edges ?? [],
      configs: merged.configs ?? {},
      regimeGates: merged.regimeGates ?? [],
      assetPairs: merged.assetPairs ?? row.asset_pairs ?? [],
      risk: merged.risk ?? {},
      directionSupport: merged.directionSupport ?? ['swap'],
      indicatorRefs: uniq,
    }

    // Encrypt compiled graph and upload to 0G Storage.
    // The Supabase payload column stores only a marker object; the real logic
    // lives in the ciphertext blob referenced by zerog_root_hash.
    const { rootHash, markerPayload } = await sealStrategyPayload(compiledPayload)

    // Generate a human-readable summary if the caller didn't supply one.
    const humanSummary =
      body.human_summary ??
      (await generateHumanSummary(compiledPayload).catch(() => null))

    const { data: ver, error: vErr } = await supabase
      .from('strategy_versions')
      .insert({
        strategy_id: id,
        version_number: nextNum,
        payload: markerPayload,
        zerog_root_hash: rootHash,
        human_summary: humanSummary,
        validation_status: 'passed',
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

    for (const ref of uniq) {
      await supabase.from('strategy_indicator_dependencies').insert({
        strategy_version_id: versionId,
        indicator_version_id: ref.indicatorVersionId,
      })
    }

    await supabase
      .from('strategies')
      .update({
        current_version_id: versionId,
        status: 'published',
        asset_pairs: compiledPayload.assetPairs,
      })
      .eq('id', id)

    return NextResponse.json({ versionId, versionNumber: nextNum, rootHash })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
