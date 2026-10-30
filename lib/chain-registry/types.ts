import type { Chain } from 'viem/chains'
import type { Address } from 'viem'

/**
 * Sentinel address representing a chain's native gas coin (HSK on HashKey
 * Chain) in token lists and routing. It is NOT a deployed contract — resolve it
 * to the chain's `nativeWrapped` before any on-chain call. Matches the
 * convention used by most aggregators (EIP-7528).
 */
export const NATIVE_TOKEN_ADDRESS =
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as Address

export function isNativeTokenAddress(address: string | undefined): boolean {
  return !!address && address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
}

export interface TokenInfo {
  address: Address
  name: string
  symbol: string
  decimals: number
  logoUrl?: string
  coingeckoId?: string
  /**
   * True for the chain's native gas coin (HSK), which is not an ERC-20.
   * Its `address` is the NATIVE_TOKEN_ADDRESS sentinel — never call
   * balanceOf/approve on it. Routing wraps it to `nativeWrapped`.
   */
  isNative?: boolean
  /**
   * Set when the token is real and verified on-chain but has no usable DEX
   * liquidity, so the UI can warn instead of quoting a swap that will fail or
   * execute at a ruinous price.
   */
  lowLiquidity?: boolean
}

export interface BridgeInfo {
  /** Human-readable label shown in the UI */
  name: string
  /** Where the user completes the bridge */
  url: string
  /** `official` = canonical rollup bridge; `third-party` = independent service */
  kind: 'official' | 'third-party'
  /** One-line description of what it moves */
  description: string
}

export interface DexRouter {
  /** Stable identifier used in code, e.g. "traderjoe" | "pangolin" | "traderjoe_v2" */
  id: string
  /** Human-readable label shown in the UI */
  name: string
  type: 'uniswapV2' | 'traderJoeV2' | 'custom'
  routerAddress: Address
  /** Required for traderJoeV2 — the LBQuoter contract */
  quoterAddress?: Address
}

export interface ChainConfig {
  /** viem Chain object (id, name, nativeCurrency, rpcUrls, etc.) */
  chain: Chain
  /** Wrapped native token address (WHSK, WETH, …) */
  nativeWrapped: Address
  /**
   * Intermediate hop addresses for V1 multi-hop routing.
   * The aggregator tries [tokenIn → hub → tokenOut] for each hub when a
   * direct path has no liquidity.  First entry should be the deepest
   * liquidity hub (typically the wrapped native).
   */
  hubTokens: Address[]
  /** Block explorer base URL, no trailing slash */
  explorerUrl: string
  /** Path segment for transaction links, e.g. "/tx/" */
  explorerTxPath: string
  /** Path segment for address links, e.g. "/address/" */
  explorerAddressPath: string
  /** All DEXes available on this chain, ordered by preference */
  dexRouters: DexRouter[]
  /** Per-chain token list; keys are the canonical symbol used by the app */
  tokens: Record<string, TokenInfo>
  /** OmeSwap deployed pools contract (zero address until deployed) */
  omeswapPools?: Address
  /** OmeSwap deployed router contract (zero address until deployed) */
  omeswapRouter?: Address
  /** Bridges that move assets in and out of this chain, official first */
  bridges?: BridgeInfo[]
}
