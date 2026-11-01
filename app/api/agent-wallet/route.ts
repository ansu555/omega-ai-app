/**
 * /api/agent-wallet
 *
 * GET  — Returns the user's agent wallet address, native balance, and
 *         initialisation status.
 *
 * POST — Initialises the agent wallet for the authenticated user if it
 *         doesn't exist yet. Idempotent: calling POST on an already-
 *         initialised wallet is a no-op and returns the existing address.
 *
 * Auth: x-wallet-address header (requireWallet helper).
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, formatEther } from 'viem'

import { requireWallet } from '@/lib/marketplace/wallet-header'
import { getOrCreateAgentWallet, getAgentAddress } from '@/lib/agent-wallet/manager'
import { getChainConfig, DEFAULT_CHAIN_ID } from '@/lib/chain-registry'

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const userWallet = requireWallet(req)
  if (userWallet instanceof Response) return userWallet

  try {
    const chainId = parseChainId(req) ?? DEFAULT_CHAIN_ID
    const agentAddress = await getAgentAddress(userWallet)

    if (!agentAddress) {
      return NextResponse.json(
        { isInitialized: false, address: null, balance: null, chainId },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const chainConfig = getChainConfig(chainId)
    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.chain.rpcUrls.default.http[0]),
    })

    const rawBalance = await publicClient.getBalance({
      address: agentAddress as `0x${string}`,
    })

    return NextResponse.json(
      {
        isInitialized: true,
        address: agentAddress,
        balance: formatEther(rawBalance),
        chainId,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    return jsonError(e)
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const userWallet = requireWallet(req)
  if (userWallet instanceof Response) return userWallet

  try {
    const body = await safeJson<{ chainId?: number }>(req)
    const chainId = body?.chainId ?? DEFAULT_CHAIN_ID

    const { address } = await getOrCreateAgentWallet(userWallet, chainId)

    return NextResponse.json({ address, chainId }, { status: 201 })
  } catch (e) {
    return jsonError(e)
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseChainId(req: NextRequest): number | null {
  const raw = req.nextUrl.searchParams.get('chainId')
  if (!raw) return null
  const n = parseInt(raw, 10)
  return isNaN(n) ? null : n
}

async function safeJson<T>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}

function jsonError(e: unknown): NextResponse {
  const msg = e instanceof Error ? e.message : String(e)
  return NextResponse.json({ error: msg }, { status: 500 })
}
