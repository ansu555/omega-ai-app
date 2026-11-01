/**
 * GET /api/marketplace/strategies/[id]/access
 *
 * Checks whether the requesting wallet has access to a strategy.
 *
 * Response shape:
 *   {
 *     hasAccess: boolean,   // true if the user may activate this strategy
 *     isPaid: boolean,      // false = free strategy; true = requires purchase
 *     price?: {
 *       amount: number,
 *       token: string,      // 'OG' | 'USDC'
 *     },
 *     purchase?: {          // present when hasAccess && isPaid
 *       tx_hash: string,
 *       verified_at: string,
 *       created_at: string,
 *     },
 *   }
 *
 * Wallet header is optional — free strategies return hasAccess: true
 * without requiring authentication.
 */

import { type NextRequest, NextResponse } from 'next/server'

import { getWalletFromRequest } from '@/lib/marketplace/wallet-header'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { isSupabaseSchemaUnavailableError } from '@/lib/marketplace/supabase-read-fallback'

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id: strategyId } = await ctx.params
    const userWallet = getWalletFromRequest(req)

    const supabase = createSupabaseAdminClient()

    const { data: strategy, error: sErr } = await supabase
      .from('strategies')
      .select('id, is_free, price_amount, price_token, status')
      .eq('id', strategyId)
      .maybeSingle()

    if (sErr) {
      if (isSupabaseSchemaUnavailableError(sErr)) {
        return NextResponse.json({ hasAccess: false, isPaid: false })
      }
      return NextResponse.json({ error: sErr.message }, { status: 500 })
    }
    if (!strategy) {
      return NextResponse.json({ error: 'Strategy not found' }, { status: 404 })
    }

    // Free strategy — everyone has access regardless of wallet.
    if (strategy.is_free) {
      return NextResponse.json({ hasAccess: true, isPaid: false })
    }

    const price = {
      amount: Number(strategy.price_amount ?? 0),
      token: (strategy.price_token as string) ?? 'OG',
    }

    // Paid strategy, no wallet provided — report access denied but include price.
    if (!userWallet) {
      return NextResponse.json({ hasAccess: false, isPaid: true, price })
    }

    // Check for a verified purchase for this wallet.
    const { data: purchase, error: pErr } = await supabase
      .from('strategy_purchases')
      .select('id, tx_hash, verified_at, created_at')
      .eq('strategy_id', strategyId)
      .eq('user_wallet', userWallet.toLowerCase())
      .not('verified_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (pErr) {
      if (isSupabaseSchemaUnavailableError(pErr)) {
        return NextResponse.json({ hasAccess: false, isPaid: true, price })
      }
      return NextResponse.json({ error: pErr.message }, { status: 500 })
    }

    if (purchase) {
      return NextResponse.json({
        hasAccess: true,
        isPaid: true,
        price,
        purchase: {
          tx_hash: purchase.tx_hash,
          verified_at: purchase.verified_at,
          created_at: purchase.created_at,
        },
      })
    }

    return NextResponse.json({ hasAccess: false, isPaid: true, price })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
