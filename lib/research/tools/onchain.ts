/**
 * Deep Research — On-Chain & Liquidity tools (P3).
 *
 * The on-chain ground-truth layer of the hybrid-retrieval moat (blueprint §1
 * agent #2, §6): direct HashKey Chain reads that confirm or refute the market/web
 * narrative. These emit the highest trust tier — `onchain` — because they read
 * the chain itself rather than an aggregator.
 *
 *   • onchain_reader — ERC-20 facts for a HashKey Chain token (name, symbol, decimals,
 *                      total supply, optional holder balance). Verifies a token
 *                      actually exists on-chain and what its real supply is.
 *   • dex_liquidity  — realistic tradability: routes a trade of a given size
 *                      through HSKSwap (single + multi-hop) and reports the
 *                      price impact / slippage. Thin liquidity is a hard risk
 *                      flag even for a hot name.
 *
 * All addresses resolve from the chain registry (`getChainConfig` / `getTokens`)
 * — never hardcoded here, per the project rule. Both tools degrade gracefully:
 * unknown token, no pool, or no DEX routers on the active network → a clean
 * `{ ok: false }` with an explanatory message, never a throw.
 *
 * Server-only.
 */

import {
  createPublicClient,
  http,
  formatUnits,
  parseUnits,
  isAddress,
  getAddress,
  type Address,
  type PublicClient,
} from 'viem'

import { getChainConfig } from '@/lib/chain-registry'
import type { TokenInfo } from '@/lib/chain-registry/types'
import { hashkeyChain, HASHKEY_RPC, HSKSWAP } from '@/lib/chain-registry/chains/hashkey'
import { quoteHSKSwapBestTier, quoteHSKSwapMultiHop } from '@/lib/dex/hskswap'

import type { Evidence } from '@/lib/research/types'
import type { ResearchTool, ToolResult } from '@/lib/research/tools/types'
import { asNumber, asString, evidence, fail, ok, round } from '@/lib/research/tools/helpers'

const ERC20_ABI = [
  { inputs: [], name: 'name', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const STABLES = new Set(['USDC', 'USDC.E', 'USDT', 'DAI', 'USDE'])

// ── shared helpers ─────────────────────────────────────────────────────────────

/** A public client bound to the registry's active HashKey chain + RPC. */
function buildClient(): PublicClient {
  return createPublicClient({ chain: hashkeyChain, transport: http(HASHKEY_RPC) })
}

interface ResolvedToken {
  address: Address
  symbol: string
  decimals: number
  info?: TokenInfo
}

/**
 * Resolve a token argument (symbol like "WHSK" or a raw 0x address) to an
 * on-chain address using the chain registry token list. Returns null when the
 * symbol is not listed on the active chain and the value is not a valid address.
 */
function resolveToken(value: string, chainId: number): ResolvedToken | null {
  const raw = value.trim()
  if (!raw) return null

  const tokens = safeTokens(chainId)

  if (isAddress(raw)) {
    const addr = getAddress(raw)
    const hit = Object.values(tokens).find((t) => t.address.toLowerCase() === addr.toLowerCase())
    return hit
      ? { address: addr, symbol: hit.symbol, decimals: hit.decimals, info: hit }
      : { address: addr, symbol: raw.slice(0, 8), decimals: 18 }
  }

  const sym = raw.toUpperCase()
  const byKey = tokens[sym]
  if (byKey) return { address: byKey.address, symbol: byKey.symbol, decimals: byKey.decimals, info: byKey }
  const bySymbol = Object.values(tokens).find((t) => t.symbol.toUpperCase() === sym)
  if (bySymbol)
    return { address: bySymbol.address, symbol: bySymbol.symbol, decimals: bySymbol.decimals, info: bySymbol }

  return null
}

function safeTokens(chainId: number): Record<string, TokenInfo> {
  try {
    return getChainConfig(chainId).tokens
  } catch {
    return {}
  }
}

function listedSymbols(chainId: number): string {
  const tokens = safeTokens(chainId)
  const syms = Object.values(tokens).map((t) => t.symbol)
  return syms.length ? syms.join(', ') : '(none configured)'
}

// ── onchain_reader ─────────────────────────────────────────────────────────────

export const onchainReaderTool: ResearchTool = {
  name: 'onchain_reader',
  description:
    'Read ERC-20 ground truth for a token on HashKey Chain: name, symbol, decimals, total ' +
    'supply, and optionally a holder address balance. Use to verify a token actually ' +
    'exists on-chain and confirm its real supply against claimed tokenomics. Accepts ' +
    'a listed symbol (e.g. WHSK, USDT) or a raw 0x token address.',
  trustTier: 'onchain',
  parameters: {
    type: 'object',
    properties: {
      token: { type: 'string', description: 'Token symbol (WHSK, USDT, WETH, WBTC) or 0x address.' },
      holder: { type: 'string', description: 'Optional 0x address to read the token balance of.' },
    },
    required: ['token'],
    additionalProperties: false,
  },
  async execute(args, ctx): Promise<ToolResult> {
    const chainId = ctx.chainId
    const token = resolveToken(asString(args.token), chainId)
    if (!token) {
      return fail(
        `"${asString(args.token)}" is not a HashKey-listed token and is not a valid address. ` +
          `Listed symbols: ${listedSymbols(chainId)}.`,
      )
    }

    const client = buildClient()
    const holderArg = asString(args.holder)
    const holder = isAddress(holderArg) ? getAddress(holderArg) : null

    try {
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        client.readContract({ address: token.address, abi: ERC20_ABI, functionName: 'name' }).catch(() => token.symbol),
        client.readContract({ address: token.address, abi: ERC20_ABI, functionName: 'symbol' }).catch(() => token.symbol),
        client.readContract({ address: token.address, abi: ERC20_ABI, functionName: 'decimals' }).catch(() => token.decimals),
        client.readContract({ address: token.address, abi: ERC20_ABI, functionName: 'totalSupply' }) as Promise<bigint>,
      ])

      const dec = Number(decimals)
      const supplyHuman = Number(formatUnits(totalSupply, dec))

      let holderBalance: number | null = null
      if (holder) {
        try {
          const bal = (await client.readContract({
            address: token.address,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [holder],
          })) as bigint
          holderBalance = Number(formatUnits(bal, dec))
        } catch {
          holderBalance = null
        }
      }

      const supplyStr = supplyHuman.toLocaleString(undefined, { maximumFractionDigits: 0 })
      const explorer = explorerAddr(chainId, token.address)
      const summary =
        `${String(symbol)} (${String(name)}) on HashKey Chain: total supply ${supplyStr}, ${dec} decimals` +
        (holder ? `; holder ${holder.slice(0, 8)}… holds ${holderBalance?.toLocaleString() ?? 'n/a'}.` : '.')

      const ev: Evidence[] = [
        evidence(
          `${String(symbol)} on-chain total supply is ${supplyStr} (${dec} decimals).`,
          'HashKey Chain RPC',
          'onchain',
          {
            address: token.address,
            name: String(name),
            symbol: String(symbol),
            decimals: dec,
            total_supply: supplyHuman,
            chain_id: chainId,
            ...(holder ? { holder, holder_balance: holderBalance } : {}),
          },
          explorer,
        ),
      ]
      return ok(summary, ev)
    } catch (err) {
      return fail(
        err instanceof Error ? err.message : `On-chain read failed for ${token.symbol} on HashKey Chain.`,
      )
    }
  },
}

// ── dex_liquidity ──────────────────────────────────────────────────────────────

export const dexLiquidityTool: ResearchTool = {
  name: 'dex_liquidity',
  description:
    'Assess real tradability on HashKey Chain by routing a trade of a given size through ' +
    'HSKSwap (direct + multi-hop) and reporting the expected output and price ' +
    'impact / slippage at that size. Use to answer "can this be traded at size?" — ' +
    'high price impact means thin liquidity (a material risk regardless of hype). ' +
    'Quote token defaults to USDT; sizes are interpreted in USD for stablecoin quotes.',
  trustTier: 'onchain',
  parameters: {
    type: 'object',
    properties: {
      token: { type: 'string', description: 'Target token to assess (symbol or 0x address).' },
      quote: { type: 'string', description: 'Quote/funding token symbol (default USDT).' },
      tradeSizeUsd: { type: 'number', description: 'Trade size to probe (default 1000). USD when the quote is a stablecoin.' },
    },
    required: ['token'],
    additionalProperties: false,
  },
  async execute(args, ctx): Promise<ToolResult> {
    const chainId = ctx.chainId

    // DEX routing requires a configured DEX on the active network (mainnet only today).
    let hasRouters = false
    let hubTokens: Address[] = []
    try {
      const cfg = getChainConfig(chainId)
      hasRouters = cfg.dexRouters.length > 0
      hubTokens = cfg.hubTokens
    } catch {
      hasRouters = false
    }
    if (!hasRouters) {
      return fail(
        'No DEX routers are configured on the active HashKey network (DEX quoting is ' +
          'mainnet-only). Fall back to trading-volume as a liquidity proxy and note the gap.',
      )
    }

    const target = resolveToken(asString(args.token), chainId)
    if (!target) {
      return fail(
        `"${asString(args.token)}" is not a HashKey-listed token / valid address. ` +
          `Listed: ${listedSymbols(chainId)}.`,
      )
    }

    const quoteSym = asString(args.quote) || 'USDT'
    const quote = resolveToken(quoteSym, chainId)
    if (!quote) return fail(`Quote token "${quoteSym}" is not listed on HashKey Chain.`)
    if (quote.address.toLowerCase() === target.address.toLowerCase()) {
      return fail('Target and quote tokens are identical — choose a different quote token.')
    }

    const sizeUsd = Math.max(1, asNumber(args.tradeSizeUsd, 1000))
    const isStableQuote = STABLES.has(quote.symbol.toUpperCase())
    const sizeLabel = isStableQuote ? `$${sizeUsd.toLocaleString()}` : `${sizeUsd.toLocaleString()} ${quote.symbol}`

    const amountIn = parseUnits(String(sizeUsd), quote.decimals)
    // Reference probe ~1/50th of the size (min 1 token unit) for the marginal rate.
    const refRaw = amountIn / 50n
    const oneUnit = parseUnits('1', quote.decimals)
    const refAmountIn = refRaw > oneUnit ? refRaw : oneUnit

    const client = buildClient()

    const [full, ref] = await Promise.all([
      bestQuote(client, quote.address, target.address, amountIn, hubTokens),
      bestQuote(client, quote.address, target.address, refAmountIn, hubTokens),
    ])

    if (!full) {
      return ok(
        `No HSKSwap route with liquidity for ${quote.symbol}→${target.symbol} at ${sizeLabel}. ` +
          'This indicates the pair cannot be traded at this size on HashKey Chain (very thin / no liquidity).',
        [
          evidence(
            `${target.symbol} has no tradable HSKSwap route from ${quote.symbol} at ${sizeLabel} on HashKey Chain.`,
            'HSKSwap (HashKey Chain)',
            'onchain',
            {
              target: target.symbol,
              quote: quote.symbol,
              trade_size: sizeUsd,
              tradable: false,
              chain_id: chainId,
            },
            explorerAddr(chainId, target.address),
          ),
        ],
      )
    }

    const fullOut = Number(formatUnits(full.amountOut, target.decimals))
    const fullInHuman = Number(formatUnits(amountIn, quote.decimals))
    const fullRate = fullInHuman > 0 ? fullOut / fullInHuman : 0

    let impactPct: number | null = null
    if (ref) {
      const refOut = Number(formatUnits(ref.amountOut, target.decimals))
      const refInHuman = Number(formatUnits(refAmountIn, quote.decimals))
      const marginalRate = refInHuman > 0 ? refOut / refInHuman : 0
      if (marginalRate > 0 && fullRate > 0) {
        impactPct = Math.max(0, round((1 - fullRate / marginalRate) * 100, 2))
      }
    }

    const route = full.hops === 1 ? `direct` : `multi-hop via ${full.via ?? 'hub'}`
    const impactStr = impactPct == null ? 'price impact n/a' : `${impactPct}% price impact`
    const depthLabel =
      impactPct == null ? '' : impactPct < 1 ? ' — deep liquidity' : impactPct < 5 ? ' — adequate liquidity' : ' — thin liquidity (high slippage)'

    const summary =
      `${quote.symbol}→${target.symbol} at ${sizeLabel}: ${route}, ~${fullOut.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${target.symbol} out, ${impactStr}${depthLabel}.`

    return ok(summary, [
      evidence(
        `${target.symbol} is tradable from ${quote.symbol} at ${sizeLabel} via HSKSwap (${route}), ${impactStr}.`,
        'HSKSwap (HashKey Chain)',
        'onchain',
        {
          target: target.symbol,
          quote: quote.symbol,
          trade_size: sizeUsd,
          stable_quote: isStableQuote,
          amount_out: fullOut,
          price_impact_pct: impactPct,
          fee_tier: full.fee,
          hops: full.hops,
          route_via: full.via ?? null,
          tradable: true,
          chain_id: chainId,
        },
        explorerAddr(chainId, target.address),
      ),
    ])
  },
}

// ── quoting helper ─────────────────────────────────────────────────────────────

interface BestQuote {
  amountOut: bigint
  fee: number
  hops: 1 | 2
  via?: string
}

/** Best of single-hop and 2-hop HSKSwap quotes; null when no route has liquidity. */
async function bestQuote(
  client: PublicClient,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  hubTokens: Address[],
): Promise<BestQuote | null> {
  const quoter = HSKSWAP.quoterV2
  const [single, multi] = await Promise.all([
    quoteHSKSwapBestTier(client, { tokenIn, tokenOut, amountIn, quoter }).catch(() => null),
    quoteHSKSwapMultiHop(client, { tokenIn, tokenOut, amountIn, hubTokens, quoter }).catch(() => null),
  ])

  let best: BestQuote | null = null
  if (single && single.amountOut > 0n) best = { amountOut: single.amountOut, fee: single.fee, hops: 1 }
  if (multi && multi.amountOut > 0n && (!best || multi.amountOut > best.amountOut)) {
    const hub = multi.path[1]
    best = { amountOut: multi.amountOut, fee: multi.fees[0] ?? 0, hops: 2, via: hub?.slice(0, 8) }
  }
  return best
}

function explorerAddr(chainId: number, address: string): string {
  try {
    const cfg = getChainConfig(chainId)
    return `${cfg.explorerUrl}${cfg.explorerAddressPath}${address}`
  } catch {
    return ''
  }
}
