import type { DexDisplayToken, DexMarketKind, DexToken } from "./types";

export type DexMarketConfig = {
  id: string;
  symbol: string;
  pairLabel: string;
  name: string;
  kind: DexMarketKind;
  network: string;
  networkName: string;
  chainId: number | null;
  dex: string;
  poolAddress: string;
  displayToken: DexDisplayToken;
  baseToken: DexToken;
  quoteToken: DexToken;
  /**
   * Whether `baseToken` corresponds to GeckoTerminal's pool "base_token" or
   * "quote_token" for this specific pool. GeckoTerminal assigns base/quote per
   * pool using its own heuristics, independent of which token we treat as the
   * market's primary asset — this field lets us pick the right price/OHLCV
   * field regardless. Defaults to "base" when omitted.
   */
  geckoBaseToken?: DexDisplayToken;
  chartSymbol?: string;
  leverage: number | null;
  color: string;
  executionVenue: string;
  fallback: {
    priceUsd: number;
    change24h: number;
    volume24hUsd: number;
    liquidityUsd: number;
    transactions24h: number;
  };
};

/**
 * Network ids: "hashkey" / "hashkey-testnet" markets are HSKSwap pools priced
 * on-chain (lib/dex/onchain-pool.ts) — GeckoTerminal does not index HSKSwap.
 * Other networks use GeckoTerminal / Binance.
 */
export const HASHKEY_NETWORKS = ["hashkey", "hashkey-testnet"] as const;

export function isHashKeyNetwork(network: string | null | undefined): boolean {
  return !!network && (HASHKEY_NETWORKS as readonly string[]).includes(network);
}

export const DEFAULT_DEX_MARKET_ID = "hashkey-whsk-usdt";

export const DEX_MARKETS: DexMarketConfig[] = [
  {
    id: "hashkey-whsk-usdt",
    symbol: "WHSK",
    pairLabel: "WHSK/USDT",
    name: "HashKey",
    kind: "spot",
    network: "hashkey",
    networkName: "HashKey Chain",
    chainId: 177,
    dex: "HSKSwap",
    poolAddress: "0x4ff515761864e7838b0adb8b5b2b8b7a068905dc",
    displayToken: "base",
    baseToken: {
      symbol: "WHSK",
      name: "Wrapped HSK",
      address: "0xb210d2120d57b758ee163cffb43e73728c471cf1",
    },
    quoteToken: {
      symbol: "USDT",
      name: "Tether USD",
      address: "0xf1b50ed67a9e2cc94ad3c477779e2d4cbfff9029",
    },
    leverage: null,
    color: "bg-indigo-500",
    executionVenue: "HSKSwap",
    fallback: {
      priceUsd: 0.0876,
      change24h: 0,
      volume24hUsd: 20000,
      liquidityUsd: 870000,
      transactions24h: 60,
    },
  },
  {
    id: "hashkey-weth-usdt",
    symbol: "WETH",
    pairLabel: "WETH/USDT",
    name: "Wrapped Ether",
    kind: "spot",
    network: "hashkey",
    networkName: "HashKey Chain",
    chainId: 177,
    dex: "HSKSwap",
    poolAddress: "0xb92b79ed6b370d5cfee2e14b1d0983c258304c16",
    displayToken: "base",
    baseToken: {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0xefd4bc9afd210517803f293ababd701caeecdfd0",
    },
    quoteToken: {
      symbol: "USDT",
      name: "Tether USD",
      address: "0xf1b50ed67a9e2cc94ad3c477779e2d4cbfff9029",
    },
    chartSymbol: "ETHUSDT",
    leverage: null,
    color: "bg-blue-500",
    executionVenue: "HSKSwap",
    fallback: {
      priceUsd: 2274,
      change24h: 0,
      volume24hUsd: 15000,
      liquidityUsd: 96000,
      transactions24h: 40,
    },
  },
  {
    id: "hashkey-wbtc-usdt",
    symbol: "WBTC",
    pairLabel: "WBTC/USDT",
    name: "Wrapped Bitcoin",
    kind: "spot",
    network: "hashkey",
    networkName: "HashKey Chain",
    chainId: 177,
    dex: "HSKSwap",
    poolAddress: "0xd9ea2ce468957ba49ccc38c4758ed6ecd561449a",
    displayToken: "base",
    baseToken: {
      symbol: "WBTC",
      name: "Wrapped Bitcoin",
      address: "0x6119ca49a79f5825c8b345f8d7ac36b272565b14",
    },
    quoteToken: {
      symbol: "USDT",
      name: "Tether USD",
      address: "0xf1b50ed67a9e2cc94ad3c477779e2d4cbfff9029",
    },
    chartSymbol: "BTCUSDT",
    leverage: null,
    color: "bg-orange-500",
    executionVenue: "HSKSwap",
    fallback: {
      priceUsd: 77454,
      change24h: 0,
      volume24hUsd: 15000,
      liquidityUsd: 101000,
      transactions24h: 40,
    },
  },
  {
    id: "hashkey-testnet-whsk-usdt",
    symbol: "WHSK",
    pairLabel: "WHSK/USDT",
    name: "HashKey (Testnet)",
    kind: "spot",
    network: "hashkey-testnet",
    networkName: "HashKey Chain Testnet",
    chainId: 133,
    dex: "HSKSwap",
    poolAddress: "0xc076fb478b77633736738579c7f48d2539604a50",
    displayToken: "base",
    baseToken: {
      symbol: "WHSK",
      name: "Wrapped HSK",
      address: "0xca8aaceec5db1e91b9ed3a344ba026c4a2b3ebf6",
    },
    quoteToken: {
      symbol: "USDT",
      name: "Tether USD",
      address: "0x98b6173a8b7dfc52ce8bc88f1184a918a1ccaa4f",
    },
    leverage: null,
    color: "bg-indigo-400",
    executionVenue: "HSKSwap",
    fallback: {
      priceUsd: 54.19,
      change24h: 0,
      volume24hUsd: 0,
      liquidityUsd: 30000,
      transactions24h: 0,
    },
  },
  {
    id: "eth-usdc-usdt",
    symbol: "USDC",
    pairLabel: "USDC/USDT",
    name: "USD Coin",
    kind: "spot",
    network: "eth",
    networkName: "Ethereum",
    chainId: 1,
    dex: "Uniswap v3",
    poolAddress: "0x3416cf6c708da44db2624d63ea0aaef7113527c6",
    displayToken: "base",
    baseToken: {
      symbol: "USDC",
      name: "USD Coin",
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    },
    quoteToken: {
      symbol: "USDT",
      name: "Tether USD",
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    },
    chartSymbol: "USDCUSDT",
    leverage: null,
    color: "bg-blue-500",
    executionVenue: "Uniswap API",
    fallback: {
      priceUsd: 1.000046,
      change24h: 0,
      volume24hUsd: 1291054,
      liquidityUsd: 46144975,
      transactions24h: 5000,
    },
  },
  {
    id: "base-weth-usdc",
    symbol: "WETH",
    pairLabel: "WETH/USDC",
    name: "Wrapped Ether",
    kind: "spot",
    network: "base",
    networkName: "Base",
    chainId: 8453,
    dex: "Uniswap v3",
    poolAddress: "0xb4cb800910b228ed3d0834cf79d697127bbb00e5",
    displayToken: "base",
    baseToken: {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x4200000000000000000000000000000000000006",
    },
    quoteToken: {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    },
    chartSymbol: "ETHUSDT",
    leverage: null,
    color: "bg-blue-500",
    executionVenue: "Uniswap API",
    fallback: {
      priceUsd: 2312.64,
      change24h: 0.36,
      volume24hUsd: 1054201,
      liquidityUsd: 267320,
      transactions24h: 15817,
    },
  },
  {
    id: "base-cbbtc-usdc",
    symbol: "cbBTC",
    pairLabel: "cbBTC/USDC",
    name: "Coinbase Wrapped BTC",
    kind: "spot",
    network: "base",
    networkName: "Base",
    chainId: 8453,
    dex: "Aerodrome",
    poolAddress: "0x4e962bb3889bf030368f56810a9c96b83cb3e778",
    displayToken: "base",
    baseToken: {
      symbol: "cbBTC",
      name: "Coinbase Wrapped BTC",
      address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
    },
    quoteToken: {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    },
    chartSymbol: "BTCUSDT",
    leverage: null,
    color: "bg-orange-500",
    executionVenue: "DEX router adapter",
    fallback: {
      priceUsd: 78465.81,
      change24h: 0.23,
      volume24hUsd: 35408699,
      liquidityUsd: 12383608,
      transactions24h: 10588,
    },
  },
  {
    id: "eth-uni-weth",
    symbol: "UNI",
    pairLabel: "UNI/WETH",
    name: "Uniswap",
    kind: "spot",
    network: "eth",
    networkName: "Ethereum",
    chainId: 1,
    dex: "Uniswap v3",
    poolAddress: "0x1d42064fc4beb5f8aaf85f4617ae8b3b5b8bd801",
    displayToken: "base",
    baseToken: {
      symbol: "UNI",
      name: "Uniswap",
      address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
    },
    quoteToken: {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    },
    chartSymbol: "UNIUSDT",
    leverage: null,
    color: "bg-pink-500",
    executionVenue: "Uniswap API",
    fallback: {
      priceUsd: 3.23,
      change24h: 0.34,
      volume24hUsd: 211670,
      liquidityUsd: 14144498,
      transactions24h: 4200,
    },
  },
  {
    id: "eth-link-weth",
    symbol: "LINK",
    pairLabel: "LINK/WETH",
    name: "Chainlink",
    kind: "spot",
    network: "eth",
    networkName: "Ethereum",
    chainId: 1,
    dex: "Uniswap v3",
    poolAddress: "0x5d4f3c6fa16908609bac31ff148bd002aa6b8c83",
    displayToken: "base",
    baseToken: {
      symbol: "LINK",
      name: "Chainlink",
      address: "0x514910771af9ca656af840dff83e8264ecf986ca",
    },
    quoteToken: {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    },
    chartSymbol: "LINKUSDT",
    leverage: null,
    color: "bg-blue-600",
    executionVenue: "Uniswap API",
    fallback: {
      priceUsd: 9.13,
      change24h: -0.46,
      volume24hUsd: 88038,
      liquidityUsd: 397767,
      transactions24h: 1800,
    },
  },
  {
    id: "eth-aave-weth",
    symbol: "AAVE",
    pairLabel: "AAVE/WETH",
    name: "Aave",
    kind: "spot",
    network: "eth",
    networkName: "Ethereum",
    chainId: 1,
    dex: "Uniswap v3",
    poolAddress: "0x4674abc5796e1334b5075326b39b748bee9eaa34",
    displayToken: "base",
    baseToken: {
      symbol: "AAVE",
      name: "Aave",
      address: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
    },
    quoteToken: {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    },
    chartSymbol: "AAVEUSDT",
    leverage: null,
    color: "bg-cyan-500",
    executionVenue: "Uniswap API",
    fallback: {
      priceUsd: 92.54,
      change24h: -0.02,
      volume24hUsd: 170935,
      liquidityUsd: 331861,
      transactions24h: 1600,
    },
  },
  {
    id: "eth-pepe-weth",
    symbol: "PEPE",
    pairLabel: "PEPE/WETH",
    name: "Pepe",
    kind: "spot",
    network: "eth",
    networkName: "Ethereum",
    chainId: 1,
    dex: "Uniswap v2",
    poolAddress: "0xa43fe16908251ee70ef74718545e4fe6c5ccec9f",
    displayToken: "base",
    baseToken: {
      symbol: "PEPE",
      name: "Pepe",
      address: "0x6982508145454ce325ddbe47a25d4ec3d2311933",
    },
    quoteToken: {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    },
    chartSymbol: "PEPEUSDT",
    leverage: null,
    color: "bg-green-500",
    executionVenue: "Uniswap API",
    fallback: {
      priceUsd: 0.000003947,
      change24h: 0.49,
      volume24hUsd: 329022,
      liquidityUsd: 27562602,
      transactions24h: 4100,
    },
  },
  {
    id: "arbitrum-arb-weth",
    symbol: "ARB",
    pairLabel: "ARB/WETH",
    name: "Arbitrum",
    kind: "spot",
    network: "arbitrum",
    networkName: "Arbitrum",
    chainId: 42161,
    dex: "Uniswap v3",
    poolAddress: "0xc6f780497a95e246eb9449f5e4770916dcd6396a",
    displayToken: "base",
    baseToken: {
      symbol: "ARB",
      name: "Arbitrum",
      address: "0x912ce59144191c1204e64559fe8253a0e49e6548",
    },
    quoteToken: {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    },
    chartSymbol: "ARBUSDT",
    leverage: null,
    color: "bg-sky-500",
    executionVenue: "Uniswap API",
    fallback: {
      priceUsd: 0.1192,
      change24h: -2.66,
      volume24hUsd: 4387582,
      liquidityUsd: 2277326,
      transactions24h: 8200,
    },
  },
  {
    id: "optimism-op-weth",
    symbol: "OP",
    pairLabel: "OP/WETH",
    name: "Optimism",
    kind: "spot",
    network: "optimism",
    networkName: "Optimism",
    chainId: 10,
    dex: "Velodrome",
    poolAddress: "0x4dc22588ade05c40338a9d95a6da9dcee68bcd60",
    displayToken: "base",
    baseToken: {
      symbol: "OP",
      name: "Optimism",
      address: "0x4200000000000000000000000000000000000042",
    },
    quoteToken: {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x4200000000000000000000000000000000000006",
    },
    chartSymbol: "OPUSDT",
    leverage: null,
    color: "bg-red-500",
    executionVenue: "DEX router adapter",
    fallback: {
      priceUsd: 0.1222,
      change24h: 0.88,
      volume24hUsd: 924300,
      liquidityUsd: 534144,
      transactions24h: 3600,
    },
  },
  {
    id: "gmx-btc-usd",
    symbol: "BTC",
    pairLabel: "BTC/USD",
    name: "Bitcoin Perp",
    kind: "perp",
    network: "arbitrum",
    networkName: "Arbitrum",
    chainId: 42161,
    dex: "GMX v2",
    poolAddress: "gmx:btc-usd",
    displayToken: "base",
    baseToken: {
      symbol: "BTC",
      name: "Bitcoin",
      address: "gmx:btc",
    },
    quoteToken: {
      symbol: "USD",
      name: "US Dollar",
      address: "gmx:usd",
    },
    chartSymbol: "BTCUSDT",
    leverage: 50,
    color: "bg-orange-500",
    executionVenue: "GMX perp adapter",
    fallback: {
      priceUsd: 78465.81,
      change24h: 0.23,
      volume24hUsd: 28125000,
      liquidityUsd: 18400000,
      transactions24h: 4210,
    },
  },
  {
    id: "gmx-eth-usd",
    symbol: "ETH",
    pairLabel: "ETH/USD",
    name: "Ethereum Perp",
    kind: "perp",
    network: "arbitrum",
    networkName: "Arbitrum",
    chainId: 42161,
    dex: "GMX v2",
    poolAddress: "gmx:eth-usd",
    displayToken: "base",
    baseToken: {
      symbol: "ETH",
      name: "Ethereum",
      address: "gmx:eth",
    },
    quoteToken: {
      symbol: "USD",
      name: "US Dollar",
      address: "gmx:usd",
    },
    chartSymbol: "ETHUSDT",
    leverage: 50,
    color: "bg-blue-500",
    executionVenue: "GMX perp adapter",
    fallback: {
      priceUsd: 2312.64,
      change24h: 0.37,
      volume24hUsd: 19860000,
      liquidityUsd: 12600000,
      transactions24h: 3820,
    },
  },
  {
    id: "gmx-avax-usd",
    symbol: "AVAX",
    pairLabel: "AVAX/USD",
    name: "Avalanche Perp",
    kind: "perp",
    network: "avalanche",
    networkName: "Avalanche",
    chainId: 43114,
    dex: "GMX v2",
    poolAddress: "gmx:avax-usd",
    displayToken: "base",
    baseToken: {
      symbol: "AVAX",
      name: "Avalanche",
      address: "gmx:avax",
    },
    quoteToken: {
      symbol: "USD",
      name: "US Dollar",
      address: "gmx:usd",
    },
    chartSymbol: "AVAXUSDT",
    leverage: 30,
    color: "bg-red-500",
    executionVenue: "GMX perp adapter",
    fallback: {
      priceUsd: 9.07,
      change24h: -0.6,
      volume24hUsd: 2640000,
      liquidityUsd: 3850000,
      transactions24h: 1260,
    },
  },
];

export function getDexMarketConfig(id: string | null | undefined) {
  return DEX_MARKETS.find((market) => market.id === id) ?? DEX_MARKETS[0];
}
