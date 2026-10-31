/**
 * Generic EVM wallet provider — connects MetaMask to any chain registered in
 * lib/chain-registry. Pass a chainId to target a specific chain, or omit it
 * to use the default chain (HashKey Chain, chainId 177 mainnet / 133 testnet).
 */
import { ethers } from 'ethers'
import { getChainConfig, getDefaultChainId } from '@/lib/chain-registry'

declare global {
  interface Window {
    ethereum?: any
  }
}

/**
 * Returns a read-only JSON-RPC provider for the given chain.
 * Uses the first HTTP RPC URL from the registry's viem Chain object.
 */
export function getPublicProvider(chainId?: number): ethers.JsonRpcProvider {
  const config = getChainConfig(chainId ?? getDefaultChainId())
  const rpcUrl = config.chain.rpcUrls.default.http[0]
  return new ethers.JsonRpcProvider(rpcUrl)
}

function getMetaMaskProvider(): NonNullable<Window['ethereum']> {
  if (!window.ethereum) throw new Error('MetaMask not installed')

  // When multiple wallets are installed, MetaMask injects itself into
  // window.ethereum.providers[]. Find the one flagged isMetaMask.
  if (window.ethereum.providers?.length) {
    const mm = window.ethereum.providers.find((p: { isMetaMask?: boolean }) => p.isMetaMask)
    if (mm) return mm
  }

  // Single wallet scenario — check it's actually MetaMask
  if (window.ethereum.isMetaMask) return window.ethereum

  throw new Error('MetaMask not found. Please install MetaMask or disable other wallets.')
}

/**
 * Connects MetaMask and switches to the requested chain.
 * If the chain is not yet added to MetaMask (error 4902) it is added first.
 */
export async function connectWallet(chainId?: number): Promise<{
  provider: ethers.BrowserProvider
  signer: ethers.Signer
  address: string
}> {
  const id = chainId ?? getDefaultChainId()
  const config = getChainConfig(id)

  // Build EIP-3085 wallet_addEthereumChain params from the registry
  const chainParams = {
    chainId: `0x${id.toString(16)}`,
    chainName: config.chain.name,
    nativeCurrency: config.chain.nativeCurrency,
    rpcUrls: [config.chain.rpcUrls.default.http[0]],
    blockExplorerUrls: config.chain.blockExplorers?.default
      ? [config.chain.blockExplorers.default.url]
      : [],
  }

  const mmProvider = getMetaMaskProvider()
  const provider = new ethers.BrowserProvider(mmProvider)

  // Request accounts directly on the MetaMask provider
  await mmProvider.request({ method: 'eth_requestAccounts' })

  // Switch to the target chain — use mmProvider.request directly to avoid
  // ethers wrapping the error code in a way that loses the 4902 value
  try {
    await mmProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainParams.chainId }],
    })
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code
    if (code === 4902) {
      // Chain not yet in MetaMask — add it, then switch
      await mmProvider.request({
        method: 'wallet_addEthereumChain',
        params: [chainParams],
      })
      await mmProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainParams.chainId }],
      })
    } else {
      throw err
    }
  }

  const signer = await provider.getSigner()
  const address = await signer.getAddress()

  return { provider, signer, address }
}
