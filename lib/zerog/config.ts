/**
 * 0G protocol service endpoints — Storage, Compute, DA.
 *
 * These are 0G's decentralized AI/data services, consumed by this app as
 * external infrastructure REGARDLESS of which chain the DEX trades on. They are
 * intentionally independent of the chain registry / default trading chain, so
 * the agent memory/inference/DA layer keeps working after the trading chain
 * moved to HashKey Chain.
 *
 * Select the 0G service network with NEXT_PUBLIC_0G_NETWORK=mainnet|testnet.
 */

type ZeroGNetwork = "mainnet" | "testnet";

type ZeroGServiceConfig = {
  /** 0G EVM chain id backing Storage/DA settlement (not the app's trading chain). */
  chainId: number;
  rpcUrl: string;
  storageIndexerUrl: string;
  daRpcUrl: string;
};

const ZERO_G_SERVICES: Record<ZeroGNetwork, ZeroGServiceConfig> = {
  mainnet: {
    chainId: 16661,
    rpcUrl: "https://evmrpc.0g.ai",
    storageIndexerUrl: "https://indexer-storage-turbo.0g.ai",
    daRpcUrl: "https://da-client.0g.ai",
  },
  testnet: {
    chainId: 16602,
    rpcUrl: "https://evmrpc-testnet.0g.ai",
    storageIndexerUrl: "https://indexer-storage-turbo-testnet.0g.ai",
    daRpcUrl: "https://da-client-testnet.0g.ai",
  },
};

const NETWORK_ALIASES: Record<string, ZeroGNetwork> = {
  mainnet: "mainnet",
  testnet: "testnet",
  galileo: "testnet",
  newton: "testnet",
};

function resolveZeroGNetwork(raw: string | undefined): ZeroGNetwork {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return "mainnet";
  return NETWORK_ALIASES[normalized] ?? "mainnet";
}

export const ZEROG_NETWORK: ZeroGNetwork = resolveZeroGNetwork(
  process.env.NEXT_PUBLIC_0G_NETWORK,
);
const ACTIVE = ZERO_G_SERVICES[ZEROG_NETWORK];

/** 0G EVM chain id backing Storage/DA settlement (not the app's trading chain). */
export const ZEROG_CHAIN_ID = ACTIVE.chainId;

/** 0G EVM RPC — used by the Storage SDK signer for upload settlement. */
export const ZEROG_RPC = process.env.NEXT_PUBLIC_0G_RPC?.trim() || ACTIVE.rpcUrl;

/** 0G Storage indexer — KV/Log store for persistent agent memory. */
export const ZEROG_STORAGE_RPC =
  process.env.NEXT_PUBLIC_0G_STORAGE_RPC ?? ACTIVE.storageIndexerUrl;

/** 0G DA RPC — data availability layer for high-throughput blobs. */
export const ZEROG_DA_RPC = process.env.NEXT_PUBLIC_0G_DA_RPC ?? ACTIVE.daRpcUrl;

/** 0G Compute gateway — AI inference (qwen3, GLM-5-FP8, …). */
export const ZEROG_COMPUTE_ENDPOINT =
  process.env.NEXT_PUBLIC_0G_COMPUTE_ENDPOINT ?? "https://compute-api.0g.ai/v1";
