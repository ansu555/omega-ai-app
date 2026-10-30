export type DexMarketKind = "spot" | "perp";
export type DexDisplayToken = "base" | "quote";
export type DexSource = "geckoterminal" | "dexscreener" | "binance" | "onchain" | "fallback";

export type DexMarket = {
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
  baseToken: DexToken;
  quoteToken: DexToken;
  displayToken: DexDisplayToken;
  priceUsd: number;
  change24h: number;
  volume24hUsd: number;
  liquidityUsd: number;
  transactions24h: number;
  leverage: number | null;
  color: string;
  executionVenue: string;
  source: DexSource;
  updatedAt: string;
};

export type DexToken = {
  symbol: string;
  name: string;
  address: string;
};

export type DexCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type DexTrade = {
  id: string;
  txHash: string;
  side: "buy" | "sell";
  priceUsd: number;
  size: number;
  volumeUsd: number;
  timestamp: string;
};

export type DexDepthRow = {
  price: number;
  size: number;
  total: number;
  notionalUsd: number;
};

export type DexDepth = {
  asks: DexDepthRow[];
  bids: DexDepthRow[];
  spread: number;
  model: "constant-product";
  note: string;
};
