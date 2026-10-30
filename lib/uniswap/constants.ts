import type { Address } from 'viem'

export const UNISWAP_SWAP_ROUTER: Address = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'
export const UNISWAP_QUOTER_V2: Address = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e'

// Common pool fees (bps * 100)
export const FEE_LOWEST = 100   // 0.01% stablecoin pairs
export const FEE_LOW = 500      // 0.05%
export const FEE_MEDIUM = 3000  // 0.30% most pairs
export const FEE_HIGH = 10000   // 1.00%

export type PoolFee = typeof FEE_LOWEST | typeof FEE_LOW | typeof FEE_MEDIUM | typeof FEE_HIGH

// Pool fee by market id
export const MARKET_FEES: Record<string, PoolFee> = {
  'eth-usdc-usdt': FEE_LOWEST,
  'eth-weth-usdc': FEE_LOW,
  'eth-uni-weth': FEE_MEDIUM,
  'eth-link-weth': FEE_MEDIUM,
  'eth-aave-weth': FEE_MEDIUM,
  'eth-pepe-weth': FEE_HIGH,
}

export const QUOTER_V2_ABI = [
  {
    name: 'quoteExactInputSingle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const

export const SWAP_ROUTER_ABI = [
  {
    name: 'exactInputSingle',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const

export const ERC20_ABI = [
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const
