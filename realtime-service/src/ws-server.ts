/**
 * Own WebSocket broadcast server. One process holds the single HashKey Chain
 * subscription (subscriber.ts) and fans every update out to all connected
 * frontend clients here — so N browsers cost one RPC connection, not N.
 *
 * On connect a client receives a full snapshot; thereafter it receives `pool`,
 * `price`, and `trade` deltas as swaps land.
 */

import { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { v3VirtualReserves } from "./price-math.js";
import { allPools, getPool, type PoolState } from "./price-state.js";
import { computeUsdPrices, type UsdPrices } from "./price-engine.js";
import type { SwapUpdate } from "./subscriber.js";
import {
  serialize,
  type ServerMessage,
  type WirePool,
  type WireTrade,
} from "./messages.js";

export function toWirePool(p: PoolState): WirePool {
  const { reserve0, reserve1 } = v3VirtualReserves(p.sqrtPriceX96, p.liquidity);
  return {
    address: p.address,
    pair: `${p.token0.symbol}/${p.token1.symbol}`,
    token0: p.token0.address,
    token1: p.token1.address,
    symbol0: p.token0.symbol,
    symbol1: p.token1.symbol,
    decimals0: p.token0.decimals,
    decimals1: p.token1.decimals,
    fee: p.fee,
    feeBps: p.fee / 100,
    price0in1: p.price0in1,
    reserve0: BigInt(Math.trunc(reserve0)).toString(),
    reserve1: BigInt(Math.trunc(reserve1)).toString(),
    updatedAt: p.updatedAt,
  };
}

export function pricesObject(usd: UsdPrices): Record<string, number> {
  return Object.fromEntries(usd);
}

function toWireTrade(u: SwapUpdate, usd: UsdPrices): WireTrade {
  const pool = getPool(u.poolAddress);
  const dec0 = pool?.token0.decimals ?? 18;
  const dec1 = pool?.token1.decimals ?? 18;

  const amt0 = Number(u.amount0) / 10 ** dec0; // signed, token0
  const amt1 = Number(u.amount1) / 10 ** dec1; // signed, token1
  const priceUsd = usd.get(u.token0Symbol) ?? 0;
  const amountUsd = Math.abs(amt0) * priceUsd;

  // "buy" = trader received token0 (amount0 < 0): in token1, out token0.
  const amountIn = u.side === "buy" ? Math.abs(amt1) : Math.abs(amt0);
  const amountOut = u.side === "buy" ? Math.abs(amt0) : Math.abs(amt1);

  return {
    id: `${u.txHash}-${u.poolAddress}`,
    poolAddress: u.poolAddress,
    pair: `${u.token0Symbol}/${u.token1Symbol}`,
    side: u.side,
    priceUsd,
    amountIn,
    amountOut,
    amountUsd,
    trader: u.recipient,
    txHash: u.txHash,
    timestamp: u.timestamp,
  };
}

let wss: WebSocketServer | null = null;

export function startWsServer(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server });

  wss.on("connection", (socket) => {
    const snapshot: ServerMessage = {
      type: "snapshot",
      pools: allPools().map(toWirePool),
      prices: pricesObject(computeUsdPrices()),
    };
    socket.send(serialize(snapshot));
  });

  wss.on("error", (err) => console.error("[ws-server] error:", err.message));
  console.log("[ws-server] attached to HTTP server");
  return wss;
}

function broadcast(msg: ServerMessage): void {
  if (!wss) return;
  const data = serialize(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}

/** Called on each Swap: push updated pool, refreshed USD prices, and the trade. */
export function publishSwap(u: SwapUpdate): void {
  const pool = getPool(u.poolAddress);
  if (pool) broadcast({ type: "pool", pool: toWirePool(pool) });

  const usd = computeUsdPrices();
  broadcast({ type: "price", prices: pricesObject(usd) });
  broadcast({ type: "trade", trade: toWireTrade(u, usd) });
}

export function clientCount(): number {
  return wss?.clients.size ?? 0;
}

export function stopWsServer(): void {
  wss?.close();
  wss = null;
}
