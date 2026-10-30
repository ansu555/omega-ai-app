/**
 * On-chain market snapshots for HSKSwap (Uniswap V3) pools on HashKey Chain.
 *
 * GeckoTerminal does not index HSKSwap, so price and liquidity for "hashkey"
 * markets are read straight from the pool: `slot0().sqrtPriceX96` for the spot
 * price and the pool's token balances for TVL. USD values assume the quote
 * token is a dollar stable (all HashKey markets in markets.ts quote in USDT).
 */

import { createPublicClient, http, type Address, type PublicClient } from "viem";
import { getChainConfig } from "@/lib/chain-registry";
import type { DexMarketConfig } from "./markets";

const POOL_ABI = [
  {
    inputs: [],
    name: "slot0",
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  { inputs: [], name: "token0", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
] as const;

const ERC20_ABI = [
  { inputs: [], name: "decimals", outputs: [{ name: "", type: "uint8" }], stateMutability: "view", type: "function" },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const clients = new Map<number, PublicClient>();

function clientFor(chainId: number): PublicClient {
  let client = clients.get(chainId);
  if (!client) {
    const { chain } = getChainConfig(chainId);
    client = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) }) as PublicClient;
    clients.set(chainId, client);
  }
  return client;
}

export type OnchainPoolSnapshot = {
  /** Base token price denominated in the quote token (≈ USD for stable quotes). */
  priceInQuote: number;
  baseReserve: number;
  quoteReserve: number;
  /** baseReserve valued at spot + quoteReserve, in quote units. */
  liquidityInQuote: number;
};

/** Converts a V3 sqrtPriceX96 into the price of token0 in token1 units. */
export function sqrtPriceX96ToPrice(sqrtPriceX96: bigint, decimals0: number, decimals1: number): number {
  const ratio = Number(sqrtPriceX96) / 2 ** 96;
  return ratio * ratio * 10 ** (decimals0 - decimals1);
}

export async function readOnchainPool(config: DexMarketConfig): Promise<OnchainPoolSnapshot> {
  if (!config.chainId) throw new Error(`Market ${config.id} has no chainId`);
  const client = clientFor(config.chainId);
  const pool = config.poolAddress as Address;
  const base = config.baseToken.address as Address;
  const quote = config.quoteToken.address as Address;

  const [slot0, token0, baseDecimals, quoteDecimals, baseBal, quoteBal] = await Promise.all([
    client.readContract({ address: pool, abi: POOL_ABI, functionName: "slot0" }),
    client.readContract({ address: pool, abi: POOL_ABI, functionName: "token0" }),
    client.readContract({ address: base, abi: ERC20_ABI, functionName: "decimals" }),
    client.readContract({ address: quote, abi: ERC20_ABI, functionName: "decimals" }),
    client.readContract({ address: base, abi: ERC20_ABI, functionName: "balanceOf", args: [pool] }),
    client.readContract({ address: quote, abi: ERC20_ABI, functionName: "balanceOf", args: [pool] }),
  ]);

  const baseIsToken0 = token0.toLowerCase() === base.toLowerCase();
  const price0In1 = baseIsToken0
    ? sqrtPriceX96ToPrice(slot0[0], baseDecimals, quoteDecimals)
    : sqrtPriceX96ToPrice(slot0[0], quoteDecimals, baseDecimals);
  const priceInQuote = baseIsToken0 ? price0In1 : price0In1 > 0 ? 1 / price0In1 : 0;

  const baseReserve = Number(baseBal) / 10 ** baseDecimals;
  const quoteReserve = Number(quoteBal) / 10 ** quoteDecimals;

  return {
    priceInQuote,
    baseReserve,
    quoteReserve,
    liquidityInQuote: baseReserve * priceInQuote + quoteReserve,
  };
}
