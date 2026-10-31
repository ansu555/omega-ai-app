/**
 * HashKey Chain canonical bridge (Ethereum L1 ⇄ HashKey Chain L2).
 *
 * HashKey Chain is an OP Stack rollup, so the canonical bridge is the standard
 * L1StandardBridge / L2StandardBridge pair. Everything below was read off-chain
 * on 2026-11-02 rather than copied from docs:
 *
 *   • L2StandardBridge (0x4200…0010) `otherBridge()` → the L1 bridge below, and
 *     that L1 bridge's `otherBridge()` points back at 0x4200…0010. The pair is
 *     confirmed in both directions.
 *   • `SystemConfig.gasPayingToken()` → (0xE7C6…C98a, 18). HashKey Chain runs on
 *     a CUSTOM GAS TOKEN: HSK is native on L2 and an ERC-20 on L1.
 *   • Each L2 token's own `remoteToken()` supplies the L1 pairing in
 *     BRIDGEABLE_ASSETS — the authoritative source, since the bridge mints
 *     against exactly that mapping.
 *   • `depositERC20To(USDT_L1, USDT_L2, to, 1000e6, 200000, 0x)` was simulated
 *     against the live L1 bridge with balance+allowance overridden: it
 *     executes.
 *   • `OptimismPortal.depositERC20Transaction(...)` reverts with
 *     "ERC20: Insufficient allowance" — i.e. it reaches HSK's `transferFrom`,
 *     so the path is live and only needs the approval.
 *
 * Two consequences drive the UI:
 *
 *   1. **ETH cannot be bridged at all.** `depositETH` reverts with
 *      "StandardBridge: cannot bridge ETH with custom gas token" (verified).
 *      Users bridge WETH — the ERC-20 — not native ether.
 *   2. **Withdrawals are not a single transaction.** L2 → L1 is withdraw →
 *      wait out the fault-proof challenge window → prove → finalize, spanning
 *      days and two chains. Deposits are implemented in-app; withdrawals are
 *      handed to the canonical bridge UI, which tracks the claim for the user.
 */

import type { Address } from 'viem'
import { HASHKEY_MAINNET_CHAIN_ID } from '@/lib/chain-registry/chains/hashkey'

/** Ethereum mainnet — the L1 this rollup settles to. */
export const ETHEREUM_CHAIN_ID = 1

// ── L1 contracts (Ethereum mainnet) ─────────────────────────────────────────

export const HASHKEY_L1_CONTRACTS = {
  /** Deposits and (eventually) finalises ERC-20 + gas-token transfers. */
  standardBridge: '0x2171E6d3B7964fA9654Ce41dA8a8fFAff2Cc70be' as Address,
  /** Gas-token deposits and withdrawal proving/finalising. */
  optimismPortal: '0xe7Aa79B59CAc06F9706D896a047fEb9d3BDA8bD3' as Address,
  crossDomainMessenger: '0x899F07862D3A03F70E07b7f01183934b485d2e97' as Address,
  systemConfig: '0x43F8DeFe3E9286D152E91BB16a248808E7247198' as Address,
} as const

// ── L2 contracts (HashKey Chain predeploys) ─────────────────────────────────

export const HASHKEY_L2_CONTRACTS = {
  standardBridge: '0x4200000000000000000000000000000000000010' as Address,
  crossDomainMessenger: '0x4200000000000000000000000000000000000007' as Address,
  toL1MessagePasser: '0x4200000000000000000000000000000000000016' as Address,
} as const

/** HSK as an ERC-20 on Ethereum — the chain's gas-paying token. */
export const L1_HSK_TOKEN = '0xE7C6BF469e97eEB0bFB74C8dbFF5BD47D4C1C98a' as Address

/** Where users complete withdrawals (prove + finalize) and track claims. */
export const CANONICAL_BRIDGE_URL = 'https://bridge.hashkeychain.net'

// ── Bridgeable assets ───────────────────────────────────────────────────────

export type BridgeableAsset = {
  /** Registry key / display symbol on HashKey Chain. */
  symbol: string
  name: string
  decimals: number
  /** Address on Ethereum mainnet. */
  l1Address: Address
  /**
   * Address on HashKey Chain, or `null` for the gas token — HSK arrives as the
   * native coin, so it has no L2 ERC-20 to mint into.
   */
  l2Address: Address | null
  /**
   * `gas-token` routes through OptimismPortal.depositERC20Transaction;
   * `erc20` routes through L1StandardBridge.depositERC20To.
   */
  route: 'gas-token' | 'erc20'
}

/**
 * Only assets whose L1↔L2 pairing was confirmed from the L2 token's own
 * `remoteToken()`. Depositing against a wrong pairing can strand funds
 * permanently, so nothing goes in this list on trust.
 *
 * Deliberately absent: **USDC.e** (0x054e…8D0a). It has no `remoteToken()` —
 * it is not a canonically bridged token, so the standard bridge cannot mint it.
 * It is also effectively unused on-chain (~1.8k supply).
 */
export const BRIDGEABLE_ASSETS: BridgeableAsset[] = [
  {
    symbol: 'HSK',
    name: 'HashKey Platform Token',
    decimals: 18,
    l1Address: L1_HSK_TOKEN,
    l2Address: null,
    route: 'gas-token',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    l1Address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Address,
    l2Address: '0xF1B50eD67A9e2CC94Ad3c477779E2d4cBfFf9029' as Address,
    route: 'erc20',
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    l1Address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address,
    l2Address: '0xefd4bC9afD210517803f293ABABd701CaeeCdfd0' as Address,
    route: 'erc20',
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    l1Address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' as Address,
    l2Address: '0x6119CA49a79f5825C8B345F8d7aC36B272565b14' as Address,
    route: 'erc20',
  },
]

export function getBridgeableAsset(symbol: string): BridgeableAsset | undefined {
  return BRIDGEABLE_ASSETS.find((a) => a.symbol === symbol)
}

/** The bridge only exists for mainnet; testnet uses its own deployment. */
export function isBridgeSupported(chainId: number): boolean {
  return chainId === HASHKEY_MAINNET_CHAIN_ID
}

// ── ABIs ────────────────────────────────────────────────────────────────────

/** L1StandardBridge.depositERC20To — canonical ERC-20 deposit. */
export const L1_STANDARD_BRIDGE_ABI = [
  {
    inputs: [
      { name: '_l1Token', type: 'address' },
      { name: '_l2Token', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_minGasLimit', type: 'uint32' },
      { name: '_extraData', type: 'bytes' },
    ],
    name: 'depositERC20To',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

/** OptimismPortal.depositERC20Transaction — gas-token (HSK) deposit. */
export const OPTIMISM_PORTAL_ABI = [
  {
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_mint', type: 'uint256' },
      { name: '_value', type: 'uint256' },
      { name: '_gasLimit', type: 'uint64' },
      { name: '_isCreation', type: 'bool' },
      { name: '_data', type: 'bytes' },
    ],
    name: 'depositERC20Transaction',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

/** L2StandardBridge.withdrawTo — starts an L2 → L1 withdrawal. */
export const L2_STANDARD_BRIDGE_ABI = [
  {
    inputs: [
      { name: '_l2Token', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_minGasLimit', type: 'uint32' },
      { name: '_extraData', type: 'bytes' },
    ],
    name: 'withdrawTo',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

export const BRIDGE_ERC20_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// ── Transaction builders ────────────────────────────────────────────────────

/**
 * Gas supplied for the L2 half of the deposit. The L2 execution is just a mint
 * + transfer; 200k is the figure the canonical bridge UI uses and it is paid
 * for out of the L1 transaction, not charged separately.
 */
export const DEFAULT_DEPOSIT_L2_GAS = 200_000

export type BridgeTxRequest = {
  address: Address
  abi: readonly unknown[]
  functionName: string
  args: readonly unknown[]
  value?: bigint
}

/** The L1 contract that must hold the allowance for `asset`. */
export function getDepositSpender(asset: BridgeableAsset): Address {
  return asset.route === 'gas-token'
    ? HASHKEY_L1_CONTRACTS.optimismPortal
    : HASHKEY_L1_CONTRACTS.standardBridge
}

/**
 * Builds the L1 deposit. Both routes pull the token with `transferFrom`, so the
 * caller must hold an allowance for `getDepositSpender(asset)` first.
 *
 * Must be sent on Ethereum mainnet.
 */
export function buildDepositTx(params: {
  asset: BridgeableAsset
  recipient: Address
  amount: bigint
  l2Gas?: number
}): BridgeTxRequest {
  const { asset, recipient, amount } = params
  const l2Gas = params.l2Gas ?? DEFAULT_DEPOSIT_L2_GAS
  if (amount <= 0n) throw new Error('Bridge amount must be greater than 0.')

  if (asset.route === 'gas-token') {
    // `_mint` is the HSK pulled on L1; `_value` is the native HSK credited on
    // L2. They match for a plain transfer, with no follow-on call.
    return {
      address: HASHKEY_L1_CONTRACTS.optimismPortal,
      abi: OPTIMISM_PORTAL_ABI,
      functionName: 'depositERC20Transaction',
      args: [recipient, amount, amount, BigInt(l2Gas), false, '0x'],
    }
  }

  if (!asset.l2Address) {
    throw new Error(`${asset.symbol} has no L2 counterpart registered; refusing to bridge.`)
  }

  return {
    address: HASHKEY_L1_CONTRACTS.standardBridge,
    abi: L1_STANDARD_BRIDGE_ABI,
    functionName: 'depositERC20To',
    args: [asset.l1Address, asset.l2Address, recipient, amount, l2Gas, '0x'],
  }
}

/**
 * Builds the L2 half of a withdrawal.
 *
 * Note this only *starts* the withdrawal. It cannot be completed here: the user
 * must wait out the fault-proof challenge window, then prove and finalize on
 * L1. Send them to CANONICAL_BRIDGE_URL, which tracks the pending claim.
 */
export function buildWithdrawTx(params: {
  asset: BridgeableAsset
  recipient: Address
  amount: bigint
  l1Gas?: number
}): BridgeTxRequest {
  const { asset, recipient, amount } = params
  if (amount <= 0n) throw new Error('Bridge amount must be greater than 0.')
  if (!asset.l2Address) {
    throw new Error(
      'Withdrawing native HSK must be done from the canonical bridge, which tracks the proof and finalisation steps.',
    )
  }
  return {
    address: HASHKEY_L2_CONTRACTS.standardBridge,
    abi: L2_STANDARD_BRIDGE_ABI,
    functionName: 'withdrawTo',
    args: [asset.l2Address, recipient, amount, params.l1Gas ?? DEFAULT_DEPOSIT_L2_GAS, '0x'],
  }
}
