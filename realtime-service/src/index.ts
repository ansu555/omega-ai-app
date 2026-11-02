/**
 * Omeswap realtime-service entrypoint.
 *
 * Milestone 1 (current): boot → discover HSKSwap pools for the configured
 * token set → seed in-memory state from slot0 → subscribe to Swap events →
 * log every live price update to the console. This validates the end-to-end
 * real-time pipeline against HashKey Chain mainnet before any frontend wiring.
 *
 * Later milestones add the price engine, own WS broadcast server, and REST
 * routing on top of the same state + subscriber.
 */

import { PORT, HASHKEY_CHAIN_ID, HASHKEY_NETWORK, HASHKEY_WSS } from "./config.js";
import { loadPools } from "./pool-registry.js";
import { allPools } from "./price-state.js";
import { startSubscriber, stopSubscriber, swapEvents, type SwapUpdate } from "./subscriber.js";
import { publishSwap, startWsServer, stopWsServer } from "./ws-server.js";
import { startRestServer, stopRestServer } from "./rest.js";
import { startMarketDataPolling, stopMarketDataPolling } from "./market-data.js";

function fmtPrice(p: number): string {
  if (p === 0 || !Number.isFinite(p)) return "—";
  if (p >= 1) return p.toFixed(4);
  return p.toPrecision(4);
}

async function main(): Promise<void> {
  console.log(
    `[boot] HashKey Chain ${HASHKEY_NETWORK} (chainId ${HASHKEY_CHAIN_ID}) — subscribing via ${HASHKEY_WSS}`,
  );

  console.log("[boot] discovering pools…");
  const seeded = await loadPools();

  if (seeded.length === 0) {
    console.warn(
      "[boot] no pools found for the configured token set. Check token/factory addresses in config.ts.",
    );
  } else {
    console.log(`[boot] seeded ${seeded.length} pools:`);
    for (const p of allPools()) {
      console.log(
        `  ${p.token0.symbol}/${p.token1.symbol} fee=${p.fee} ` +
          `→ 1 ${p.token0.symbol} = ${fmtPrice(p.price0in1)} ${p.token1.symbol} ` +
          `(${p.address})`,
      );
    }
  }

  swapEvents.on("swap", (u: SwapUpdate) => {
    console.log(
      `[swap] ${u.token0Symbol}/${u.token1Symbol} ${u.side.toUpperCase()} ` +
        `1 ${u.token0Symbol} = ${fmtPrice(u.price0in1)} ${u.token1Symbol} ` +
        `block=${u.blockNumber} tx=${u.txHash.slice(0, 10)}…`,
    );
    publishSwap(u);
  });

  startSubscriber();
  const server = startRestServer(PORT);
  startWsServer(server);
  startMarketDataPolling();

  // Periodic resync: re-read pool state to correct any events missed during a
  // socket blip. slot0 only changes on swaps, so this is cheap belt-and-braces
  // on top of the live subscription.
  resyncTimer = setInterval(() => {
    loadPools().catch((e) => console.error("[resync] failed:", e?.message ?? e));
  }, 5 * 60 * 1000);
}

let resyncTimer: ReturnType<typeof setInterval> | null = null;

function shutdown(signal: string): void {
  console.log(`\n[shutdown] ${signal} — closing subscriptions and servers`);
  if (resyncTimer) clearInterval(resyncTimer);
  stopSubscriber();
  stopWsServer();
  stopRestServer();
  stopMarketDataPolling();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
