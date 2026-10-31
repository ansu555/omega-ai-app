"use client";

import type { Address, PublicClient } from "viem";
import { parseAbiItem } from "viem";

const SWAP_EVENT = parseAbiItem(
  "event Swap(uint256 indexed poolId, address indexed user, address tokenIn, uint256 amountIn, uint256 amountOut)",
);

export type PoolSwapEvent = {
  poolId: bigint;
  user: Address;
  tokenIn: Address;
  amountIn: bigint;
  amountOut: bigint;
  blockNumber: bigint;
  txHash: `0x${string}`;
  timestamp: number; // ms; populated by caller using block timestamp when known
};

export function watchPoolSwaps(opts: {
  client: PublicClient;
  contractAddress: Address;
  poolId?: bigint;
  onSwap: (e: PoolSwapEvent) => void;
}): () => void {
  const { client, contractAddress, poolId, onSwap } = opts;
  const unwatch = client.watchEvent({
    address: contractAddress,
    event: SWAP_EVENT,
    onLogs: (logs) => {
      for (const log of logs) {
        const args = log.args as {
          poolId?: bigint;
          user?: Address;
          tokenIn?: Address;
          amountIn?: bigint;
          amountOut?: bigint;
        };
        if (poolId != null && args.poolId !== poolId) continue;
        if (
          args.poolId == null ||
          args.user == null ||
          args.tokenIn == null ||
          args.amountIn == null ||
          args.amountOut == null
        )
          continue;
        onSwap({
          poolId: args.poolId,
          user: args.user,
          tokenIn: args.tokenIn,
          amountIn: args.amountIn,
          amountOut: args.amountOut,
          blockNumber: log.blockNumber ?? 0n,
          txHash: log.transactionHash ?? "0x",
          timestamp: Date.now(),
        });
      }
    },
  });
  return unwatch;
}
