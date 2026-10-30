/**
 * Chain Registry — central lookup for all supported chain configs.
 *
 * Default chain: HashKey Chain (lib/chain-registry/chains/hashkey.ts) — mainnet
 * (177) unless NEXT_PUBLIC_HASHKEY_NETWORK=testnet (133). HSKSwap is its DEX.
 *
 * Note: 0G's Storage / Compute / DA remain in use as external agent
 * infrastructure via lib/zerog — independent of this trading-chain registry.
 *
 * To add a new chain:
 *   1. Create lib/chain-registry/chains/<chain>.ts exporting a ChainConfig
 *   2. Import it below and add it to REGISTRY
 *   Done — wallet provider, swap hooks, agent nodes, and explorer links all
 *   pick it up automatically.
 */

import { isNativeTokenAddress } from './types'
import type { BridgeInfo, ChainConfig, DexRouter, TokenInfo } from './types'
import { HASHKEY_CHAIN_ID, hashkeyMainnetConfig, hashkeyTestnetConfig } from './chains/hashkey'

// ── Registry ─────────────────────────────────────────────────────────────────

const REGISTRY: Record<number, ChainConfig> = {
  [hashkeyMainnetConfig.chain.id]: hashkeyMainnetConfig,
  [hashkeyTestnetConfig.chain.id]: hashkeyTestnetConfig,
}

export const DEFAULT_CHAIN_ID: number = HASHKEY_CHAIN_ID

// ── Lookup helpers ────────────────────────────────────────────────────────────

/**
 * Returns the ChainConfig for the given chainId.
 * Throws if the chain has not been registered.
 */
export function getChainConfig(chainId: number): ChainConfig {
  const config = REGISTRY[chainId]
  if (!config) {
    throw new Error(
      `Chain ${chainId} is not registered. ` +
      `Add its config to lib/chain-registry/chains/ and import it in lib/chain-registry/index.ts.`
    )
  }
  return config
}

/** Returns all registered ChainConfig objects */
export function getSupportedChains(): ChainConfig[] {
  return Object.values(REGISTRY)
}

/** Returns the default chain ID (HashKey Chain). */
export function getDefaultChainId(): number {
  return DEFAULT_CHAIN_ID
}

/** Convenience: returns the token map for a given chain */
export function getTokens(chainId: number): Record<string, TokenInfo> {
  return getChainConfig(chainId).tokens
}

/** Convenience: returns the DEX router list for a given chain */
export function getDexRouters(chainId: number): DexRouter[] {
  return getChainConfig(chainId).dexRouters
}

/**
 * Builds a block-explorer URL for the given chain.
 *
 * @example
 *   getExplorerLink(getDefaultChainId(), 'tx', '0xabc…')
 */
export function getExplorerLink(
  chainId: number,
  type: 'tx' | 'address',
  hash: string,
): string {
  const config = getChainConfig(chainId)
  const path = type === 'tx' ? config.explorerTxPath : config.explorerAddressPath
  return `${config.explorerUrl}${path}${hash}`
}

/** Bridges registered for a chain (official first). Empty when none are known. */
export function getBridges(chainId: number): BridgeInfo[] {
  return getChainConfig(chainId).bridges ?? []
}

/**
 * Resolves a token address for on-chain use: the native sentinel becomes the
 * chain's wrapped native (WHSK), everything else passes through. Use this
 * before any quoter / pool / ERC-20 call.
 */
export function resolveTradableAddress(chainId: number, address: string): TokenInfo['address'] {
  const config = getChainConfig(chainId)
  return isNativeTokenAddress(address)
    ? config.nativeWrapped
    : (address as TokenInfo['address'])
}

// ── Re-exports ────────────────────────────────────────────────────────────────

export { NATIVE_TOKEN_ADDRESS, isNativeTokenAddress } from './types'
export type { BridgeInfo, ChainConfig, DexRouter, TokenInfo } from './types'
