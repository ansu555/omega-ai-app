/**
 * Pool discovery. Scoped to the configured token set ({tokens × tokens}) rather
 * than every pool on HashKey Chain, which keeps in-memory state bounded. For each
 * unordered pair we probe every V3 fee tier; existing pools are seeded into
 * price-state with their current sqrtPrice/liquidity.
 */

import type { Address } from "viem";
import { zeroAddress } from "viem";
import { httpClient } from "./chain.js";
import { V3_FACTORY_ABI, V3_POOL_ABI } from "./abis.js";
import {
  V3_FACTORIES,
  TOKEN_LIST,
  TOKENS_BY_ADDRESS,
  V3_FEE_TIERS,
  type TokenInfo,
} from "./config.js";
import { token0PriceInToken1 } from "./price-math.js";
import { upsertPool, type PoolState } from "./price-state.js";

function uniquePairs(tokens: TokenInfo[]): [TokenInfo, TokenInfo][] {
  const pairs: [TokenInfo, TokenInfo][] = [];
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      pairs.push([tokens[i]!, tokens[j]!]);
    }
  }
  return pairs;
}

/** Probe every factory × pair × fee tier, return existing pool addresses. */
async function discoverPoolAddresses(): Promise<{ address: Address; fee: number }[]> {
  const pairs = uniquePairs(TOKEN_LIST);
  const probes = V3_FACTORIES.flatMap((factory) =>
    pairs.flatMap(([a, b]) =>
      V3_FEE_TIERS.map((fee) => ({
        address: factory.address,
        abi: V3_FACTORY_ABI,
        functionName: "getPool" as const,
        args: [a.address, b.address, fee] as const,
        fee,
      })),
    ),
  );

  const results = await httpClient.multicall({
    contracts: probes.map(({ address, abi, functionName, args }) => ({
      address,
      abi,
      functionName,
      args,
    })),
    allowFailure: true,
  });

  const found: { address: Address; fee: number }[] = [];
  results.forEach((res, idx) => {
    if (res.status !== "success") return;
    const pool = res.result as Address;
    if (!pool || pool === zeroAddress) return;
    found.push({ address: pool, fee: probes[idx]!.fee });
  });
  return found;
}

/** Read token0/token1/slot0/liquidity for a discovered pool and seed state. */
async function seedPool(pool: Address, fee: number): Promise<PoolState | null> {
  const [token0Res, token1Res, slot0Res, liqRes] = await httpClient.multicall({
    contracts: [
      { address: pool, abi: V3_POOL_ABI, functionName: "token0" },
      { address: pool, abi: V3_POOL_ABI, functionName: "token1" },
      { address: pool, abi: V3_POOL_ABI, functionName: "slot0" },
      { address: pool, abi: V3_POOL_ABI, functionName: "liquidity" },
    ],
    allowFailure: true,
  });

  if (
    token0Res.status !== "success" ||
    token1Res.status !== "success" ||
    slot0Res.status !== "success"
  ) {
    return null;
  }

  const token0 = TOKENS_BY_ADDRESS.get((token0Res.result as Address).toLowerCase());
  const token1 = TOKENS_BY_ADDRESS.get((token1Res.result as Address).toLowerCase());
  if (!token0 || !token1) return null; // pool with a token outside our set

  const slot0 = slot0Res.result as readonly [bigint, number, ...unknown[]];
  const sqrtPriceX96 = slot0[0];
  const tick = Number(slot0[1]);
  const liquidity = liqRes.status === "success" ? (liqRes.result as bigint) : 0n;

  const state: PoolState = {
    address: pool,
    kind: "v3",
    token0,
    token1,
    fee,
    sqrtPriceX96,
    liquidity,
    tick,
    price0in1: token0PriceInToken1(sqrtPriceX96, token0.decimals, token1.decimals),
    updatedAt: Date.now(),
  };
  upsertPool(state);
  return state;
}

/** Discover + seed all pools. Returns the seeded states. */
export async function loadPools(): Promise<PoolState[]> {
  const addresses = await discoverPoolAddresses();
  const seeded = await Promise.all(addresses.map(({ address, fee }) => seedPool(address, fee)));
  return seeded.filter((s): s is PoolState => s !== null);
}
