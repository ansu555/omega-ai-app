/**
 * HashKey Chain configurations — single source of truth for both HashKey Chain
 * Mainnet (177) and HashKey Chain Testnet (133) in the app.
 *
 * Trading venue: HSKSwap (https://app.hskswap.com), a Uniswap V3 fork. It ships
 * the V3 core + SwapRouter02 + QuoterV2 periphery, so the standard V3 ABIs
 * apply — but note SwapRouter02's `exactInputSingle` / `exactInput` params have
 * NO `deadline` field (see lib/dex/hskswap.ts).
 *
 * Contract addresses are from the HSKSwap developer docs and were verified
 * on-chain (bytecode present, SwapRouter02 selectors 0x04e45aaf / 0xb858183f,
 * factory fee tiers 100 / 500 / 3000 / 10000).
 *
 * Keep the configurations in sync with /realtime-service/src/config.ts.
 */

import { defineChain } from "viem";
import type { Address } from "viem";
import { NATIVE_TOKEN_ADDRESS, type ChainConfig } from "../types";

export const HASHKEY_MAINNET_CHAIN_ID = 177;
export const HASHKEY_TESTNET_CHAIN_ID = 133;

/**
 * Mainnet (177) is the default trading chain. Set
 * `NEXT_PUBLIC_HASHKEY_NETWORK=testnet` to opt into HashKey Chain Testnet (133)
 * — any other value (including unset) means real funds on mainnet.
 */
export const USE_HASHKEY_MAINNET = process.env.NEXT_PUBLIC_HASHKEY_NETWORK !== "testnet";

/** The chain the app trades on by default (agents, swap card, research). */
export const HASHKEY_CHAIN_ID = USE_HASHKEY_MAINNET
  ? HASHKEY_MAINNET_CHAIN_ID
  : HASHKEY_TESTNET_CHAIN_ID;

const MAINNET_RPC = process.env.NEXT_PUBLIC_HASHKEY_RPC?.trim() || "https://mainnet.hsk.xyz";
const MAINNET_WSS = process.env.NEXT_PUBLIC_HASHKEY_WSS?.trim() || "wss://mainnet.hsk.xyz/ws";
const TESTNET_RPC = process.env.NEXT_PUBLIC_HASHKEY_RPC_TESTNET?.trim() || "https://testnet.hsk.xyz";

const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as Address;

// ── Chain Definitions ────────────────────────────────────────────────────────

export const hashkeyMainnetChain = defineChain({
  id: HASHKEY_MAINNET_CHAIN_ID,
  name: "HashKey Chain",
  nativeCurrency: { name: "HashKey Platform Token", symbol: "HSK", decimals: 18 },
  rpcUrls: {
    default: { http: [MAINNET_RPC], webSocket: [MAINNET_WSS] },
  },
  blockExplorers: {
    default: { name: "HashKey Chain Explorer", url: "https://hashkey.blockscout.com" },
  },
  contracts: { multicall3: { address: MULTICALL3 } },
  testnet: false,
});

export const hashkeyTestnetChain = defineChain({
  id: HASHKEY_TESTNET_CHAIN_ID,
  name: "HashKey Chain Testnet",
  nativeCurrency: { name: "HashKey Platform Token", symbol: "HSK", decimals: 18 },
  rpcUrls: {
    default: { http: [TESTNET_RPC] },
  },
  blockExplorers: {
    default: { name: "HashKey Chain Testnet Explorer", url: "https://testnet-explorer.hsk.xyz" },
  },
  contracts: { multicall3: { address: MULTICALL3 } },
  testnet: true,
});

/** The active chain object + RPC (selected via NEXT_PUBLIC_HASHKEY_NETWORK). */
export const hashkeyChain = USE_HASHKEY_MAINNET ? hashkeyMainnetChain : hashkeyTestnetChain;
export const HASHKEY_RPC = USE_HASHKEY_MAINNET ? MAINNET_RPC : TESTNET_RPC;

// EIP-3085 Params for MetaMask
export const HASHKEY_MAINNET_PARAMS = {
  chainId: `0x${HASHKEY_MAINNET_CHAIN_ID.toString(16)}` as const,
  chainName: "HashKey Chain",
  nativeCurrency: { name: "HashKey Platform Token", symbol: "HSK", decimals: 18 },
  rpcUrls: [MAINNET_RPC],
  blockExplorerUrls: ["https://hashkey.blockscout.com/"],
} as const;

export const HASHKEY_TESTNET_PARAMS = {
  chainId: `0x${HASHKEY_TESTNET_CHAIN_ID.toString(16)}` as const,
  chainName: "HashKey Chain Testnet",
  nativeCurrency: { name: "HashKey Platform Token", symbol: "HSK", decimals: 18 },
  rpcUrls: [TESTNET_RPC],
  blockExplorerUrls: ["https://testnet-explorer.hsk.xyz/"],
} as const;

// ── HSKSwap (Uniswap V3 fork) ────────────────────────────────────────────────

export const HSKSWAP_MAINNET = {
  factory: "0x972cA9D1662F5e029cD18327D29026532E84c742" as Address,
  swapRouter02: "0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3" as Address,
  quoterV2: "0x603f70466fDdbE3F238220B9a74FFF419a2BbFDD" as Address,
  positionManager: "0xDF0A9b833Db0E4CeEa103A4408f3B68e7FC0cad5" as Address,
  multicall: "0x7D0CBa43EbDD69ec2CE3B5AeAD3b0FbC796c565B" as Address,
} as const;

export const HSKSWAP_TESTNET = {
  factory: "0x2dC2c21D1049F786C535bF9d45F999dB5474f3A0" as Address,
  swapRouter02: "0xa6914E66690c6794244B5f66a09eAEbf66254237" as Address,
  quoterV2: "0x73820d9eE5Bf1BfcD429580320FC7A374E8fa1cC" as Address,
  positionManager: "0x73dEc6bfa6751509b08480bd97f54b874E3b20e8" as Address,
  multicall: "0x47F625Ec29637445AA1570d7008Cf78692CdA096" as Address,
} as const;

/** HSKSwap contracts for the active network. */
export const HSKSWAP = USE_HASHKEY_MAINNET ? HSKSWAP_MAINNET : HSKSWAP_TESTNET;

// ── Verified token addresses (decimals read on-chain) ────────────────────────

const MAINNET_WHSK = "0xB210D2120d57b758EE163cFfb43e73728c471Cf1" as Address;
const MAINNET_USDT = "0xF1B50eD67A9e2CC94Ad3c477779E2d4cBfFf9029" as Address; // 6 decimals
const MAINNET_USDC_E = "0x054ed45810DbBAb8B27668922D110669c9D88D0a" as Address; // 6 decimals
const MAINNET_WETH = "0xefd4bC9afD210517803f293ABABd701CaeeCdfd0" as Address;
const MAINNET_WBTC = "0x6119CA49a79f5825C8B345F8d7aC36B272565b14" as Address; // 8 decimals

const TESTNET_WHSK = "0xCA8aAceEC5Db1e91B9Ed3a344bA026c4a2B3ebF6" as Address;
const TESTNET_USDT = "0x98B6173A8B7DFc52ce8bc88f1184a918A1CCaa4F" as Address; // 18 decimals
const TESTNET_USDC = "0x93F960a8DAB5A541e93e6DdaCD54F49a1750DE81" as Address; // 6 decimals

// ── Configurations ──────────────────────────────────────────────────────────

export const hashkeyMainnetConfig: ChainConfig = {
  chain: hashkeyMainnetChain,
  nativeWrapped: MAINNET_WHSK,
  // USDT is the only real hub. Verified on-chain 2026-11-02 by enumerating every
  // pool the HSKSwap position manager has ever minted into — exactly three have
  // usable liquidity, all at the 0.3% tier:
  //   WHSK/USDT  0x4ff515761864e7838B0AdB8b5b2B8B7A068905dC  ~4.99M WHSK / ~437k USDT
  //   WETH/USDT  0xb92b79ed6b370D5cFee2E14B1D0983C258304C16  ~21.2 WETH  / ~48.3k USDT
  //   WBTC/USDT  0xd9EA2cE468957Ba49cCC38C4758Ed6ecD561449A  ~0.655 WBTC / ~50.7k USDT
  // WETH<->WBTC therefore only routes two-hop through USDT.
  hubTokens: [MAINNET_USDT, MAINNET_WHSK],
  explorerUrl: "https://hashkey.blockscout.com",
  explorerTxPath: "/tx/",
  explorerAddressPath: "/address/",
  dexRouters: [
    {
      id: "hskswap",
      name: "HSKSwap",
      type: "custom",
      routerAddress: HSKSWAP_MAINNET.swapRouter02,
      quoterAddress: HSKSWAP_MAINNET.quoterV2,
    },
  ],
  tokens: {
    // Native gas coin. Not an ERC-20 — routed by wrapping to WHSK.
    HSK: {
      address: NATIVE_TOKEN_ADDRESS,
      name: "HashKey Platform Token",
      symbol: "HSK",
      decimals: 18,
      coingeckoId: "hashkey-ecopoints",
      isNative: true,
    },
    WHSK: {
      address: MAINNET_WHSK,
      name: "Wrapped HSK",
      symbol: "WHSK",
      decimals: 18,
      coingeckoId: "hashkey-ecopoints",
    },
    USDT: {
      address: MAINNET_USDT,
      name: "Tether USD",
      symbol: "USDT",
      decimals: 6,
      coingeckoId: "tether",
    },
    // Real contract (verified: "Bridged USDC", 6 dp) but effectively dead —
    // total supply ~1.8k and its only pool holds ~$0.08. Not Circle-issued.
    USDC: {
      address: MAINNET_USDC_E,
      name: "Bridged USD Coin",
      symbol: "USDC.e",
      decimals: 6,
      coingeckoId: "usd-coin",
      lowLiquidity: true,
    },
    WETH: {
      address: MAINNET_WETH,
      name: "Wrapped Ether",
      symbol: "WETH",
      decimals: 18,
      coingeckoId: "ethereum",
    },
    WBTC: {
      address: MAINNET_WBTC,
      name: "Wrapped Bitcoin",
      symbol: "WBTC",
      decimals: 8,
      coingeckoId: "bitcoin",
    },
  },
  omeswapPools: undefined,
  omeswapRouter: undefined,
  bridges: [
    {
      name: "HashKey Bridge (Superbridge)",
      url: "https://bridge.hashkeychain.net",
      kind: "official",
      description:
        "Canonical rollup bridge. Moves HSK and supported assets between Ethereum L1 and HashKey Chain. Withdrawals to L1 follow the standard challenge period.",
    },
    {
      name: "Orbiter Finance",
      url: "https://www.orbiter.finance/en?src_chain=1&tgt_chain=177&src_token=ETH",
      kind: "third-party",
      description:
        "Independent fast bridge for cross-rollup transfers. Minutes instead of the canonical withdrawal window, at a service fee.",
    },
  ],
};

export const hashkeyTestnetConfig: ChainConfig = {
  chain: hashkeyTestnetChain,
  nativeWrapped: TESTNET_WHSK,
  hubTokens: [TESTNET_WHSK, TESTNET_USDT, TESTNET_USDC],
  explorerUrl: "https://testnet-explorer.hsk.xyz",
  explorerTxPath: "/tx/",
  explorerAddressPath: "/address/",
  dexRouters: [
    {
      id: "hskswap",
      name: "HSKSwap",
      type: "custom",
      routerAddress: HSKSWAP_TESTNET.swapRouter02,
      quoterAddress: HSKSWAP_TESTNET.quoterV2,
    },
  ],
  tokens: {
    HSK: {
      address: NATIVE_TOKEN_ADDRESS,
      name: "HashKey Platform Token",
      symbol: "HSK",
      decimals: 18,
      coingeckoId: "hashkey-ecopoints",
      isNative: true,
    },
    WHSK: {
      address: TESTNET_WHSK,
      name: "Wrapped HSK",
      symbol: "WHSK",
      decimals: 18,
      coingeckoId: "hashkey-ecopoints",
    },
    USDT: {
      address: TESTNET_USDT,
      name: "Tether USD",
      symbol: "USDT",
      decimals: 18,
      coingeckoId: "tether",
    },
    USDC: {
      address: TESTNET_USDC,
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      coingeckoId: "usd-coin",
    },
  },
  // OmeSwap's own AMM (contract/) — set after `npx hardhat run scripts/deploy.js --network hashkeyTestnet`.
  omeswapPools: undefined,
  omeswapRouter: undefined,
  bridges: [
    {
      name: "HashKey Testnet Bridge",
      url: "https://testnet-bridge.hashkeychain.net/",
      kind: "official",
      description: "Canonical testnet bridge between Sepolia and HashKey Chain Testnet.",
    },
  ],
};
