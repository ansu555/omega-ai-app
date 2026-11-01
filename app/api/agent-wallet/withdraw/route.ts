/**
 * /api/agent-wallet/withdraw
 *
 * POST — Sweeps assets from the agent burner wallet back to the user's
 *         connected wallet. The server decrypts the agent private key,
 *         signs the transactions, and broadcasts them.
 *
 * Request body (JSON):
 *   {
 *     chainId?  : number     — defaults to DEFAULT_CHAIN_ID (HashKey Chain, 177/133)
 *     tokens?   : string[]   — ERC-20 addresses to sweep; omit/empty for native only
 *     gasReserve?: string    — native units to keep for future gas (default "0.001")
 *   }
 *
 * Response:
 *   {
 *     native?: { txHash: string; amount: string }
 *     erc20?:  Array<{ token: string; txHash: string; amount: string }>
 *   }
 *
 * Auth: x-wallet-address header (requireWallet helper).
 */

import { type NextRequest, NextResponse } from 'next/server'
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  getContract,
} from 'viem'

import { requireWallet } from '@/lib/marketplace/wallet-header'
import { getOrCreateAgentWallet } from '@/lib/agent-wallet/manager'
import { getChainConfig, DEFAULT_CHAIN_ID } from '@/lib/chain-registry'

// ── Minimal ERC-20 ABI (balanceOf + transfer) ─────────────────────────────────

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const userWallet = requireWallet(req)
  if (userWallet instanceof Response) return userWallet

  let body: { chainId?: number; tokens?: string[]; gasReserve?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    body = {}
  }

  const chainId = body.chainId ?? DEFAULT_CHAIN_ID
  const tokenList: string[] = body.tokens ?? []
  const gasReserve = parseEther(body.gasReserve ?? '0.001')

  try {
    const { address: agentAddress, account } = await getOrCreateAgentWallet(
      userWallet,
      chainId,
    )

    const chainConfig = getChainConfig(chainId)
    const rpc = chainConfig.chain.rpcUrls.default.http[0]

    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(rpc),
    })

    const walletClient = createWalletClient({
      account,
      chain: chainConfig.chain,
      transport: http(rpc),
    })

    const recipient = userWallet as `0x${string}`
    const results: {
      native?: { txHash: string; amount: string }
      erc20: Array<{ token: string; txHash: string; amount: string }>
    } = { erc20: [] }

    // ── Sweep native token ───────────────────────────────────
    const nativeBalance = await publicClient.getBalance({
      address: agentAddress as `0x${string}`,
    })

    if (nativeBalance > gasReserve) {
      const gasEstimate = await publicClient.estimateGas({
        account: agentAddress as `0x${string}`,
        to: recipient,
        value: nativeBalance - gasReserve,
      })

      const gasPrice = await publicClient.getGasPrice()
      const gasCost = gasEstimate * gasPrice

      const sendValue = nativeBalance - gasReserve - gasCost
      if (sendValue > 0n) {
        const txHash = await walletClient.sendTransaction({
          to: recipient,
          value: sendValue,
        })
        results.native = {
          txHash,
          amount: formatEther(sendValue),
        }
      }
    }

    // ── Sweep ERC-20 tokens ──────────────────────────────────
    for (const tokenAddress of tokenList) {
      try {
        const contract = getContract({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          client: { public: publicClient, wallet: walletClient },
        })

        const balance = await contract.read.balanceOf([
          agentAddress as `0x${string}`,
        ])

        if (balance > 0n) {
          const txHash = await contract.write.transfer([recipient, balance])
          results.erc20.push({
            token: tokenAddress,
            txHash,
            amount: balance.toString(),
          })
        }
      } catch {
        // Skip tokens that fail (e.g. contract doesn't exist on this chain)
      }
    }

    return NextResponse.json(results)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
