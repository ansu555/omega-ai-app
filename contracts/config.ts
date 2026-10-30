/**
 * contracts/config.ts — thin re-export shim.
 *
 * All values are sourced from the chain registry so this stays the single
 * backward-compatible import point for the rest of the codebase. To change
 * addresses, update the active chain config in lib/chain-registry/chains/.
 *
 * Default chain: the registry default (HashKey Chain).
 */

import { getChainConfig, getDefaultChainId } from '@/lib/chain-registry'
import type { Address } from 'viem'

const _cfg = getChainConfig(getDefaultChainId())
const _rt = _cfg.tokens

// ── OmeSwap contracts ─────────────────────────────────────────────────────────

export const CONTRACT_ADDRESSES = {
  POOLS: (_cfg.omeswapPools ?? '0x0000000000000000000000000000000000000000') as Address,
  ROUTER: (_cfg.omeswapRouter ?? '0x0000000000000000000000000000000000000000') as Address,
}

/** Wrapped native token address for the active chain (e.g. WHSK on HashKey Chain). */
export const WRAPPED_NATIVE_ADDRESS = _cfg.nativeWrapped

// ── Token addresses ───────────────────────────────────────────────────────────

export const TOKEN_ADDRESSES: {
  [key: string]: {
    address: Address
    name: string
    symbol: string
    decimals: number
    /** Native gas coin (HSK) — sentinel address, never an ERC-20 call target. */
    isNative?: boolean
    /** Verified on-chain but without usable DEX liquidity. */
    lowLiquidity?: boolean
  }
} = {
  // Live chain tokens from the registry (HashKey Chain: HSK, WHSK, USDT, WETH, WBTC, USDC.e).
  ...Object.fromEntries(
    Object.entries(_rt).map(([key, t]) => [
      key,
      {
        address: t.address,
        name: t.name,
        symbol: t.symbol,
        decimals: t.decimals,
        isNative: t.isNative,
        lowLiquidity: t.lowLiquidity,
      },
    ]),
  ),
  // OmeSwap native tokens (OmE / USDO) appear here once added to the active
  // chain's `tokens` in lib/chain-registry/chains/hashkey.ts after deployment.
}

export const TOKENS = TOKEN_ADDRESSES
export const MAINNET_TOKENS = TOKEN_ADDRESSES

export const TOKEN_LIST = Object.values(TOKEN_ADDRESSES)
