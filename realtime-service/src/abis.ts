/**
 * Minimal ABIs for the contracts the service reads. Human-readable form parsed
 * by viem's parseAbi — only the fragments we actually call.
 */

import { parseAbi } from "viem";

/** Uniswap V3 / HSKSwap factory. */
export const V3_FACTORY_ABI = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
]);

/** Uniswap V3 / HSKSwap pool — reads + the Swap event we subscribe to. */
export const V3_POOL_ABI = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
  "function liquidity() view returns (uint128)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
]);

/** QuoterV2 — used as the on-chain fallback for V3 route quotes. */
export const V3_QUOTER_V2_ABI = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

/** Minimal ERC-20 for metadata fallback. */
export const ERC20_ABI = parseAbi([
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);
