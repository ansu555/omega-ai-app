/**
 * REST layer (node:http, no framework). Serves first-paint / SSR reads and the
 * swap-route endpoint:
 *   GET /health                                  liveness + pool/client counts
 *   GET /price[?symbol=WHSK]                      USD prices (all, or one)
 *   GET /pools                                    current pool snapshot
 *   GET /route?tokenIn=&tokenOut=&amountIn=       best in-memory route estimate
 *   GET /markets[?id=]                            curated market list / one market
 *   GET /candles?market=&interval=                OHLCV candles for a market
 *   GET /trades?market=                           recent trades for a market
 *   GET /depth?market=                            synthetic AMM depth for a market
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ALLOWED_ORIGINS } from "./config.js";
import { allPools } from "./price-state.js";
import { computeUsdPrices } from "./price-engine.js";
import { quoteRoute } from "./router.js";
import { clientCount, pricesObject, toWirePool } from "./ws-server.js";
import { getCachedCandles, getCachedDepth, getCachedMarket, getCachedMarkets, getCachedTrades } from "./market-data.js";

const startedAt = Date.now();

function send(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(data);
}

const allowedIntervals = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
type AllowedInterval = (typeof allowedIntervals)[number];

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = new URL(req.url ?? "/", "http://localhost");

  switch (url.pathname) {
    case "/health":
      return send(res, 200, {
        status: "ok",
        pools: allPools().length,
        clients: clientCount(),
        uptimeMs: Date.now() - startedAt,
      });

    case "/price": {
      const prices = pricesObject(computeUsdPrices());
      const symbol = url.searchParams.get("symbol");
      if (symbol) {
        const price = prices[symbol];
        if (price === undefined) return send(res, 404, { error: `unknown symbol ${symbol}` });
        return send(res, 200, { symbol, price, updatedAt: Date.now() });
      }
      return send(res, 200, { prices, updatedAt: Date.now() });
    }

    case "/pools":
      return send(res, 200, { pools: allPools().map(toWirePool) });

    case "/route": {
      const tokenIn = url.searchParams.get("tokenIn");
      const tokenOut = url.searchParams.get("tokenOut");
      const amountIn = Number(url.searchParams.get("amountIn"));
      if (!tokenIn || !tokenOut || !(amountIn > 0)) {
        return send(res, 400, { error: "tokenIn, tokenOut and positive amountIn required" });
      }
      const route = quoteRoute(tokenIn, tokenOut, amountIn);
      if (!route) return send(res, 404, { error: "no route found" });
      return send(res, 200, route);
    }

    case "/markets": {
      const id = url.searchParams.get("id");
      if (id) return send(res, 200, { market: getCachedMarket(id) });
      return send(res, 200, { markets: getCachedMarkets() });
    }

    case "/candles": {
      const market = url.searchParams.get("market");
      const intervalParam = url.searchParams.get("interval");
      const interval = allowedIntervals.includes(intervalParam as AllowedInterval) ? (intervalParam as AllowedInterval) : "5m";
      const { candles, isFallback } = await getCachedCandles(market, interval);
      return send(res, 200, { candles, isFallback });
    }

    case "/trades": {
      const market = url.searchParams.get("market");
      const trades = await getCachedTrades(market);
      return send(res, 200, { trades });
    }

    case "/depth": {
      const market = url.searchParams.get("market");
      return send(res, 200, getCachedDepth(market));
    }

    default:
      return send(res, 404, { error: "not found" });
  }
}

function handleSafe(req: IncomingMessage, res: ServerResponse): void {
  handle(req, res).catch((err) => {
    console.error("[rest] handler error:", err?.message ?? err);
    if (!res.headersSent) send(res, 500, { error: "internal error" });
  });
}

let server: ReturnType<typeof createServer> | null = null;

export function startRestServer(port: number) {
  server = createServer(handleSafe);
  server.listen(port, () => console.log(`[rest] listening on http://0.0.0.0:${port}`));
  server.on("error", (err) => console.error("[rest] error:", err.message));
  return server;
}

export function stopRestServer(): void {
  server?.close();
  server = null;
}
