import type { OHLCVCandle } from "@/types/agent-builder-canvas";
import type { ChartInterval } from "@/store/chart";

export type BinanceKlineHandlers = {
  onSnapshot: (candles: OHLCVCandle[]) => void;
  onUpdate: (candle: OHLCVCandle) => void;
  onStatus: (status: "loading" | "live" | "error", error?: string) => void;
};

export type BinanceStreamOptions = {
  pair: string; // e.g. AVAXUSDT
  interval: ChartInterval;
  limit?: number;
  signal?: AbortSignal;
};

export function subscribeBinanceKlines(
  opts: BinanceStreamOptions,
  handlers: BinanceKlineHandlers,
): () => void {
  const { pair, interval, limit = 500, signal } = opts;
  let cancelled = false;
  let ws: WebSocket | null = null;

  handlers.onStatus("loading");

  fetch(
    `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`,
    { signal },
  )
    .then((r) => {
      if (!r.ok) throw new Error(`Binance ${r.status}`);
      return r.json();
    })
    .then((raw: [number, string, string, string, string, string, ...unknown[]][]) => {
      if (cancelled) return;
      const candles: OHLCVCandle[] = raw.map((k) => ({
        time: Math.floor(k[0] / 1000),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
      handlers.onSnapshot(candles);

      if (cancelled) return;
      ws = new WebSocket(
        `wss://stream.binance.com:9443/ws/${pair.toLowerCase()}@kline_${interval}`,
      );
      ws.onopen = () => {
        if (!cancelled) handlers.onStatus("live");
      };
      ws.onclose = () => {
        if (!cancelled) handlers.onStatus("error", "ws closed");
      };
      ws.onerror = () => {
        if (!cancelled) handlers.onStatus("error", "ws error");
      };
      ws.onmessage = (evt) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(evt.data as string);
          const k = msg.k;
          if (!k) return;
          handlers.onUpdate({
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
          });
        } catch {
          /* noop */
        }
      };
    })
    .catch((e: unknown) => {
      if (cancelled) return;
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("aborted")) return;
      handlers.onStatus("error", msg);
    });

  return () => {
    cancelled = true;
    if (ws) {
      try {
        ws.close();
      } catch {
        /* noop */
      }
      ws = null;
    }
  };
}
