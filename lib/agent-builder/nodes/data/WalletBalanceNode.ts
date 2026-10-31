import { BaseNode } from '../BaseNode'
import type { HandleDef, ConfigField, ExecutionContext } from '@/types/agent-builder-canvas'
import { ethers } from 'ethers'
import { getChainConfig, getDefaultChainId } from '@/lib/chain-registry'

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]

// Resolved once at module load from the chain registry
const _config = getChainConfig(getDefaultChainId())
const _nativeSymbol = _config.chain.nativeCurrency.symbol
const _tokenSymbols = Object.keys(_config.tokens)

export class WalletBalanceNode extends BaseNode {
  readonly type = 'wallet_balance'
  readonly label = 'Wallet Balance'
  readonly description = 'Reads token balance from connected wallet'
  readonly icon = 'Wallet'
  readonly category = 'data' as const
  readonly color = 'border-blue-500'
  readonly bgColor = 'bg-blue-950'

  readonly handles: HandleDef[] = [
    { id: 'balance', label: 'Balance', position: 'right', type: 'source', dataType: 'number' },
  ]

  readonly configSchema: ConfigField[] = [
    {
      key: 'token',
      label: 'Token',
      type: 'select',
      options: [_nativeSymbol, ..._tokenSymbols],
      default: _nativeSymbol,
    },
  ]

  async execute(
    _inputs: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    if (!context.walletAddress || !context.provider) {
      throw new Error('Wallet not connected')
    }

    const token = (this.config.token as string) || _nativeSymbol
    context.addLog(`[WalletBalance] Checking ${token} balance...`)

    const provider = context.provider as ethers.BrowserProvider

    if (token === _nativeSymbol) {
      const raw = await provider.getBalance(context.walletAddress)
      const balance = parseFloat(ethers.formatEther(raw))
      context.addLog(`[WalletBalance] ${_nativeSymbol} balance: ${balance}`)
      return { balance }
    }

    // ERC-20 token
    const tokenInfo = _config.tokens[token]
    if (!tokenInfo) throw new Error(`Unknown token: ${token}`)

    const contract = new ethers.Contract(tokenInfo.address, ERC20_ABI, provider)
    const [raw, decimals] = await Promise.all([
      contract.balanceOf(context.walletAddress),
      contract.decimals(),
    ])
    const balance = parseFloat(ethers.formatUnits(raw, decimals))
    context.addLog(`[WalletBalance] ${token} balance: ${balance}`)
    return { balance }
  }
}
