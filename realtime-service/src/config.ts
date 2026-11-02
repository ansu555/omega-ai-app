/**
 * Service configuration — MIRRORS lib/chain-registry/chains/hashkey.ts in the
 * main app. Keep the two in sync when addresses change. This file is the
 * standalone-process equivalent so the service has no import dependency on the
 * Next.js build.
 */

import { defineChain, type Address } from "viem";

const env = (key: string, fallback: string): string =>
  process.env[key]?.trim() || fallback;

export const HASHKEY_NETWORK = env("HASHKEY_NETWORK", "mainnet");
const IS_TESTNET = HASHKEY_NETWORK === "testnet";

export const HASHKEY_CHAIN_ID = IS_TESTNET ? 133 : 177;
export const HASHKEY_RPC = env(
  "HASHKEY_RPC",
  IS_TESTNET ? "https://testnet.hsk.xyz" : "https://mainnet.hsk.xyz",
);
// No public testnet WebSocket endpoint is known; set HASHKEY_WSS explicitly
// when running against testnet.
export const HASHKEY_WSS = env(
  "HASHKEY_WSS",
  IS_TESTNET ? "wss://testnet.hsk.xyz/ws" : "wss://mainnet.hsk.xyz/ws",
);

export const hashkeyChain = defineChain({
  id: HASHKEY_CHAIN_ID,
  name: IS_TESTNET ? "HashKey Chain Testnet" : "HashKey Chain",
  nativeCurrency: { name: "HashKey Platform Token", symbol: "HSK", decimals: 18 },
  rpcUrls: {
    default: { http: [HASHKEY_RPC], webSocket: [HASHKEY_WSS] },
  },
  contracts: {
    // Canonical Multicall3 (present on HashKey Chain). Enables batched reads in
    // pool discovery / resync.
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
  testnet: IS_TESTNET,
});

// ── Tokens (decimals verified on-chain) ──────────────────────────────────────

export type TokenInfo = {
  address: Address;
  symbol: string;
  decimals: number;
  /** Treated as a $1 anchor for USD price derivation. */
  isStable?: boolean;
};

const MAINNET_TOKENS = {
  WHSK: { address: "0xb210d2120d57b758ee163cffb43e73728c471cf1", symbol: "WHSK", decimals: 18 },
  USDT: { address: "0xf1b50ed67a9e2cc94ad3c477779e2d4cbfff9029", symbol: "USDT", decimals: 6, isStable: true },
  USDC: { address: "0x054ed45810dbbab8b27668922d110669c9d88d0a", symbol: "USDC.e", decimals: 6, isStable: true },
  WETH: { address: "0xefd4bc9afd210517803f293ababd701caeecdfd0", symbol: "WETH", decimals: 18 },
  WBTC: { address: "0x6119ca49a79f5825c8b345f8d7ac36b272565b14", symbol: "WBTC", decimals: 8 },
} satisfies Record<string, TokenInfo>;

const TESTNET_TOKENS = {
  WHSK: { address: "0xca8aaceec5db1e91b9ed3a344ba026c4a2b3ebf6", symbol: "WHSK", decimals: 18 },
  USDT: { address: "0x98b6173a8b7dfc52ce8bc88f1184a918a1ccaa4f", symbol: "USDT", decimals: 18, isStable: true },
  USDC: { address: "0x93f960a8dab5a541e93e6ddacd54f49a1750de81", symbol: "USDC", decimals: 6, isStable: true },
} satisfies Record<string, TokenInfo>;

export const TOKENS: Record<string, TokenInfo> = IS_TESTNET ? TESTNET_TOKENS : MAINNET_TOKENS;

export const TOKEN_LIST: TokenInfo[] = Object.values(TOKENS);

/** Lower-cased address → token, for fast lookup when decoding logs. */
export const TOKENS_BY_ADDRESS: Map<string, TokenInfo> = new Map(
  TOKEN_LIST.map((t) => [t.address.toLowerCase(), t]),
);

/** Routing hubs, deepest liquidity first. */
export const HUB_TOKENS: Address[] = IS_TESTNET
  ? [TESTNET_TOKENS.WHSK.address, TESTNET_TOKENS.USDT.address, TESTNET_TOKENS.USDC.address]
  : [MAINNET_TOKENS.USDT.address, MAINNET_TOKENS.WHSK.address];

// ── V3 DEX factories on HashKey Chain (Uniswap V3 forks) ─────────────────────
// The service probes every factory × token-pair × fee-tier during discovery, so
// pools from any of these venues are tracked. Add a factory here to extend
// coverage. Addresses verified on-chain.

export type V3Factory = {
  id: string;
  address: Address;
  /** QuoterV2 for exact on-chain route fallback (optional). */
  quoter?: Address;
};

export const V3_FACTORIES: V3Factory[] = [
  IS_TESTNET
    ? {
        id: "hskswap",
        address: "0x2dC2c21D1049F786C535bF9d45F999dB5474f3A0",
        quoter: "0x73820d9eE5Bf1BfcD429580320FC7A374E8fa1cC",
      }
    : {
        id: "hskswap",
        address: "0x972cA9D1662F5e029cD18327D29026532E84c742",
        quoter: "0x603f70466fDdbE3F238220B9a74FFF419a2BbFDD",
      },
];

/** Fee tiers enabled on the HSKSwap factory (hundredths of a bip). */
export const V3_FEE_TIERS = [100, 500, 3000, 10000] as const;

// ── Service ports ─────────────────────────────────────────────────────────────

export const PORT = Number(env("PORT", "8080"));
export const ALLOWED_ORIGINS = env("ALLOWED_ORIGINS", "*");
