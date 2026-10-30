import { DEX_MARKETS, getDexMarketConfig, isHashKeyNetwork, type DexMarketConfig } from "./markets";
import { readOnchainPool } from "./onchain-pool";
import type { DexCandle, DexDepth, DexDepthRow, DexMarket, DexTrade } from "./types";
import { getHSKSwapCandlesCached } from "./hskswap-history";

type GeckoPoolResponse = {
  data?: {
    attributes?: {
      base_token_price_usd?: string | null;
      quote_token_price_usd?: string | null;
      price_change_percentage?: Record<string, string | null> | null;
      volume_usd?: Record<string, string | null> | null;
      reserve_in_usd?: string | null;
      transactions?: Record<string, { buys?: number; sells?: number } | undefined> | null;
    };
  };
};

type GeckoOhlcvResponse = {
  data?: {
    attributes?: {
      ohlcv_list?: Array<[number, number, number, number, number, number]>;
    };
  };
};

type GeckoTradesResponse = {
  data?: Array<{
    id?: string;
    attributes?: {
      tx_hash?: string;
      from_token_amount?: string;
      to_token_amount?: string;
      price_from_in_usd?: string;
      price_to_in_usd?: string;
      block_timestamp?: string;
      kind?: "buy" | "sell";
      volume_in_usd?: string;
      from_token_address?: string;
      to_token_address?: string;
    };
  }>;
};

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

type BinanceTickerResponse = {
  lastPrice?: string;
  priceChangePercent?: string;
  quoteVolume?: string;
  count?: number;
};

type DexInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const GECKO_BASE_URL = "https://api.geckoterminal.com/api/v2";
const BINANCE_BASE_URL = "https://api.binance.com/api/v3";
const CACHE_SECONDS = 10;

/**
 * The realtime-service polls GeckoTerminal/Binance for the whole market list
 * on a shared interval and caches the results, so prefer it over hitting the
 * upstream APIs directly from every request. Falls back to the logic below
 * (direct fetch with per-request fallback data) if the service is unreachable.
 */
const REALTIME_HTTP_URL =
  process.env.REALTIME_HTTP_URL?.trim() ||
  process.env.NEXT_PUBLIC_REALTIME_HTTP_URL?.trim() ||
  "http://localhost:8080";

async function fetchFromRealtimeService<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${REALTIME_HTTP_URL}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getDexMarkets(): Promise<DexMarket[]> {
  const cached = await fetchFromRealtimeService<{ markets: DexMarket[] }>("/markets");
  if (cached?.markets?.length) {
    // The service only prices HashKey markets on its own network; read any it
    // could not price (source "fallback") straight from the pool instead.
    return Promise.all(
      cached.markets.map((market) =>
        market.source === "fallback" && isHashKeyNetwork(market.network)
          ? getOnchainMarket(getDexMarketConfig(market.id))
          : market,
      ),
    );
  }

  const markets = await Promise.all(DEX_MARKETS.map((market) => getDexMarket(market.id)));
  return markets;
}

export async function getDexMarket(id: string | null | undefined): Promise<DexMarket> {
  const config = getDexMarketConfig(id);

  const cached = await fetchFromRealtimeService<{ market: DexMarket }>(`/markets?id=${encodeURIComponent(config.id)}`);
  if (cached?.market && !(cached.market.source === "fallback" && isHashKeyNetwork(config.network))) {
    return cached.market;
  }

  if (config.kind === "perp") {
    return getBinanceMarket(config);
  }

  if (isHashKeyNetwork(config.network)) {
    return getOnchainMarket(config);
  }

  try {
    const response = await fetch(
      `${GECKO_BASE_URL}/networks/${config.network}/pools/${config.poolAddress}`,
      { next: { revalidate: CACHE_SECONDS } },
    );

    if (!response.ok) throw new Error(`GeckoTerminal pool request failed: ${response.status}`);

    const json = (await response.json()) as GeckoPoolResponse;
    const attrs = json.data?.attributes;
    if (!attrs) throw new Error("GeckoTerminal pool response missing attributes");

    const priceUsd =
      (config.geckoBaseToken ?? "base") === "base"
        ? toNumber(attrs.base_token_price_usd, config.fallback.priceUsd)
        : toNumber(attrs.quote_token_price_usd, config.fallback.priceUsd);
    const txns = attrs.transactions?.h24;

    return {
      ...marketStaticFields(config),
      priceUsd,
      change24h: toNumber(attrs.price_change_percentage?.h24, config.fallback.change24h),
      volume24hUsd: toNumber(attrs.volume_usd?.h24, config.fallback.volume24hUsd),
      liquidityUsd: toNumber(attrs.reserve_in_usd, config.fallback.liquidityUsd),
      transactions24h: (txns?.buys ?? 0) + (txns?.sells ?? 0) || config.fallback.transactions24h,
      source: "geckoterminal",
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return fallbackMarket(config);
  }
}

/**
 * Sorts candles by time and drops duplicate timestamps (keeping the last
 * occurrence), since lightweight-charts requires strictly ascending,
 * unique-by-time data and throws otherwise.
 */
function dedupeCandles(candles: DexCandle[]): DexCandle[] {
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const result: DexCandle[] = [];

  for (const candle of sorted) {
    if (result.length && result[result.length - 1].time === candle.time) {
      result[result.length - 1] = candle;
    } else {
      result.push(candle);
    }
  }

  return result;
}

export async function getDexCandles(
  id: string | null | undefined,
  interval: DexInterval,
  limit = 240,
): Promise<{ candles: DexCandle[]; isFallback: boolean }> {
  const config = getDexMarketConfig(id);

  const cached = await fetchFromRealtimeService<{ candles: DexCandle[]; isFallback: boolean }>(
    `/candles?market=${encodeURIComponent(config.id)}&interval=${interval}`,
  );
  if (cached?.candles) {
    return {
      candles: cached.candles,
      isFallback: !!cached.isFallback,
    };
  }

  // HSKSwap is not indexed by GeckoTerminal, so rebuild real OHLCV from the
  // pool's own Uniswap V3 Swap events rather than charting a synthetic series.
  //
  // This is checked BEFORE `chartSymbol`/Binance on purpose. WETH and WBTC
  // carry a Binance proxy symbol for other networks, but on HashKey the pool
  // IS the venue: its price differs from Binance's (HSKSwap WETH/USDT traded
  // at 2273.98 while Binance quoted ETHUSDT elsewhere), and an agent's own
  // swap moves this pool, not Binance. Charting the proxy would also stall
  // the market for ~76 s whenever Binance is unreachable from the server.
  if (isHashKeyNetwork(config.network)) {
    try {
      const onchain = await getHSKSwapCandlesCached(config, interval, limit);
      if (onchain.length) return { candles: onchain, isFallback: false };
    } catch {
      // Fall through to the synthetic series below, clearly flagged.
    }
    return { candles: fallbackCandles(config, interval, limit), isFallback: true };
  }

  if (config.chartSymbol) {
    const candles = await getBinanceCandles(config, interval, limit);
    if (candles.length) return { candles, isFallback: false };
  }

  if (config.kind === "perp") {
    return { candles: fallbackCandles(config, interval, limit), isFallback: true };
  }

  const { timeframe, aggregate } = intervalToGecko(interval);
  const token = config.geckoBaseToken ?? "base";

  try {
    const response = await fetch(
      `${GECKO_BASE_URL}/networks/${config.network}/pools/${config.poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=usd&token=${token}`,
      { next: { revalidate: CACHE_SECONDS } },
    );

    if (!response.ok) throw new Error(`GeckoTerminal OHLCV request failed: ${response.status}`);

    const json = (await response.json()) as GeckoOhlcvResponse;
    const rows = json.data?.attributes?.ohlcv_list ?? [];
    const candles = rows
      .map(([time, open, high, low, close, volume]) => ({
        time,
        open,
        high,
        low,
        close,
        volume,
      }))
      .filter((candle) => candle.time > 0 && candle.close > 0);
    const deduped = dedupeCandles(candles);

    return deduped.length
      ? { candles: deduped, isFallback: false }
      : { candles: fallbackCandles(config, interval, limit), isFallback: true };
  } catch {
    return { candles: fallbackCandles(config, interval, limit), isFallback: true };
  }
}

export async function getDexTrades(id: string | null | undefined): Promise<DexTrade[]> {
  const config = getDexMarketConfig(id);

  const cached = await fetchFromRealtimeService<{ trades: DexTrade[] }>(`/trades?market=${encodeURIComponent(config.id)}`);
  if (cached?.trades?.length) return cached.trades;

  if (config.kind === "perp" || isHashKeyNetwork(config.network)) {
    return fallbackTrades(config);
  }

  const displayAddress = displayToken(config).address.toLowerCase();

  try {
    const response = await fetch(
      `${GECKO_BASE_URL}/networks/${config.network}/pools/${config.poolAddress}/trades`,
      { next: { revalidate: CACHE_SECONDS } },
    );

    if (!response.ok) throw new Error(`GeckoTerminal trades request failed: ${response.status}`);

    const json = (await response.json()) as GeckoTradesResponse;
    const trades =
      json.data
        ?.map((row) => {
          const attrs = row.attributes;
          if (!attrs) return null;

          const fromAddress = attrs.from_token_address?.toLowerCase();
          const toAddress = attrs.to_token_address?.toLowerCase();
          const displayIsFrom = fromAddress === displayAddress;
          const displayIsTo = toAddress === displayAddress;
          const size = displayIsFrom
            ? toNumber(attrs.from_token_amount, 0)
            : displayIsTo
              ? toNumber(attrs.to_token_amount, 0)
              : 0;
          const priceUsd = displayIsFrom
            ? toNumber(attrs.price_from_in_usd, 0)
            : displayIsTo
              ? toNumber(attrs.price_to_in_usd, 0)
              : 0;

          return {
            id: row.id ?? attrs.tx_hash ?? `${attrs.block_timestamp}-${size}`,
            txHash: attrs.tx_hash ?? "",
            side: displayIsTo ? ("buy" as const) : ("sell" as const),
            priceUsd,
            size,
            volumeUsd: toNumber(attrs.volume_in_usd, 0),
            timestamp: attrs.block_timestamp ?? new Date().toISOString(),
          };
        })
        .filter((trade): trade is DexTrade => Boolean(trade && trade.priceUsd > 0 && trade.size > 0))
        .slice(0, 36) ?? [];

    return trades.length ? trades : fallbackTrades(config);
  } catch {
    return fallbackTrades(config);
  }
}

export async function getDexDepth(id: string | null | undefined): Promise<DexDepth> {
  const config = getDexMarketConfig(id);

  const cached = await fetchFromRealtimeService<DexDepth>(`/depth?market=${encodeURIComponent(config.id)}`);
  if (cached?.asks?.length) return cached;

  const market = await getDexMarket(id);
  return generateAmmDepth(market.priceUsd, market.liquidityUsd);
}

function marketStaticFields(config: DexMarketConfig) {
  return {
    id: config.id,
    symbol: config.symbol,
    pairLabel: config.pairLabel,
    name: config.name,
    kind: config.kind,
    network: config.network,
    networkName: config.networkName,
    chainId: config.chainId,
    dex: config.dex,
    poolAddress: config.poolAddress,
    baseToken: config.baseToken,
    quoteToken: config.quoteToken,
    displayToken: config.displayToken,
    leverage: config.leverage,
    color: config.color,
    executionVenue: config.executionVenue,
  };
}

/** HSKSwap pools: spot price + TVL from the pool contract (no indexer covers them). */
async function getOnchainMarket(config: DexMarketConfig): Promise<DexMarket> {
  try {
    const pool = await readOnchainPool(config);
    if (!(pool.priceInQuote > 0)) throw new Error("Pool has no price");
    return {
      ...marketStaticFields(config),
      ...config.fallback,
      priceUsd: pool.priceInQuote,
      liquidityUsd: pool.liquidityInQuote,
      source: "onchain",
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return fallbackMarket(config);
  }
}

function fallbackMarket(config: DexMarketConfig): DexMarket {
  return {
    ...marketStaticFields(config),
    ...config.fallback,
    source: "fallback",
    updatedAt: new Date().toISOString(),
  };
}

async function getBinanceMarket(config: DexMarketConfig): Promise<DexMarket> {
  if (!config.chartSymbol) return fallbackMarket(config);

  try {
    const response = await fetch(
      `${BINANCE_BASE_URL}/ticker/24hr?symbol=${encodeURIComponent(config.chartSymbol)}`,
      { next: { revalidate: CACHE_SECONDS } },
    );

    if (!response.ok) throw new Error(`Binance ticker request failed: ${response.status}`);

    const json = (await response.json()) as BinanceTickerResponse;

    return {
      ...marketStaticFields(config),
      priceUsd: toNumber(json.lastPrice, config.fallback.priceUsd),
      change24h: toNumber(json.priceChangePercent, config.fallback.change24h),
      volume24hUsd: toNumber(json.quoteVolume, config.fallback.volume24hUsd),
      liquidityUsd: config.fallback.liquidityUsd,
      transactions24h: json.count ?? config.fallback.transactions24h,
      source: "binance",
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return fallbackMarket(config);
  }
}

async function getBinanceCandles(
  config: DexMarketConfig,
  interval: DexInterval,
  limit: number,
): Promise<DexCandle[]> {
  if (!config.chartSymbol) return [];

  try {
    const safeLimit = Math.min(Math.max(limit, 1), 1000);
    const response = await fetch(
      `${BINANCE_BASE_URL}/klines?symbol=${encodeURIComponent(config.chartSymbol)}&interval=${interval}&limit=${safeLimit}`,
      { next: { revalidate: CACHE_SECONDS } },
    );

    if (!response.ok) throw new Error(`Binance klines request failed: ${response.status}`);

    const rows = (await response.json()) as BinanceKline[];

    return rows
      .map((row) => ({
        time: Math.floor(row[0] / 1000),
        open: toNumber(row[1], 0),
        high: toNumber(row[2], 0),
        low: toNumber(row[3], 0),
        close: toNumber(row[4], 0),
        volume: toNumber(row[7], toNumber(row[5], 0)),
      }))
      .filter(
        (candle) =>
          candle.time > 0 &&
          candle.open > 0 &&
          candle.high > 0 &&
          candle.low > 0 &&
          candle.close > 0,
      )
      .sort((a, b) => a.time - b.time);
  } catch {
    return [];
  }
}

function intervalToGecko(interval: DexInterval) {
  switch (interval) {
    case "1m":
      return { timeframe: "minute", aggregate: 1 };
    case "5m":
      return { timeframe: "minute", aggregate: 5 };
    case "15m":
      return { timeframe: "minute", aggregate: 15 };
    case "1h":
      return { timeframe: "hour", aggregate: 1 };
    case "4h":
      return { timeframe: "hour", aggregate: 4 };
    case "1d":
      return { timeframe: "day", aggregate: 1 };
  }
}

function intervalSeconds(interval: DexInterval) {
  switch (interval) {
    case "1m":
      return 60;
    case "5m":
      return 300;
    case "15m":
      return 900;
    case "1h":
      return 3600;
    case "4h":
      return 14400;
    case "1d":
      return 86400;
  }
}

function displayToken(config: DexMarketConfig) {
  return config.displayToken === "base" ? config.baseToken : config.quoteToken;
}

function fallbackCandles(config: DexMarketConfig, interval: DexInterval, limit: number): DexCandle[] {
  const step = intervalSeconds(interval);
  const now = Math.floor(Date.now() / 1000 / step) * step;
  const basePrice = config.fallback.priceUsd;
  const seed = seededValue(config.id);
  let close = basePrice * (1 - config.fallback.change24h / 100) * (1 + (seed - 0.5) * 0.008);

  return Array.from({ length: limit }, (_, index) => {
    const time = now - (limit - index - 1) * step;
    const open = close;
    const progress = index / Math.max(limit - 1, 1);
    const target = basePrice * (1 + (progress - 1) * (config.fallback.change24h / 100));
    const noise = (pseudoRandom(config.id, index) - 0.5) * basePrice * 0.0018;
    const meanReversion = (target - open) * 0.08;
    close = Math.max(basePrice * 0.2, open + meanReversion + noise);
    const wick = Math.max(Math.abs(close - open) * 0.55, basePrice * 0.00035);
    const high = Math.max(open, close) + wick * (0.7 + pseudoRandom(config.id, index + 17));
    const low = Math.max(0.000001, Math.min(open, close) - wick * (0.7 + pseudoRandom(config.id, index + 31)));

    return {
      time,
      open,
      high,
      low,
      close,
      volume: Math.max(config.fallback.volume24hUsd / Math.max(limit, 1), 1),
    };
  });
}

function seededValue(input: string) {
  return pseudoRandom(input, 1);
}

function pseudoRandom(input: string, index: number) {
  let hash = 2166136261;
  const key = `${input}:${index}`;

  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function fallbackTrades(config: DexMarketConfig): DexTrade[] {
  const price = config.fallback.priceUsd;
  return Array.from({ length: 24 }, (_, index) => {
    const side = index % 3 === 0 ? "sell" : "buy";
    const size = ((index % 5) + 1) * 12;
    return {
      id: `${config.id}-fallback-${index}`,
      txHash: "",
      side,
      priceUsd: price * (1 + Math.sin(index) * 0.002),
      size,
      volumeUsd: size * price,
      timestamp: new Date(Date.now() - index * 120000).toISOString(),
    };
  });
}

function generateAmmDepth(price: number, liquidityUsd: number): DexDepth {
  const safePrice = Math.max(price, 0.000001);
  const safeLiquidity = Math.max(liquidityUsd, safePrice * 1000);
  const quoteReserve = safeLiquidity / 2;
  const baseReserve = quoteReserve / safePrice;
  const invariant = quoteReserve * baseReserve;
  const step = 0.0025;

  const asks: DexDepthRow[] = [];
  const bids: DexDepthRow[] = [];
  let askTotal = 0;
  let bidTotal = 0;
  let previousAskSize = 0;
  let previousBidSize = 0;

  for (let level = 1; level <= 10; level += 1) {
    const askPrice = safePrice * (1 + step * level);
    const askQuoteReserve = Math.sqrt(invariant * askPrice);
    const askBaseReserve = invariant / askQuoteReserve;
    const askCumulativeSize = Math.max(0, baseReserve - askBaseReserve);
    const askSize = Math.max(0, askCumulativeSize - previousAskSize);
    askTotal += askSize;
    previousAskSize = askCumulativeSize;
    asks.push({
      price: askPrice,
      size: askSize,
      total: askTotal,
      notionalUsd: askSize * askPrice,
    });

    const bidPrice = safePrice * (1 - step * level);
    const bidBaseReserve = Math.sqrt(invariant / bidPrice);
    const bidCumulativeSize = Math.max(0, bidBaseReserve - baseReserve);
    const bidSize = Math.max(0, bidCumulativeSize - previousBidSize);
    bidTotal += bidSize;
    previousBidSize = bidCumulativeSize;
    bids.push({
      price: bidPrice,
      size: bidSize,
      total: bidTotal,
      notionalUsd: bidSize * bidPrice,
    });
  }

  return {
    asks: asks.reverse(),
    bids,
    spread: safePrice * step * 2,
    model: "constant-product",
    note: "Synthetic AMM depth estimated from pool liquidity, not a centralized order book.",
  };
}

function toNumber(value: string | number | null | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
