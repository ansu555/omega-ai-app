/**
 * viem clients for HashKey Chain. The WebSocket client powers real-time subscriptions
 * (eth_subscribe) and must be a pure webSocket transport — a fallback transport
 * can silently downgrade watchEvent to HTTP polling. The HTTP client is used for
 * batched reads (multicall) at startup and on resync.
 */

import { createPublicClient, http, webSocket } from "viem";
import { hashkeyChain, HASHKEY_RPC, HASHKEY_WSS } from "./config.js";

/** Pure WebSocket client — real-time push via eth_subscribe. */
export const wsClient = createPublicClient({
  chain: hashkeyChain,
  transport: webSocket(HASHKEY_WSS),
});

/** Pure HTTP client for batched/multicall reads at startup and resync. */
export const httpClient = createPublicClient({
  chain: hashkeyChain,
  transport: http(HASHKEY_RPC),
  batch: { multicall: true },
});
