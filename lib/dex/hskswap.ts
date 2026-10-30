/**
 * HSKSwap adapter — HashKey Chain's DEX execution path.
 *
 * HSKSwap is a Uniswap V3 fork (concentrated liquidity, fee tiers 100 / 500 /
 * 3000 / 10000). Its router is **SwapRouter02**, whose `exactInputSingle`
 * (selector 0x04e45aaf) and `exactInput` (0xb858183f) param structs have NO
 * `deadline` field — verified against on-chain bytecode; the original V3
 * SwapRouter selectors are absent. Deadlines are enforced, when needed, via
 * `multicall(uint256 deadline, bytes[] data)`.
 *
 * Quotes come from the QuoterV2 (`quoteExactInputSingle`, struct param), which
 * is `nonpayable` and therefore must be called via eth_call (`simulateContract`),
 * never `readContract`.
 *
 * Addresses are sourced from the chain registry (`chains/hashkey.ts`) — never
 * hardcode them elsewhere.
 */

import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  encodePacked,
  http,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
} from 'viem'
import type { PrivateKeyAccount } from 'viem/accounts'
import { HASHKEY_CHAIN_ID, HSKSWAP } from '@/lib/chain-registry/chains/hashkey'

// ── Identity ──────────────────────────────────────────────────────────────────

export const HSKSWAP_CHAIN_ID = HASHKEY_CHAIN_ID
export const HSKSWAP_DEX_ID = 'hskswap'
export const HSKSWAP_DEX_NAME = 'HSKSwap'
export const HSKSWAP_SWAP_URL = 'https://app.hskswap.com/swap'
export const HSKSWAP_POOLS_URL = 'https://app.hskswap.com/positions'
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

/** True for unset/zero/burn-style placeholder addresses (chain registry entries pending deployment). */
export function isPlaceholderAddress(address: Address | undefined): boolean {
  if (!address) return true
  const lower = address.toLowerCase()
  if (lower === ZERO_ADDRESS) return true
  return /^0x0{20,}[0-9a-f]{1,20}$/i.test(lower)
}

/**
 * Fee tiers enabled on the HSKSwap factory (`feeAmountTickSpacing` != 0),
 * probed lowest→highest. Tiers with no pool simply revert in the quoter and
 * are skipped.
 */
export const HSKSWAP_FEE_TIERS = [100, 500, 3000, 10000] as const
export type HSKSwapFeeTier = (typeof HSKSWAP_FEE_TIERS)[number]

// ── ABIs ────────────────────────────────────────────────────────────────────

export const HSKSWAP_ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
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
] as const

/** QuoterV2.quoteExactInputSingle — struct param, nonpayable (call via eth_call). */
export const HSKSWAP_QUOTER_V2_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'quoteExactInputSingle',
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

/** SwapRouter02.exactInputSingle — NO `deadline` field (selector 0x04e45aaf). */
export const HSKSWAP_ROUTER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'exactInputSingle',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

/** QuoterV2.quoteExactInput — multi-hop, packed-bytes path (verified selector 0xcdca1753). */
export const HSKSWAP_QUOTER_V2_PATH_ABI = [
  {
    inputs: [
      { name: 'path', type: 'bytes' },
      { name: 'amountIn', type: 'uint256' },
    ],
    name: 'quoteExactInput',
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96AfterList', type: 'uint160[]' },
      { name: 'initializedTicksCrossedList', type: 'uint32[]' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

/** SwapRouter02.exactInput — multi-hop, packed-bytes path, NO `deadline` (selector 0xb858183f). */
export const HSKSWAP_ROUTER_EXACT_INPUT_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'path', type: 'bytes' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
        ],
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'exactInput',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

// ── Types ───────────────────────────────────────────────────────────────────

export type HSKSwapToken = {
  address: Address
  symbol: string
  decimals: number
}

export type HSKSwapQuote = {
  amountOut: bigint
  /** The fee tier (in hundredths of a bip) that produced the best quote. */
  fee: number
}

// ── Quoting ─────────────────────────────────────────────────────────────────

/**
 * Probes every candidate fee tier via the QuoterV2 and returns the tier with
 * the best output. Returns `null` if no HSKSwap pool exists for the pair.
 *
 * Works with both a server viem `PublicClient` and the wagmi browser client —
 * both expose `simulateContract`, which is required because the quoter is a
 * state-mutating simulation (it reverts to return its result).
 */
export async function quoteHSKSwapBestTier(
  publicClient: PublicClient,
  params: {
    tokenIn: Address
    tokenOut: Address
    amountIn: bigint
    feeTiers?: readonly number[]
    quoter?: Address
  },
): Promise<HSKSwapQuote | null> {
  const { tokenIn, tokenOut, amountIn } = params
  const feeTiers = params.feeTiers ?? HSKSWAP_FEE_TIERS
  const quoter = params.quoter ?? (HSKSWAP.quoterV2)

  if (amountIn <= 0n) return null

  const results = await Promise.all(
    feeTiers.map(async (fee) => {
      try {
        const { result } = await publicClient.simulateContract({
          address: quoter,
          abi: HSKSWAP_QUOTER_V2_ABI,
          functionName: 'quoteExactInputSingle',
          args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
        })
        const amountOut = (result as readonly [bigint, bigint, number, bigint])[0]
        return { fee, amountOut }
      } catch {
        // No pool at this fee tier, or insufficient liquidity — skip.
        return null
      }
    }),
  )

  let best: HSKSwapQuote | null = null
  for (const r of results) {
    if (r && r.amountOut > 0n && (!best || r.amountOut > best.amountOut)) {
      best = { amountOut: r.amountOut, fee: r.fee }
    }
  }
  return best
}

// ── Multi-hop routing ───────────────────────────────────────────────────────

/**
 * Encodes a Uniswap V3 swap path as the packed `address-fee-address-...-address`
 * bytes string expected by `exactInput` / `quoteExactInput`.
 */
export function encodeV3Path(tokens: Address[], fees: number[]): Hex {
  if (tokens.length !== fees.length + 1) {
    throw new Error('encodeV3Path: expected fees.length === tokens.length - 1')
  }
  const types: ('address' | 'uint24')[] = []
  const values: (Address | number)[] = []
  tokens.forEach((token, i) => {
    types.push('address')
    values.push(token)
    if (i < fees.length) {
      types.push('uint24')
      values.push(fees[i])
    }
  })
  return encodePacked(types, values)
}

export type HSKSwapMultiHopQuote = {
  amountOut: bigint
  /** Token addresses along the route, e.g. [tokenIn, hub, tokenOut]. */
  path: Address[]
  /** Fee tier for each hop, parallel to `path` (length = path.length - 1). */
  fees: number[]
  /** Packed-bytes path ready for `exactInput`. */
  encodedPath: Hex
}

/**
 * Finds the best two-hop route `tokenIn -> hub -> tokenOut` through any of the
 * given hub tokens (e.g. USDT/WHSK), probing each hop's best fee tier
 * independently and then re-quoting the assembled path end-to-end via
 * `quoteExactInput` for an accurate combined-slippage estimate.
 *
 * Returns `null` if no two-hop route has any liquidity.
 */
export async function quoteHSKSwapMultiHop(
  publicClient: PublicClient,
  params: {
    tokenIn: Address
    tokenOut: Address
    amountIn: bigint
    hubTokens: Address[]
    quoter?: Address
    feeTiers?: readonly number[]
  },
): Promise<HSKSwapMultiHopQuote | null> {
  const { tokenIn, tokenOut, amountIn, hubTokens, feeTiers } = params
  const quoter = params.quoter ?? (HSKSWAP.quoterV2)
  if (amountIn <= 0n) return null

  const hubs = hubTokens.filter(
    (hub) =>
      hub.toLowerCase() !== tokenIn.toLowerCase() &&
      hub.toLowerCase() !== tokenOut.toLowerCase(),
  )

  let best: HSKSwapMultiHopQuote | null = null

  for (const hub of hubs) {
    const leg1 = await quoteHSKSwapBestTier(publicClient, {
      tokenIn,
      tokenOut: hub,
      amountIn,
      feeTiers,
      quoter,
    })
    if (!leg1 || leg1.amountOut <= 0n) continue

    const leg2 = await quoteHSKSwapBestTier(publicClient, {
      tokenIn: hub,
      tokenOut,
      amountIn: leg1.amountOut,
      feeTiers,
      quoter,
    })
    if (!leg2 || leg2.amountOut <= 0n) continue

    const path = [tokenIn, hub, tokenOut]
    const fees = [leg1.fee, leg2.fee]
    const encodedPath = encodeV3Path(path, fees)

    try {
      const { result } = await publicClient.simulateContract({
        address: quoter,
        abi: HSKSWAP_QUOTER_V2_PATH_ABI,
        functionName: 'quoteExactInput',
        args: [encodedPath, amountIn],
      })
      const amountOut = (result as readonly [bigint, readonly bigint[], readonly number[], bigint])[0]
      if (amountOut > 0n && (!best || amountOut > best.amountOut)) {
        best = { amountOut, path, fees, encodedPath }
      }
    } catch {
      // Combined path not viable end-to-end — skip.
    }
  }

  return best
}

// ── Server-side execution (agent burner wallet) ──────────────────────────────

export type HSKSwapSwapResult = {
  txHash: `0x${string}`
  amountIn: bigint
  amountOut: bigint
  amountOutMinimum: bigint
  fee: number
  tokenIn: string
  tokenOut: string
}

/**
 * Executes a single-hop HSKSwap swap from a server-managed agent wallet.
 *
 * Resolves the best fee tier via the QuoterV2, derives `amountOutMinimum` from
 * the live quote + slippage (so it works for any decimal/price ratio — unlike a
 * naive 1:1 minimum), approves the router if needed, then calls
 * `exactInputSingle`. Throws on insufficient balance or no available pool.
 *
 * Does not wait for the swap receipt — returns the submitted tx hash. (It does
 * wait for the approval receipt, since the swap depends on it.)
 */
export async function executeHSKSwapAgentSwap(params: {
  account: PrivateKeyAccount
  chain: Chain
  rpcUrl: string
  tokenIn: HSKSwapToken
  tokenOut: HSKSwapToken
  /** Amount to sell, already denominated in `tokenIn` base units. */
  amountIn: bigint
  slippageBps?: number
  /** Force a fee tier instead of probing (skips quoter pool discovery). */
  fee?: number
  swapRouter?: Address
  quoter?: Address
}): Promise<HSKSwapSwapResult> {
  const {
    account,
    chain,
    rpcUrl,
    tokenIn,
    tokenOut,
    amountIn,
    slippageBps = 200,
    fee: forcedFee,
    swapRouter = HSKSWAP.swapRouter02,
    quoter = HSKSWAP.quoterV2,
  } = params

  if (amountIn <= 0n) {
    throw new Error('HSKSwap swap amount must be greater than 0.')
  }

  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })

  // Resolve the best fee tier + expected output.
  const quote = await quoteHSKSwapBestTier(publicClient, {
    tokenIn: tokenIn.address,
    tokenOut: tokenOut.address,
    amountIn,
    feeTiers: forcedFee !== undefined ? [forcedFee] : undefined,
    quoter,
  })
  if (!quote) {
    throw new Error(
      `No HSKSwap pool with liquidity for ${tokenIn.symbol}/${tokenOut.symbol}.`,
    )
  }

  const slippageMultiplier = BigInt(Math.max(0, 10_000 - slippageBps))
  const amountOutMinimum = (quote.amountOut * slippageMultiplier) / 10_000n

  // Balance check.
  const balance = (await publicClient.readContract({
    address: tokenIn.address,
    abi: HSKSWAP_ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  })) as bigint
  if (balance < amountIn) {
    throw new Error(`Insufficient ${tokenIn.symbol} balance for the agent wallet.`)
  }

  // Approve the router if the current allowance is short.
  const allowance = (await publicClient.readContract({
    address: tokenIn.address,
    abi: HSKSWAP_ERC20_ABI,
    functionName: 'allowance',
    args: [account.address, swapRouter],
  })) as bigint
  if (allowance < amountIn) {
    const approveTx = await walletClient.writeContract({
      address: tokenIn.address,
      abi: HSKSWAP_ERC20_ABI,
      functionName: 'approve',
      args: [swapRouter, amountIn],
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
  }

  const txHash = await walletClient.writeContract({
    address: swapRouter,
    abi: HSKSWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        fee: quote.fee,
        recipient: account.address,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  })

  return {
    txHash,
    amountIn,
    amountOut: quote.amountOut,
    amountOutMinimum,
    fee: quote.fee,
    tokenIn: tokenIn.symbol,
    tokenOut: tokenOut.symbol,
  }
}

// ── Native HSK support ───────────────────────────────────────────────────────
//
// SwapRouter02 can take and return the native coin directly, so users swap the
// HSK in their wallet without a separate wrap step. Three facts were verified
// against the deployed mainnet router (0x2c16f7…bD8F3) before this was written:
//
//   • `WETH9()` returns 0xB210…1Cf1 — exactly the WHSK in this registry.
//   • `multicall(uint256,bytes[])` (0x5ae401dc), `unwrapWETH9(uint256,address)`
//     (0x49404b7c) and `refundETH()` (0x12210e8a) are all present in bytecode.
//   • An `eth_call` of HSK → USDT → HSK through this exact encoding succeeded
//     and returned 0.994 HSK for 1 HSK in — i.e. precisely the two 0.3% pool
//     fees and nothing else. So ADDRESS_THIS and CONTRACT_BALANCE below behave
//     as upstream SwapRouter02 documents.
//
// Direction handling:
//   HSK  → token : pass `value`; the router wraps on the way in.
//   token → HSK  : send output to ADDRESS_THIS, then `unwrapWETH9` to the user.
//   token → token: plain call, no multicall (keeps the cheaper code path).

/** SwapRouter02 flag: operate on the router's whole balance of the token. */
export const CONTRACT_BALANCE = 0n
/** SwapRouter02 flag: "the caller" as a recipient. */
export const MSG_SENDER = '0x0000000000000000000000000000000000000001' as Address
/** SwapRouter02 flag: "the router itself" — required before `unwrapWETH9`. */
export const ADDRESS_THIS = '0x0000000000000000000000000000000000000002' as Address

/** Batches router calls atomically, reverting past `deadline` (0x5ae401dc). */
export const HSKSWAP_MULTICALL_ABI = [
  {
    inputs: [
      { name: 'deadline', type: 'uint256' },
      { name: 'data', type: 'bytes[]' },
    ],
    name: 'multicall',
    outputs: [{ name: 'results', type: 'bytes[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

/** Unwraps the router's WHSK and forwards native HSK (0x49404b7c / 0x12210e8a). */
export const HSKSWAP_NATIVE_ABI = [
  {
    inputs: [
      { name: 'amountMinimum', type: 'uint256' },
      { name: 'recipient', type: 'address' },
    ],
    name: 'unwrapWETH9',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'refundETH',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const

/** WHSK is a standard WETH9: `deposit()` wraps, `withdraw(uint256)` unwraps. */
export const WRAPPED_NATIVE_ABI = [
  {
    inputs: [],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'wad', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

/** A ready-to-send write, shaped for wagmi's `writeContract`. */
export type HSKSwapTxRequest = {
  address: Address
  abi: readonly unknown[]
  functionName: string
  args: readonly unknown[]
  /** Native HSK to attach. Omitted/0n for pure ERC-20 swaps. */
  value?: bigint
}

/**
 * Builds the router write for a swap, transparently handling native HSK on
 * either side.
 *
 * `tokenIn` / `tokenOut` are the *resolved* ERC-20 addresses (native already
 * mapped to `wrappedNative`); `nativeIn` / `nativeOut` say which side the user
 * actually wants in native form. Pass exactly one of `fee` (single hop) or
 * `path` (packed multi-hop bytes).
 */
export function buildHSKSwapTx(params: {
  router: Address
  tokenIn: Address
  tokenOut: Address
  recipient: Address
  amountIn: bigint
  amountOutMinimum: bigint
  fee?: number
  path?: Hex
  nativeIn?: boolean
  nativeOut?: boolean
  /** Unix seconds; only applied when a multicall is actually needed. */
  deadline?: bigint
}): HSKSwapTxRequest {
  const {
    router, tokenIn, tokenOut, recipient,
    amountIn, amountOutMinimum, fee, path,
    nativeIn = false, nativeOut = false,
  } = params

  if (amountIn <= 0n) throw new Error('HSKSwap: amountIn must be greater than 0.')
  if (path === undefined && fee === undefined) {
    throw new Error('HSKSwap: pass either `fee` (single hop) or `path` (multi hop).')
  }

  // Native output must land in the router first so it can be unwrapped.
  const swapRecipient = nativeOut ? ADDRESS_THIS : recipient

  const swapCall: HSKSwapTxRequest = path
    ? {
        address: router,
        abi: HSKSWAP_ROUTER_EXACT_INPUT_ABI,
        functionName: 'exactInput',
        args: [{ path, recipient: swapRecipient, amountIn, amountOutMinimum }],
      }
    : {
        address: router,
        abi: HSKSWAP_ROUTER_ABI,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn,
            tokenOut,
            fee: fee as number,
            recipient: swapRecipient,
            amountIn,
            amountOutMinimum,
            sqrtPriceLimitX96: 0n,
          },
        ],
      }

  // Plain ERC-20 → ERC-20: no wrapping needed, so skip the multicall wrapper.
  if (!nativeIn && !nativeOut) return swapCall

  const deadline = params.deadline ?? BigInt(Math.floor(Date.now() / 1000) + 20 * 60)
  const calls: Hex[] = [
    encodeFunctionData({
      abi: swapCall.abi,
      functionName: swapCall.functionName,
      args: swapCall.args,
    } as Parameters<typeof encodeFunctionData>[0]),
  ]

  if (nativeOut) {
    // Enforce the slippage floor here too — the swap sent its output to the
    // router with no minimum of its own when unwrapping.
    calls.push(
      encodeFunctionData({
        abi: HSKSWAP_NATIVE_ABI,
        functionName: 'unwrapWETH9',
        args: [amountOutMinimum, recipient],
      }),
    )
  }
  if (nativeIn) {
    // Returns any native dust the router did not spend.
    calls.push(encodeFunctionData({ abi: HSKSWAP_NATIVE_ABI, functionName: 'refundETH', args: [] }))
  }

  return {
    address: router,
    abi: HSKSWAP_MULTICALL_ABI,
    functionName: 'multicall',
    args: [deadline, calls],
    value: nativeIn ? amountIn : 0n,
  }
}

/** HSK → WHSK at 1:1 (`WHSK.deposit()` with the amount as value). */
export function buildWrapTx(wrappedNative: Address, amount: bigint): HSKSwapTxRequest {
  if (amount <= 0n) throw new Error('Wrap amount must be greater than 0.')
  return {
    address: wrappedNative,
    abi: WRAPPED_NATIVE_ABI,
    functionName: 'deposit',
    args: [],
    value: amount,
  }
}

/** WHSK → HSK at 1:1 (`WHSK.withdraw(amount)`; needs no approval). */
export function buildUnwrapTx(wrappedNative: Address, amount: bigint): HSKSwapTxRequest {
  if (amount <= 0n) throw new Error('Unwrap amount must be greater than 0.')
  return {
    address: wrappedNative,
    abi: WRAPPED_NATIVE_ABI,
    functionName: 'withdraw',
    args: [amount],
  }
}
