"use client";

import type { Address, PublicClient } from "viem";
import { parseAbi } from "viem";

const POOL_INFO_ABI = parseAbi([
  "function getPoolInfo(uint256 poolId) view returns (address token0, address token1, uint256 reserve0, uint256 reserve1, uint256 totalLPTokens)",
  "function getPoolId(address token0, address token1) view returns (uint256)",
]);

export type RawReserves = {
  token0: Address;
  token1: Address;
  reserve0: bigint;
  reserve1: bigint;
};

export async function fetchPoolReserves(opts: {
  client: PublicClient;
  contractAddress: Address;
  poolId: bigint;
}): Promise<RawReserves> {
  const { client, contractAddress, poolId } = opts;
  const result = (await client.readContract({
    address: contractAddress,
    abi: POOL_INFO_ABI,
    functionName: "getPoolInfo",
    args: [poolId],
  })) as readonly [Address, Address, bigint, bigint, bigint];
  return {
    token0: result[0],
    token1: result[1],
    reserve0: result[2],
    reserve1: result[3],
  };
}

export async function lookupPoolId(opts: {
  client: PublicClient;
  contractAddress: Address;
  tokenA: Address;
  tokenB: Address;
}): Promise<bigint> {
  const { client, contractAddress, tokenA, tokenB } = opts;
  return (await client.readContract({
    address: contractAddress,
    abi: POOL_INFO_ABI,
    functionName: "getPoolId",
    args: [tokenA, tokenB],
  })) as bigint;
}

export function pollPoolReserves(opts: {
  client: PublicClient;
  contractAddress: Address;
  poolId: bigint;
  intervalMs?: number;
  onUpdate: (r: RawReserves) => void;
  onError?: (e: unknown) => void;
}): () => void {
  const { intervalMs = 6000 } = opts;
  let cancelled = false;

  const tick = async () => {
    if (cancelled) return;
    try {
      const r = await fetchPoolReserves({
        client: opts.client,
        contractAddress: opts.contractAddress,
        poolId: opts.poolId,
      });
      if (!cancelled) opts.onUpdate(r);
    } catch (e) {
      if (!cancelled) opts.onError?.(e);
    }
    if (cancelled) return;
    setTimeout(tick, intervalMs);
  };

  tick();
  return () => {
    cancelled = true;
  };
}
