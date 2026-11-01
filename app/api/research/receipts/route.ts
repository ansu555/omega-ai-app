/**
 * /api/research/receipts
 *
 * GET — Returns the authenticated user's ATS Decision Receipt history,
 *        ordered newest first.
 *
 * Query parameters:
 *   limit?  : number — Page size (default 20, max 100)
 *   offset? : number — Pagination offset (default 0)
 *   ticker? : string — Filter by asset ticker (e.g. "BTC")
 *
 * Response: { receipts: DecisionReceipt[], total: number, limit: number, offset: number }
 *
 * Auth: x-wallet-address header (requireWallet helper).
 */

import { type NextRequest, NextResponse } from 'next/server'

import { requireWallet } from '@/lib/marketplace/wallet-header'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const userWallet = requireWallet(req)
  if (userWallet instanceof Response) return userWallet

  const { searchParams } = req.nextUrl

  const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10)
  const limit = Number.isNaN(rawLimit) ? 20 : Math.min(Math.max(rawLimit, 1), 100)

  const rawOffset = parseInt(searchParams.get('offset') ?? '0', 10)
  const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0)

  const tickerFilter = searchParams.get('ticker')?.trim().toUpperCase() || null

  try {
    const supabase = createSupabaseAdminClient()

    let query = supabase
      .from('ats_receipts')
      .select(
        [
          'id',
          'run_id',
          'ticker',
          'created_at',
          'trigger_type',
          'query',
          'chain_id',
          'tx_hash',
          'storage_root_hash',
          'agent_votes',
          'regime',
          'causal_chain',
          'risk_sizing',
          'consensus',
          'research_brief',
          'proof_ref',
        ].join(', '),
        { count: 'exact' },
      )
      .eq('user_wallet', userWallet.toLowerCase())
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (tickerFilter) {
      query = query.eq('ticker', tickerFilter)
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      receipts: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
