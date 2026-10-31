import { BaseNode } from '../BaseNode'
import type { ConfigField, ExecutionContext, HandleDef } from '@/types/agent-builder-canvas'
import { ethers } from 'ethers'
import { getChainConfig, getDefaultChainId } from '@/lib/chain-registry'
import { HSKSWAP_DEX_NAME, HSKSWAP_FEE_TIERS } from '@/lib/dex/hskswap'

const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
]
const QUOTER_V2_ABI = [
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
]

const _config = getChainConfig(getDefaultChainId())
const _dexNames = _config.dexRouters.map((r) => r.name)
const _defaultDex = _dexNames[0] ?? HSKSWAP_DEX_NAME
const _tokenSymbols = Object.keys(_config.tokens)

function normalizeTokenKey(value: string) {
  if (_config.tokens[value]) return value
  if (value.toUpperCase() === 'USDC.E') return 'USDC'
  return value
}

export class DEXPriceNode extends BaseNode {
  readonly type = 'dex_price'
  readonly label = 'DEX Price'
  readonly description = `Gets swap quote from ${_dexNames.join(' or ') || HSKSWAP_DEX_NAME}`
  readonly icon = 'ArrowLeftRight'
  readonly category = 'data' as const
  readonly color = 'border-blue-500'
  readonly bgColor = 'bg-blue-950'

  readonly handles: HandleDef[] = [
    { id: 'price', label: 'Price', position: 'right', type: 'source', dataType: 'number' },
  ]

  readonly configSchema: ConfigField[] = [
    {
      key: 'dex',
      label: 'DEX',
      type: 'select',
      options: _dexNames.length ? _dexNames : [HSKSWAP_DEX_NAME],
      default: _defaultDex,
    },
    {
      key: 'tokenIn',
      label: 'Token In',
      type: 'select',
      options: _tokenSymbols,
      default: 'WHSK',
    },
    {
      key: 'tokenOut',
      label: 'Token Out',
      type: 'select',
      options: _tokenSymbols,
      default: 'USDC',
    },
    {
      key: 'amountIn',
      label: 'Amount In',
      type: 'number',
      default: 1,
    },
  ]

  async execute(
    _inputs: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const dex = (this.config.dex as string) || _defaultDex
    const tokenInKey = normalizeTokenKey((this.config.tokenIn as string) || 'WHSK')
    const tokenOutKey = normalizeTokenKey((this.config.tokenOut as string) || 'USDC')
    const amountIn = (this.config.amountIn as number) || 1
    const inToken = _config.tokens[tokenInKey]
    const outToken = _config.tokens[tokenOutKey]

    if (!inToken || !outToken) throw new Error('Unknown token')

    context.addLog(
      `[DEXPrice] Getting ${dex} quote: ${amountIn} ${inToken.symbol} -> ${outToken.symbol}`,
    )

    const routerEntry = _config.dexRouters.find((r) => r.name === dex)
    if (!routerEntry) throw new Error(`Unknown DEX: ${dex}`)

    const provider = context.provider as ethers.BrowserProvider
    const amountInWei = ethers.parseUnits(amountIn.toString(), inToken.decimals)

    // HSKSwap (or any custom V3 router): probe fee tiers via QuoterV2.
    if (routerEntry.type === 'custom' && routerEntry.quoterAddress) {
      const quoter = new ethers.Contract(routerEntry.quoterAddress, QUOTER_V2_ABI, provider)
      let bestOut = 0n
      for (const fee of HSKSWAP_FEE_TIERS) {
        try {
          const res = await quoter.quoteExactInputSingle.staticCall([
            inToken.address,
            outToken.address,
            amountInWei,
            fee,
            0,
          ])
          const out = res[0] as bigint
          if (out > bestOut) bestOut = out
        } catch {
          /* no pool at this fee tier */
        }
      }
      if (bestOut <= 0n) throw new Error(`No HSKSwap pool for ${inToken.symbol}/${outToken.symbol}`)
      const amountOut = parseFloat(ethers.formatUnits(bestOut, outToken.decimals))
      const price = amountOut / amountIn
      context.addLog(`[DEXPrice] 1 ${inToken.symbol} = ${price} ${outToken.symbol} on ${dex}`)
      return { price }
    }

    // UniswapV2-compatible router.
    const router = new ethers.Contract(routerEntry.routerAddress, ROUTER_ABI, provider)
    const amounts = await router.getAmountsOut(amountInWei, [inToken.address, outToken.address])
    const amountOut = parseFloat(ethers.formatUnits(amounts[1], outToken.decimals))
    const price = amountOut / amountIn

    context.addLog(`[DEXPrice] 1 ${inToken.symbol} = ${price} ${outToken.symbol} on ${dex}`)
    return { price }
  }
}
