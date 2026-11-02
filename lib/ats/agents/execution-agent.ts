/**
 * ATS Execution Agent — chain-aware on-chain swap builder.
 *
 * Handles the final execution step after consensus + risk approval:
 *   - Resolves the correct token addresses from the chain registry
 *   - Chooses V2 (UniswapV2-compatible) or V3 (Uniswap V3) execution path
 *     based on the chain's DEX router type
 *   - Approves ERC-20 tokens if needed (ERC20 `approve`)
 *   - Signs and submits the swap using the agent burner wallet (viem)
 *
 * Router dispatch (by the chain's primary router type in the registry):
 *   type 'uniswapV2' → UniswapV2 `swapExactTokensForTokens`
 *   type 'custom'    → Uniswap V3 `exactInputSingle` (e.g. HSKSwap on HashKey Chain)
 *
 * Emits:
 *   agent.thinking      — start
 *   execution.pending   — about to sign
 *   execution.done      — tx submitted (or pending/error)
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  type Address,
} from 'viem'
import type { RunEvent, RiskSizing } from '@/lib/ats/types'
import { getOrCreateAgentWallet } from '@/lib/agent-wallet/manager'
import { getChainConfig } from '@/lib/chain-registry'
import { ERC20_ABI } from '@/lib/uniswap/constants'
import { executeHSKSwapAgentSwap } from '@/lib/dex/hskswap'

// ── Result type ───────────────────────────────────────────────────────────────

export interface ExecutionAgentResult {
  tx_hash: string | null
  status: 'submitted' | 'pending_deployment' | 'failed' | 'skipped'
  amount_in_usd: number
  token_in: string
  token_out: string
  chain_id: number
  error?: string
}

// ── UniswapV2 ABI (0G DEX compatible) ────────────────────────────────────────

const UNISWAPV2_ROUTER_ABI = [
  {
    name: 'swapExactTokensForTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'swapExactETHForTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'swapExactTokensForETH',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
] as const

// ── Slippage ──────────────────────────────────────────────────────────────────

const SLIPPAGE_BPS = 200n  // 2% slippage tolerance

function withSlippage(amount: bigint): bigint {
  return (amount * (10000n - SLIPPAGE_BPS)) / 10000n
}

// ── Placeholder detection ─────────────────────────────────────────────────────

function isPlaceholderAddress(addr: string): boolean {
  const lower = addr.toLowerCase()
  return (
    lower === '0x0000000000000000000000000000000000000000' ||
    lower.startsWith('0x000000000000000000000000000000000000000')
  )
}

// ── Token resolution ──────────────────────────────────────────────────────────

const TICKER_ALIAS: Record<string, string> = {
  BTC: 'WBTC',
  ETH: 'WETH',
  ETHER: 'WETH',
  BITCOIN: 'WBTC',
  HSK: 'WHSK',
  HASHKEY: 'WHSK',
}

function resolveTokenSymbol(ticker: string): string {
  const upper = ticker.toUpperCase()
  return TICKER_ALIAS[upper] ?? upper
}

// ── Stable leg resolution ─────────────────────────────────────────────────────

type RegistryToken = ReturnType<typeof getChainConfig>['tokens'][string]

/**
 * Candidate stable symbols in order of preference. The first one that exists
 * in the chain registry, has a real (non-placeholder) address and is NOT
 * flagged `lowLiquidity` wins.
 *
 * This must never be hardcoded. On HashKey Chain the registry's `USDC` entry
 * is bridged USDC.e — a real, verified contract whose only HSKSwap pool holds
 * roughly $0.08 — so QuoterV2 returns no route against it and every agent
 * trade fails with "no pool with liquidity". USDT is the actual quote hub
 * there (WHSK/USDT, WETH/USDT, WBTC/USDT). Picking the stable from the
 * registry keeps this correct as liquidity moves or new chains are added.
 */
const STABLE_PREFERENCE = ['USDT', 'USDC', 'USDbC', 'DAI'] as const

function resolveStableLeg(
  chainConfig: ReturnType<typeof getChainConfig>,
): { symbol: string; info: RegistryToken } | null {
  for (const symbol of STABLE_PREFERENCE) {
    const info = chainConfig.tokens[symbol]
    if (!info) continue
    if (isPlaceholderAddress(info.address)) continue
    if (info.lowLiquidity) continue
    return { symbol, info }
  }
  return null
}

/** Best-effort stable symbol for labelling an error before a chain is resolved. */
function stableLabel(chainId: number): string {
  try {
    return resolveStableLeg(getChainConfig(chainId))?.symbol ?? 'USDT'
  } catch {
    return 'USDT'
  }
}

// ── V3 execution path (Ethereum mainnet) ─────────────────────────────────────

async function executeV3Swap(
  decision: 'BUY' | 'SELL',
  ticker: string,
  sizing: RiskSizing,
  agentWallet: { address: string; account: import('viem/accounts').PrivateKeyAccount },
  chainConfig: ReturnType<typeof getChainConfig>,
): Promise<ExecutionAgentResult> {
  const router = chainConfig.dexRouters.find((r) => r.type === 'custom')
  if (!router) {
    return { tx_hash: null, status: 'failed', amount_in_usd: 0, token_in: 'unknown', token_out: 'unknown', chain_id: chainConfig.chain.id, error: 'No V3 DEX router configured for this chain.' }
  }

  const tokenSymbol = resolveTokenSymbol(ticker)
  const stable = resolveStableLeg(chainConfig)

  const tokenInfo = chainConfig.tokens[tokenSymbol]
  const stableInfo = stable?.info

  if (!tokenInfo) {
    return {
      tx_hash: null, status: 'failed',
      amount_in_usd: 0, token_in: 'unknown', token_out: 'unknown',
      chain_id: chainConfig.chain.id,
      error: `Token ${tokenSymbol} not found in chain registry for chain ${chainConfig.chain.id}.`,
    }
  }

  if (!stableInfo) {
    return {
      tx_hash: null, status: 'failed',
      amount_in_usd: 0, token_in: 'unknown', token_out: 'unknown',
      chain_id: chainConfig.chain.id,
      error:
        `No tradable stable configured for chain ${chainConfig.chain.id}. ` +
        `Tried ${STABLE_PREFERENCE.join(', ')} — all are missing, placeholders, ` +
        `or flagged lowLiquidity.`,
    }
  }

  if (tokenInfo.lowLiquidity) {
    return {
      tx_hash: null, status: 'failed',
      amount_in_usd: 0, token_in: 'unknown', token_out: 'unknown',
      chain_id: chainConfig.chain.id,
      error:
        `${tokenInfo.symbol} is flagged lowLiquidity on chain ` +
        `${chainConfig.chain.id} — refusing to execute at a ruinous price.`,
    }
  }

  const [tokenIn, tokenOut] = decision === 'BUY'
    ? [stableInfo, tokenInfo]
    : [tokenInfo, stableInfo]

  const rpcUrl = chainConfig.chain.rpcUrls.default.http[0]
  const publicClient = createPublicClient({ chain: chainConfig.chain, transport: http(rpcUrl) })

  // Check tokenIn balance
  const balanceRaw = await publicClient.readContract({
    address: tokenIn.address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [agentWallet.account.address],
  }) as bigint

  const balance = parseFloat(formatUnits(balanceRaw, tokenIn.decimals))
  const amountInUsd = Math.min(sizing.size_usd, balance > 0 ? balance : sizing.size_usd)

  if (balance < 1) {
    return {
      tx_hash: null, status: 'failed',
      amount_in_usd: amountInUsd, token_in: tokenIn.symbol, token_out: tokenOut.symbol,
      chain_id: chainConfig.chain.id,
      error: `Insufficient ${tokenIn.symbol} balance (${balance.toFixed(4)}). Fund the agent wallet first.`,
    }
  }

  const amountIn = parseUnits(Math.min(amountInUsd, balance).toFixed(tokenIn.decimals), tokenIn.decimals)

  // Quote (best fee tier) → approve → exactInputSingle, via the HSKSwap adapter.
  // The adapter derives amountOutMinimum from a live QuoterV2 quote, so it is
  // correct for any decimal/price ratio (unlike a naive 1:1 minimum).
  try {
    const result = await executeHSKSwapAgentSwap({
      account: agentWallet.account,
      chain: chainConfig.chain,
      rpcUrl,
      tokenIn: { address: tokenIn.address as Address, symbol: tokenIn.symbol, decimals: tokenIn.decimals },
      tokenOut: { address: tokenOut.address as Address, symbol: tokenOut.symbol, decimals: tokenOut.decimals },
      amountIn,
      slippageBps: Number(SLIPPAGE_BPS),
      swapRouter: router.routerAddress,
      quoter: router.quoterAddress,
    })

    return {
      tx_hash: result.txHash,
      status: 'submitted',
      amount_in_usd: amountInUsd,
      token_in: tokenIn.symbol,
      token_out: tokenOut.symbol,
      chain_id: chainConfig.chain.id,
    }
  } catch (err) {
    return {
      tx_hash: null,
      status: 'failed',
      amount_in_usd: amountInUsd,
      token_in: tokenIn.symbol,
      token_out: tokenOut.symbol,
      chain_id: chainConfig.chain.id,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ── V2 execution path (0G DEX) ────────────────────────────────────────────────

async function executeV2Swap(
  decision: 'BUY' | 'SELL',
  ticker: string,
  sizing: RiskSizing,
  agentWallet: { address: string; account: import('viem/accounts').PrivateKeyAccount },
  chainConfig: ReturnType<typeof getChainConfig>,
): Promise<ExecutionAgentResult> {
  const router = chainConfig.dexRouters.find((r) => r.type === 'uniswapV2')
  if (!router || isPlaceholderAddress(router.routerAddress)) {
    return {
      tx_hash: null,
      status: 'pending_deployment',
      amount_in_usd: sizing.size_usd,
      token_in: decision === 'BUY' ? stableLabel(chainConfig.chain.id) : resolveTokenSymbol(ticker),
      token_out: decision === 'BUY' ? resolveTokenSymbol(ticker) : stableLabel(chainConfig.chain.id),
      chain_id: chainConfig.chain.id,
      error: `No UniswapV2 router configured for chain ${chainConfig.chain.id}. Trade queued — add a router to the chain registry to enable execution.`,
    }
  }

  const tokenSymbol = resolveTokenSymbol(ticker)
  const stable = resolveStableLeg(chainConfig)
  const stableSymbol = stable?.symbol ?? 'USDT'

  const tokenInfo = chainConfig.tokens[tokenSymbol]
  const stableInfo = stable?.info

  if (!tokenInfo || isPlaceholderAddress(tokenInfo.address)) {
    return {
      tx_hash: null, status: 'pending_deployment',
      amount_in_usd: sizing.size_usd,
      token_in: decision === 'BUY' ? stableSymbol : tokenSymbol,
      token_out: decision === 'BUY' ? tokenSymbol : stableSymbol,
      chain_id: chainConfig.chain.id,
      error: `Token ${tokenSymbol} address not yet deployed on chain ${chainConfig.chain.id}.`,
    }
  }

  const [tokenIn, tokenOut] = decision === 'BUY'
    ? [stableInfo ?? tokenInfo, tokenInfo]
    : [tokenInfo, stableInfo ?? tokenInfo]

  const rpcUrl = chainConfig.chain.rpcUrls.default.http[0]
  const publicClient = createPublicClient({ chain: chainConfig.chain, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account: agentWallet.account, chain: chainConfig.chain, transport: http(rpcUrl) })

  const balanceRaw = await publicClient.readContract({
    address: tokenIn.address as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [agentWallet.account.address],
  }) as bigint

  const balance = parseFloat(formatUnits(balanceRaw, tokenIn.decimals))
  const amountInUsd = Math.min(sizing.size_usd, balance)

  if (balance < 1) {
    return {
      tx_hash: null, status: 'failed',
      amount_in_usd: amountInUsd, token_in: tokenIn.symbol, token_out: tokenOut.symbol,
      chain_id: chainConfig.chain.id,
      error: `Insufficient ${tokenIn.symbol} balance on HashKey Chain.`,
    }
  }

  const amountIn = parseUnits(Math.min(amountInUsd, balance).toFixed(tokenIn.decimals), tokenIn.decimals)
  const routerAddress = router.routerAddress as Address
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800)

  // Approve
  const allowance = await publicClient.readContract({
    address: tokenIn.address as Address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [agentWallet.account.address, routerAddress],
  }) as bigint

  if (allowance < amountIn) {
    const approveTx = await walletClient.writeContract({
      address: tokenIn.address as Address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [routerAddress, amountIn * 10n],
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
  }

  const txHash = await walletClient.writeContract({
    address: routerAddress,
    abi: UNISWAPV2_ROUTER_ABI,
    functionName: 'swapExactTokensForTokens',
    args: [amountIn, withSlippage(amountIn), [tokenIn.address as Address, tokenOut.address as Address], agentWallet.account.address, deadline],
  })

  return {
    tx_hash: txHash,
    status: 'submitted',
    amount_in_usd: amountInUsd,
    token_in: tokenIn.symbol,
    token_out: tokenOut.symbol,
    chain_id: chainConfig.chain.id,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Builds and submits an on-chain swap for the given decision and sizing.
 *
 * @param ticker     Target asset ticker (e.g. "BTC", "ETH")
 * @param decision   "BUY" or "SELL"
 * @param sizing     RiskSizing output from the Risk Agent
 * @param userWallet Authenticated user's wallet address
 * @param chainId    Target chain (default: HashKey Chain = 177/133)
 */
export async function runExecutionAgent(
  ticker: string,
  decision: 'BUY' | 'SELL',
  sizing: RiskSizing,
  userWallet: string,
  chainId: number,
  emit: (event: RunEvent) => void,
  run_id: string,
): Promise<ExecutionAgentResult> {
  emit({
    type: 'agent.thinking',
    run_id,
    ts: new Date().toISOString(),
    agent: 'execution',
    message: `Preparing ${decision} swap for ${ticker.toUpperCase()} ($${sizing.size_usd})…`,
  })

  emit({
    type: 'execution.pending',
    run_id,
    ts: new Date().toISOString(),
    agent: 'execution',
    message: `Signing swap transaction on chain ${chainId}…`,
    payload: { decision, ticker, size_usd: sizing.size_usd, chain_id: chainId },
  })

  let result: ExecutionAgentResult

  try {
    const agentWallet = await getOrCreateAgentWallet(userWallet, chainId)
    const chainConfig = getChainConfig(chainId)

    // Dispatch to V2 or V3 based on the chain's primary router type
    const primaryRouter = chainConfig.dexRouters[0]
    if (primaryRouter?.type === 'uniswapV2') {
      result = await executeV2Swap(decision, ticker, sizing, agentWallet, chainConfig)
    } else {
      result = await executeV3Swap(decision, ticker, sizing, agentWallet, chainConfig)
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    result = {
      tx_hash: null,
      status: 'failed',
      amount_in_usd: sizing.size_usd,
      token_in: decision === 'BUY' ? stableLabel(chainId) : resolveTokenSymbol(ticker),
      token_out: decision === 'BUY' ? resolveTokenSymbol(ticker) : stableLabel(chainId),
      chain_id: chainId,
      error: errMsg,
    }
  }

  const messageMap: Record<ExecutionAgentResult['status'], string> = {
    submitted: `Swap submitted — tx ${result.tx_hash?.slice(0, 10)}… · ${result.token_in} → ${result.token_out} ($${result.amount_in_usd})`,
    pending_deployment: `DEX not yet deployed on chain ${chainId}. ${result.error}`,
    failed: `Execution failed: ${result.error}`,
    skipped: `Execution skipped.`,
  }

  emit({
    type: 'execution.done',
    run_id,
    ts: new Date().toISOString(),
    agent: 'execution',
    message: messageMap[result.status],
    payload: { ...result },
  })

  return result
}
