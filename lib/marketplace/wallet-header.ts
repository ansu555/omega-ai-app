import { type NextRequest } from 'next/server'

import {
  isValidWalletAddress,
  normalizeWalletAddress,
} from '@/lib/onboarding'

const HEADER = 'x-wallet-address'

export function getWalletFromRequest(req: NextRequest): string | null {
  const raw = req.headers.get(HEADER)
  if (!raw || !isValidWalletAddress(raw)) return null
  return normalizeWalletAddress(raw)
}

export function requireWallet(req: NextRequest): string | Response {
  const w = getWalletFromRequest(req)
  if (!w) {
    return new Response(
      JSON.stringify({ error: `Missing or invalid ${HEADER} header` }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }
  return w
}

export { HEADER as WALLET_HEADER }
