"use client";

import { useEffect } from "react";
import { useTerminalStore } from "@/store/terminal";
import { useChartStore } from "@/store/chart";
import { subscribeBinanceKlines } from "@/lib/terminal/data/binanceStream";
import { fetchCoingeckoOhlc } from "@/lib/terminal/data/coingeckoOhlc";
import { useRealtimeTerminalFeed } from "@/hooks/use-realtime-feed";

export function useChartData() {
  const activeSymbol = useTerminalStore((s) => s.activeSymbol);

  // Live pool reserves + trades for the active market, pushed from the
  // realtime-service (block-time on HashKey Chain). Feeds DepthTile / TradesTile via
  // the chart store. Candles below still come from Binance/CoinGecko.
  useRealtimeTerminalFeed(activeSymbol.symbol);
  const interval = useChartStore((s) => s.interval);
  const setCandles = useChartStore((s) => s.setCandles);
  const upsertCandle = useChartStore((s) => s.upsertCandle);
  const setLiveStatus = useChartStore((s) => s.setLiveStatus);
  const setLiveError = useChartStore((s) => s.setLiveError);

  useEffect(() => {
    if (activeSymbol.binancePair) {
      const stop = subscribeBinanceKlines(
        { pair: activeSymbol.binancePair, interval },
        {
          onSnapshot: (candles) => {
            setCandles(candles);
            setLiveError(null);
          },
          onUpdate: (candle) => upsertCandle(candle),
          onStatus: (s, err) => {
            setLiveStatus(s);
            if (err) setLiveError(err);
          },
        },
      );
      return stop;
    }

    if (activeSymbol.coingeckoId) {
      const ctrl = new AbortController();
      setLiveStatus("loading");
      fetchCoingeckoOhlc(activeSymbol.coingeckoId, interval, ctrl.signal)
        .then((candles) => {
          setCandles(candles);
          setLiveStatus("idle");
          setLiveError(null);
        })
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("aborted")) return;
          setLiveStatus("error");
          setLiveError(msg);
        });
      return () => ctrl.abort();
    }

    setCandles([]);
    setLiveStatus("idle");
    return undefined;
  }, [activeSymbol.binancePair, activeSymbol.coingeckoId, interval, setCandles, upsertCandle, setLiveStatus, setLiveError]);
}
