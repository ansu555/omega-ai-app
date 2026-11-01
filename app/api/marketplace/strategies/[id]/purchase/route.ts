/**
 * POST /api/marketplace/strategies/[id]/purchase
 *
 * Records an on-chain purchase of a paid strategy.
 *
 * Flow:
 *   1. Client sends { tx_hash } after broadcasting a payment tx to the treasury.
 *   2. Server fetches the strategy to confirm it is paid + get expected price.
 *   3. viem verifies the tx on the app's default chain:
 *        – receipt.status must be 'success'
 *        – receipt.to must match NEXT_PUBLIC_TREASURY_WALLET (case-insensitive)
 *   4. Row inserted into strategy_purchases with verified_at = now().
 *   5. Returns { access: true }.
 *
 * Requires: x-wallet-address header (buyer's EVM address).
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, isAddressEqual, type Address } from 'viem'

import { requireWallet } from '@/lib/marketplace/wallet-header'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { isSupabaseSchemaUnavailableError } from '@/lib/marketplace/supabase-read-fallback'
import { getChainConfig, getDefaultChainId } from '@/lib/chain-registry'

const TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_WALLET as Address | undefined

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const walletOrResponse = requireWallet(req)
  if (walletOrResponse instanceof Response) return walletOrResponse
  const userWallet = walletOrResponse

  try {
    const { id: strategyId } = await ctx.params
    const body = (await req.json().catch(() => ({}))) as { tx_hash?: string }
    const txHash = body.tx_hash?.trim()

    if (!txHash) {
      return NextResponse.json({ error: 'Missing tx_hash in request body' }, { status: 400 })
    }

    if (!TREASURY_WALLET) {
      return NextResponse.json(
        { error: 'Treasury wallet not configured on server' },
        { status: 500 },
      )
    }

    const supabase = createSupabaseAdminClient()

    // Fetch the strategy to confirm it exists and is paid.
    const { data: strategy, error: sErr } = await supabase
      .from('strategies')
      .select('id, name, is_free, price_amount, price_token, status')
      .eq('id', strategyId)
      .maybeSingle()

    if (sErr) {
      if (isSupabaseSchemaUnavailableError(sErr)) {
        return NextResponse.json({ error: 'Marketplace not available' }, { status: 503 })
      }
      return NextResponse.json({ error: sErr.message }, { status: 500 })
    }
    if (!strategy) {
      return NextResponse.json({ error: 'Strategy not found' }, { status: 404 })
    }
    if (strategy.is_free) {
      return NextResponse.json(
        { error: 'Strategy is free — no purchase required' },
        { status: 400 },
      )
    }

    // Check for duplicate tx_hash to prevent double-recording.
    const { data: existing } = await supabase
      .from('strategy_purchases')
      .select('id')
      .eq('tx_hash', txHash)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ access: true, alreadyRecorded: true })
    }

    // Verify the transaction on-chain via viem (on the app's default chain).
    const chainCfg = getChainConfig(getDefaultChainId())
    const client = createPublicClient({
      chain: chainCfg.chain,
      transport: http(chainCfg.chain.rpcUrls.default.http[0]),
    })

    let receipt: Awaited<ReturnType<typeof client.getTransactionReceipt>>
    try {
      receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` })
    } catch (viemErr) {
      const msg = viemErr instanceof Error ? viemErr.message : String(viemErr)
      return NextResponse.json(
        { error: `Could not fetch transaction receipt: ${msg}` },
        { status: 422 },
      )
    }

    if (receipt.status !== 'success') {
      return NextResponse.json({ error: 'Transaction did not succeed on-chain' }, { status: 422 })
    }

    if (!receipt.to) {
      return NextResponse.json({ error: 'Transaction has no recipient' }, { status: 422 })
    }

    if (!isAddressEqual(receipt.to as Address, TREASURY_WALLET)) {
      return NextResponse.json(
        { error: 'Transaction recipient does not match treasury wallet' },
        { status: 422 },
      )
    }

    // Resolve the current published version for reference.
    const { data: versionRow } = await supabase
      .from('strategies')
      .select('current_version_id')
      .eq('id', strategyId)
      .maybeSingle()
    const strategyVersionId = (versionRow?.current_version_id as string | null) ?? null

    // Insert verified purchase record.
    const { error: insertErr } = await supabase.from('strategy_purchases').insert({
      user_wallet: userWallet.toLowerCase(),
      strategy_id: strategyId,
      strategy_version_id: strategyVersionId,
      tx_hash: txHash,
      amount_paid: strategy.price_amount ?? null,
      token_paid: strategy.price_token ?? null,
      chain_id: chainCfg.chain.id,
      verified_at: new Date().toISOString(),
    })

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({ access: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
