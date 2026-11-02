"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import {
  Camera,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ListFilter,
} from "lucide-react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type CandlestickData,
  type HistogramData,
  type HistogramSeriesPartialOptions,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type LineSeriesPartialOptions,
  type UTCTimestamp,
} from "lightweight-charts";
import type { DexCandle, DexMarket, DexTrade } from "@/lib/dex/types";
import { TokenIcon } from "./Icon";
import { pollLivePrice } from "@/lib/terminal/data/livePriceTick";
import { CandleAggregator } from "@/lib/terminal/data/candleAggregator";
import { getDefaultChainId, getChainConfig } from "@/lib/chain-registry";

type BtcCandle = CandlestickData<UTCTimestamp> & {
  volume: number;
};

type BtcStats = {
  symbol: string;
  pairLabel: string;
  networkName: string;
  dex: string;
  mark: number;
  index: number;
  changeAmount: number;
  changePercent: number;
  volume: number;
  liquidity: number;
  fundingRate: number;
  nextFundingTime: number;
};

type MarketResponse = {
  market: DexMarket;
};

type ChartResponse = {
  candles: DexCandle[];
  isFallback?: boolean;
};

const HISTORY_LIMIT = 240;
const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
const INDICATORS = [
  { key: "EMA 20", label: "EMA" },
  { key: "SMA 50", label: "SMA" },
  { key: "WMA 20", label: "WMA" },
  { key: "VWAP", label: "VWAP" },
  { key: "BB 20", label: "BB" },
  { key: "RSI 14", label: "RSI" },
  { key: "MACD", label: "MACD" },
  { key: "VOL", label: "VOL" },
] as const;

type ChartInterval = (typeof INTERVALS)[number];
type IndicatorName = (typeof INDICATORS)[number]["key"];

const chartColors = {
  background: "hsl(270 40% 4%)",
  foreground: "hsl(0 0% 98%)",
  muted: "hsl(220 10% 65%)",
  grid: "hsl(270 30% 18% / 0.7)",
  bull: "hsl(164 80% 54%)",
  bear: "hsl(0 72% 71%)",
  primary: "hsl(262 83% 71%)",
  panel: "hsl(270 40% 9%)",
};

export function Chart({ marketId }: { marketId: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const wmaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bollingerUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bollingerMiddleRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bollingerLowerRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiOverboughtRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiOversoldRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistogramRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesRef = useRef<BtcCandle[]>([]);
  const aggrRef = useRef<CandleAggregator | null>(null);
  const stopLiveTickRef = useRef<(() => void) | null>(null);
  const [interval, setInterval] = useState<ChartInterval>("1m");
  const [enabledIndicators, setEnabledIndicators] = useState<Record<IndicatorName, boolean>>({
    "EMA 20": true,
    "SMA 50": false,
    "WMA 20": false,
    VWAP: true,
    "BB 20": false,
    "RSI 14": false,
    MACD: false,
    VOL: true,
  });
  const [stats, setStats] = useState<BtcStats>({
    symbol: "WHSK",
    pairLabel: "WHSK/USDT",
    networkName: "HashKey Chain",
    dex: "HSKSwap",
    mark: 0,
    index: 0,
    changeAmount: 0,
    changePercent: 0,
    volume: 0,
    liquidity: 0,
    fundingRate: 0,
    nextFundingTime: 0,
  });
  const [latestCandle, setLatestCandle] = useState<BtcCandle | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "offline">("loading");
  const explorerBase = useMemo(() => {
    try {
      return getChainConfig(getDefaultChainId()).explorerUrl;
    } catch {
      return "https://hashkey.blockscout.com";
    }
  }, []);
  const [utcTime, setUtcTime] = useState("");
  const [bottomTab, setBottomTab] = useState("Positions (0)");
  const [indicatorMenuOpen, setIndicatorMenuOpen] = useState(false);
  const [trades, setTrades] = useState<DexTrade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);

  const syncIndicatorSeries = (
    candles: BtcCandle[],
    indicators: Record<IndicatorName, boolean>,
  ) => {
    const chart = chartRef.current;
    if (!chart) return;

    syncOptionalLine(chart, emaSeriesRef, indicators["EMA 20"], {
      color: "hsl(43 96% 56%)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })?.setData(indicators["EMA 20"] ? calculateEma(candles, 20) : []);

    syncOptionalLine(chart, smaSeriesRef, indicators["SMA 50"], {
      color: "hsl(203 90% 62%)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })?.setData(indicators["SMA 50"] ? calculateSma(candles, 50) : []);

    syncOptionalLine(chart, wmaSeriesRef, indicators["WMA 20"], {
      color: "hsl(25 95% 65%)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })?.setData(indicators["WMA 20"] ? calculateWma(candles, 20) : []);

    syncOptionalLine(chart, vwapSeriesRef, indicators.VWAP, {
      color: "hsl(326 90% 70%)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })?.setData(indicators.VWAP ? calculateVwap(candles) : []);

    const bands = indicators["BB 20"] ? calculateBollingerBands(candles, 20, 2) : null;
    syncOptionalLine(chart, bollingerUpperRef, indicators["BB 20"], {
      color: "hsl(262 83% 71% / 0.7)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })?.setData(bands?.upper ?? []);
    syncOptionalLine(chart, bollingerMiddleRef, indicators["BB 20"], {
      color: "hsl(262 83% 71% / 0.35)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })?.setData(bands?.middle ?? []);
    syncOptionalLine(chart, bollingerLowerRef, indicators["BB 20"], {
      color: "hsl(262 83% 71% / 0.7)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })?.setData(bands?.lower ?? []);

    const rsi = indicators["RSI 14"] ? calculateRsi(candles, 14) : [];
    const rsiGuide = rsi.length ? makeGuideLines(rsi, 70, 30) : { high: [], low: [] };
    syncOptionalLine(chart, rsiSeriesRef, indicators["RSI 14"], {
      color: "hsl(142 76% 58%)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: "price", precision: 1, minMove: 0.1 },
    }, 1)?.setData(rsi);
    syncOptionalLine(chart, rsiOverboughtRef, indicators["RSI 14"], {
      color: "hsl(0 72% 71% / 0.55)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: "price", precision: 1, minMove: 0.1 },
    }, 1)?.setData(rsiGuide.high);
    syncOptionalLine(chart, rsiOversoldRef, indicators["RSI 14"], {
      color: "hsl(164 80% 54% / 0.55)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: "price", precision: 1, minMove: 0.1 },
    }, 1)?.setData(rsiGuide.low);

    const macd = indicators.MACD ? calculateMacd(candles) : { macd: [], signal: [], histogram: [] };
    syncOptionalLine(chart, macdSeriesRef, indicators.MACD, {
      color: "hsl(203 90% 62%)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    }, 2)?.setData(macd.macd);
    syncOptionalLine(chart, macdSignalRef, indicators.MACD, {
      color: "hsl(43 96% 56%)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    }, 2)?.setData(macd.signal);
    syncOptionalHistogram(chart, macdHistogramRef, indicators.MACD, {
      priceFormat: { type: "price", precision: 1, minMove: 0.1 },
      priceLineVisible: false,
      lastValueVisible: false,
    }, 2)?.setData(macd.histogram);

    volumeSeriesRef.current?.setData(indicators.VOL ? candles.map(toVolume) : []);
    applyPaneStretch(chart);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: chartColors.background },
        textColor: chartColors.muted,
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "transparent" },
        horzLines: { color: chartColors.grid },
      },
      rightPriceScale: {
        borderColor: "transparent",
        textColor: chartColors.muted,
        scaleMargins: { top: 0.08, bottom: 0.28 },
      },
      timeScale: {
        borderColor: "transparent",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        barSpacing: 7,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "hsl(262 83% 71% / 0.45)",
          labelBackgroundColor: chartColors.primary,
        },
        horzLine: {
          color: "hsl(262 83% 71% / 0.45)",
          labelBackgroundColor: chartColors.primary,
        },
      },
      localization: {
        priceFormatter: (price: number) => formatCompactNumber(price),
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: chartColors.bull,
      downColor: chartColors.bear,
      borderUpColor: chartColors.bull,
      borderDownColor: chartColors.bear,
      wickUpColor: chartColors.bull,
      wickDownColor: chartColors.bear,
      priceLineColor: chartColors.primary,
      priceLineWidth: 1,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    chart.priceScale("").applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
      borderColor: "transparent",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      emaSeriesRef.current = null;
      smaSeriesRef.current = null;
      wmaSeriesRef.current = null;
      vwapSeriesRef.current = null;
      bollingerUpperRef.current = null;
      bollingerMiddleRef.current = null;
      bollingerLowerRef.current = null;
      rsiSeriesRef.current = null;
      rsiOverboughtRef.current = null;
      rsiOversoldRef.current = null;
      macdSeriesRef.current = null;
      macdSignalRef.current = null;
      macdHistogramRef.current = null;
    };
  }, []);

  useEffect(() => {
    const updateClock = () => {
      setUtcTime(new Date().toLocaleTimeString("en-GB", { timeZone: "UTC" }));
    };

    updateClock();
    const timer = window.setInterval(updateClock, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let disposed = false;
    const aborter = new AbortController();

    async function loadInitialChart() {
      setStatus("loading");

      try {
        const [chartResponse, marketResponse] = await Promise.all([
          fetch(`/api/dex/chart?market=${encodeURIComponent(marketId)}&interval=${interval}`, {
            signal: aborter.signal,
          }),
          fetch(`/api/dex/markets?id=${encodeURIComponent(marketId)}`, {
            signal: aborter.signal,
          }),
        ]);

        if (!chartResponse.ok || !marketResponse.ok) {
          throw new Error("Market feed request failed");
        }

        const chart = (await chartResponse.json()) as ChartResponse;
        const marketSnapshot = (await marketResponse.json()) as MarketResponse;

        if (disposed) return;

        const candles = chart.candles.map(toCandle).slice(-HISTORY_LIMIT);
        const last = candles[candles.length - 1] ?? null;
        const market = marketSnapshot.market;

        candlesRef.current = candles;
        candleSeriesRef.current?.setData(candles);
        syncIndicatorSeries(candles, enabledIndicators);
        chartRef.current?.timeScale().fitContent();

        setLatestCandle(last);
        setStats({
          symbol: market.symbol,
          pairLabel: market.pairLabel,
          networkName: market.networkName,
          dex: market.dex,
          mark: market.priceUsd,
          index: market.priceUsd,
          changeAmount: market.priceUsd * (market.change24h / 100),
          changePercent: market.change24h,
          volume: market.volume24hUsd,
          liquidity: market.liquidityUsd,
          fundingRate: 0,
          nextFundingTime: 0,
        });
        if (chart.isFallback || candles.length === 0) {
          setStatus("loading");
        } else {
          setStatus("live");
        }

        // Seed a fresh aggregator from the reloaded history and restart live ticker
        aggrRef.current = new CandleAggregator(interval);
        stopLiveTickRef.current?.();
        stopLiveTickRef.current = pollLivePrice({
          marketId,
          onTick: (price) => {
            if (disposed) return;
            const live = aggrRef.current?.tick(price);
            if (!live) return;
            candleSeriesRef.current?.update({
              time: live.time,
              open: live.open,
              high: live.high,
              low: live.low,
              close: live.close,
            });
            volumeSeriesRef.current?.update({
              time: live.time,
              value: 0,
              color: live.close >= live.open ? `${chartColors.bull}80` : `${chartColors.bear}80`,
            });
            setLatestCandle((prev) =>
              prev
                ? ({ ...prev, time: live.time, open: live.open, high: live.high, low: live.low, close: live.close } as BtcCandle)
                : (live as BtcCandle),
            );
            setStats((prev) => ({ ...prev, mark: live.close, index: live.close }));
          },
        });
      } catch {
        if (!disposed && !aborter.signal.aborted) {
          setStatus("offline");
        }
      }
    }

    loadInitialChart();
    const timer = window.setInterval(loadInitialChart, 30000);

    return () => {
      disposed = true;
      aborter.abort();
      window.clearInterval(timer);
      stopLiveTickRef.current?.();
      stopLiveTickRef.current = null;
    };
  }, [enabledIndicators, interval, marketId]);

  useEffect(() => {
    let disposed = false;

    async function loadTrades() {
      setTradesLoading(true);
      try {
        const response = await fetch(`/api/dex/trades?market=${encodeURIComponent(marketId)}`);
        if (!response.ok) throw new Error("Trades request failed");
        const data = (await response.json()) as { trades: DexTrade[] };
        if (!disposed) setTrades(data.trades ?? []);
      } catch {
        if (!disposed) setTrades([]);
      } finally {
        if (!disposed) setTradesLoading(false);
      }
    }

    loadTrades();
    const timer = window.setInterval(loadTrades, 30000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [marketId]);

  const ohlcText = useMemo(() => {
    if (!latestCandle) return "Waiting for market feed";

    const delta = latestCandle.close - latestCandle.open;
    const percent = latestCandle.open ? (delta / latestCandle.open) * 100 : 0;
    const tone = delta >= 0 ? "text-bull" : "text-bear";

    return (
      <>
        O<span className={tone}>{formatCompactNumber(latestCandle.open)} </span>
        H<span className={tone}>{formatCompactNumber(latestCandle.high)} </span>
        L<span className={tone}>{formatCompactNumber(latestCandle.low)} </span>
        C<span className={tone}>{formatCompactNumber(latestCandle.close)} </span>
        <span className={tone}>
          {delta >= 0 ? "+" : ""}
          {formatCompactNumber(delta)} ({delta >= 0 ? "+" : ""}
          {percent.toFixed(2)}%)
        </span>
      </>
    );
  }, [latestCandle]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-background">
      <div className="flex items-center gap-4 px-4 h-16 border-b border-border overflow-hidden">
        <button className="text-muted-foreground hover:text-foreground" aria-label="Previous market">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <TokenIcon symbol={stats.symbol} color="bg-violet-500" size={32} />
          <span className="text-xl font-semibold">{stats.symbol}</span>
          <button className="ml-2 text-xs px-2.5 py-1 rounded-md bg-panel text-foreground hover:bg-panel-hover border border-border">
            Follow
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 flex-1 min-w-0">
          <Stat label="Mark" value={stats.mark ? formatUsd(stats.mark) : "..."} />
          <Stat label="Liquidity" value={stats.liquidity ? formatUsd(stats.liquidity) : "..."} />
          <Stat
            label="24h Change"
            value={formatSignedPercent(stats.changePercent)}
            valueClass={stats.changePercent >= 0 ? "text-bull" : "text-bear"}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 h-9 border-b border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-1 shrink-0">
          {INTERVALS.map((value) => (
            <button
              key={value}
              onClick={() => setInterval(value)}
              className={`h-6 px-2 rounded ${
                interval === value ? "bg-primary/20 text-foreground" : "hover:text-foreground hover:bg-panel"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <button className="hover:text-foreground" aria-label="Chart settings">
          <ListFilter className="h-4 w-4" />
        </button>

        <div className="relative shrink-0">
          <button
            onClick={() => setIndicatorMenuOpen((current) => !current)}
            className="flex h-6 items-center gap-1 rounded border border-border bg-panel px-2 text-foreground hover:bg-panel-hover"
          >
            Indicators
            <span className="text-muted-foreground">{activeIndicatorCount(enabledIndicators)}</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {indicatorMenuOpen ? (
            <div className="absolute left-0 top-8 z-50 w-44 rounded-md border border-border bg-background p-1 shadow-xl">
              {INDICATORS.map((indicator) => (
                <button
                  key={indicator.key}
                  onClick={() =>
                    setEnabledIndicators((current) => ({
                      ...current,
                      [indicator.key]: !current[indicator.key],
                    }))
                  }
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-panel"
                >
                  <span>{indicator.key}</span>
                  <span
                    className={`h-3 w-3 rounded-sm border ${
                      enabledIndicators[indicator.key] ? "border-primary bg-primary" : "border-border bg-transparent"
                    }`}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === "live" ? "bg-bull animate-pulse" : status === "loading" ? "bg-primary" : "bg-bear"
            }`}
          />
          {status === "live" ? "Live" : status === "loading" ? "Loading" : "Offline"}
        </span>
        <button className="hover:text-foreground" aria-label="Capture chart">
          <Camera className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 relative min-h-[320px]">
        <div ref={containerRef} className="absolute inset-0" />

        <div className="absolute left-3 top-2 text-xs pointer-events-none">
          <div className="text-foreground">
            {stats.pairLabel} · {interval} · {stats.dex} <span className={status === "live" ? "text-bull" : "text-bear"}>●</span>
          </div>
          <div className="tabular mt-1 text-muted-foreground">{ohlcText}</div>
          <div className="mt-1 text-muted-foreground">
            Volume <span className="text-foreground">{latestCandle ? formatVolume(latestCandle.volume) : "..."}</span>
          </div>
        </div>

        {status === "loading" && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm font-medium text-foreground">Loading chart data...</span>
            <span className="text-xs text-muted-foreground">Fetching live token details from HashKey Chain</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 px-3 h-10 border-t border-border text-xs text-muted-foreground">
        {["1d", "1w", "1m", "3m", "6m", "1y", "5y"].map((t) => (
          <button key={t} className={t === "1d" ? "text-foreground" : "hover:text-foreground"}>
            {t}
          </button>
        ))}
        <button className="ml-1 hover:text-foreground" aria-label="Date range">
          <CalendarDays className="h-3.5 w-3.5" />
        </button>
        <span className="ml-auto tabular">{utcTime || "--:--:--"} (UTC)</span>
        <button className="hover:text-foreground">%</button>
        <button className="hover:text-foreground">log</button>
        <button className="text-foreground">auto</button>
      </div>

      <div className="border-t border-border">
        <div className="grid grid-cols-4 text-sm">
          {["Positions (0)", "Swaps", "Pool", "Receipts"].map((t) => (
            <button
              key={t}
              onClick={() => setBottomTab(t)}
              className={`py-3 font-medium ${
                bottomTab === t ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <BottomPanel activeTab={bottomTab} stats={stats} trades={trades} tradesLoading={tradesLoading} explorerBase={explorerBase} />
      </div>
    </div>
  );
}

function Stat({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex flex-col shrink-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`text-xs tabular whitespace-nowrap ${valueClass}`}>{value}</span>
    </div>
  );
}

function BottomPanel({
  activeTab,
  stats,
  trades,
  tradesLoading,
  explorerBase,
}: {
  activeTab: string;
  stats: BtcStats;
  trades: DexTrade[];
  tradesLoading: boolean;
  explorerBase: string;
}) {
  const { openConnectModal } = useConnectModal();
  const { isConnected } = useAccount();

  if (activeTab === "Pool") {
    return (
      <div className="h-48 grid grid-cols-3 gap-px bg-border/50 text-sm">
        <FundingCell label="Pool Liquidity" value={stats.liquidity ? formatUsd(stats.liquidity) : "..."} />
        <FundingCell label="Network" value={stats.networkName} />
        <FundingCell label="Depth Model" value="AMM curve" />
      </div>
    );
  }

  if (activeTab === "Swaps") {
    return (
      <div className="h-48 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-background border-b border-border">
            <tr className="text-muted-foreground">
              <th className="text-left px-3 py-1.5 font-medium">Side</th>
              <th className="text-right px-3 py-1.5 font-medium">Price</th>
              <th className="text-right px-3 py-1.5 font-medium">Amount</th>
              <th className="text-right px-3 py-1.5 font-medium">Value</th>
              <th className="text-right px-3 py-1.5 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {tradesLoading && trades.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-6 text-muted-foreground">
                  Loading trades…
                </td>
              </tr>
            ) : trades.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-6 text-muted-foreground">
                  No recent trades
                </td>
              </tr>
            ) : (
              trades.map((trade) => (
                <tr
                  key={trade.id}
                  className="border-b border-border/30 hover:bg-panel/50 transition-colors"
                >
                  <td className={`px-3 py-1.5 font-semibold ${trade.side === "buy" ? "text-bull" : "text-bear"}`}>
                    {trade.side === "buy" ? "BUY" : "SELL"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular text-foreground">
                    {formatCompactNumber(trade.priceUsd)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular text-muted-foreground">
                    {formatVolume(trade.size)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular text-muted-foreground">
                    {formatUsd(trade.volumeUsd)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular text-muted-foreground">
                    {trade.txHash ? (
                      <a
                        href={`${explorerBase}/tx/${trade.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors"
                        title={new Date(trade.timestamp).toLocaleString()}
                      >
                        {formatRelativeTime(trade.timestamp)}
                      </a>
                    ) : (
                      <span title={new Date(trade.timestamp).toLocaleString()}>
                        {formatRelativeTime(trade.timestamp)}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="h-48 flex flex-col items-center justify-center gap-2">
        <div className="text-sm text-muted-foreground">No open positions</div>
        <div className="text-xs text-muted-foreground/60">Positions will appear here once you trade</div>
      </div>
    );
  }

  return (
    <div className="h-48 flex flex-col items-center justify-center gap-3">
      <div className="text-sm text-muted-foreground">No wallet detected</div>
      <button
        onClick={openConnectModal}
        className="px-6 h-9 rounded-full bg-primary/15 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/25 transition-colors"
      >
        Connect Wallet
      </button>
    </div>
  );
}

function FundingCell({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-background flex flex-col justify-center px-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`mt-2 text-lg tabular ${tone}`}>{value}</span>
    </div>
  );
}

function syncOptionalLine(
  chart: IChartApi,
  ref: MutableRefObject<ISeriesApi<"Line"> | null>,
  enabled: boolean,
  options: LineSeriesPartialOptions,
  paneIndex = 0,
) {
  if (!enabled) {
    removeSeries(chart, ref);
    return null;
  }

  if (!ref.current) {
    ref.current = chart.addSeries(LineSeries, options, paneIndex);
  }

  return ref.current;
}

function syncOptionalHistogram(
  chart: IChartApi,
  ref: MutableRefObject<ISeriesApi<"Histogram"> | null>,
  enabled: boolean,
  options: HistogramSeriesPartialOptions,
  paneIndex = 0,
) {
  if (!enabled) {
    removeSeries(chart, ref);
    return null;
  }

  if (!ref.current) {
    ref.current = chart.addSeries(HistogramSeries, options, paneIndex);
  }

  return ref.current;
}

function removeSeries<T extends "Line" | "Histogram">(
  chart: IChartApi,
  ref: MutableRefObject<ISeriesApi<T> | null>,
) {
  if (ref.current) {
    chart.removeSeries(ref.current);
    ref.current = null;
  }
}

function applyPaneStretch(chart: IChartApi) {
  const panes = chart.panes();

  panes[0]?.setStretchFactor(7);
  panes[1]?.setStretchFactor(1.6);
  panes[2]?.setStretchFactor(1.6);
}

function activeIndicatorCount(indicators: Record<IndicatorName, boolean>) {
  return Object.values(indicators).filter(Boolean).length;
}

function toCandle(candle: DexCandle): BtcCandle {
  return {
    time: candle.time as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  };
}

function toVolume(candle: BtcCandle): HistogramData<UTCTimestamp> {
  return {
    time: candle.time,
    value: candle.volume,
    color: candle.close >= candle.open ? "hsl(164 80% 54% / 0.42)" : "hsl(0 72% 71% / 0.42)",
  };
}

function calculateSma(candles: BtcCandle[], period: number): LineData<UTCTimestamp>[] {
  const data: LineData<UTCTimestamp>[] = [];
  let rolling = 0;

  candles.forEach((candle, index) => {
    rolling += candle.close;
    if (index >= period) rolling -= candles[index - period].close;
    if (index >= period - 1) {
      data.push({ time: candle.time, value: rolling / period });
    }
  });

  return data;
}

function calculateEma(candles: BtcCandle[], period: number): LineData<UTCTimestamp>[] {
  if (candles.length < period) return [];

  const data: LineData<UTCTimestamp>[] = [];
  const multiplier = 2 / (period + 1);
  let ema = candles.slice(0, period).reduce((sum, candle) => sum + candle.close, 0) / period;

  data.push({ time: candles[period - 1].time, value: ema });

  for (let index = period; index < candles.length; index += 1) {
    ema = (candles[index].close - ema) * multiplier + ema;
    data.push({ time: candles[index].time, value: ema });
  }

  return data;
}

function calculateWma(candles: BtcCandle[], period: number): LineData<UTCTimestamp>[] {
  if (candles.length < period) return [];

  const denominator = (period * (period + 1)) / 2;
  const data: LineData<UTCTimestamp>[] = [];

  for (let index = period - 1; index < candles.length; index += 1) {
    let weighted = 0;
    for (let offset = 0; offset < period; offset += 1) {
      weighted += candles[index - offset].close * (period - offset);
    }
    data.push({ time: candles[index].time, value: weighted / denominator });
  }

  return data;
}

function calculateBollingerBands(candles: BtcCandle[], period: number, stdDev: number) {
  const middle: LineData<UTCTimestamp>[] = [];
  const upper: LineData<UTCTimestamp>[] = [];
  const lower: LineData<UTCTimestamp>[] = [];

  if (candles.length < period) return { middle, upper, lower };

  for (let index = period - 1; index < candles.length; index += 1) {
    const window = candles.slice(index - period + 1, index + 1);
    const mean = window.reduce((sum, candle) => sum + candle.close, 0) / period;
    const variance = window.reduce((sum, candle) => sum + (candle.close - mean) ** 2, 0) / period;
    const band = Math.sqrt(variance) * stdDev;
    const time = candles[index].time;

    middle.push({ time, value: mean });
    upper.push({ time, value: mean + band });
    lower.push({ time, value: mean - band });
  }

  return { middle, upper, lower };
}

function calculateRsi(candles: BtcCandle[], period: number): LineData<UTCTimestamp>[] {
  if (candles.length <= period) return [];

  const data: LineData<UTCTimestamp>[] = [];
  let gain = 0;
  let loss = 0;

  for (let index = 1; index <= period; index += 1) {
    const change = candles[index].close - candles[index - 1].close;
    gain += Math.max(change, 0);
    loss += Math.max(-change, 0);
  }

  let avgGain = gain / period;
  let avgLoss = loss / period;
  data.push({ time: candles[period].time, value: rsiFromAverages(avgGain, avgLoss) });

  for (let index = period + 1; index < candles.length; index += 1) {
    const change = candles[index].close - candles[index - 1].close;
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
    data.push({ time: candles[index].time, value: rsiFromAverages(avgGain, avgLoss) });
  }

  return data;
}

function calculateMacd(candles: BtcCandle[]) {
  const macd: LineData<UTCTimestamp>[] = [];
  const signal: LineData<UTCTimestamp>[] = [];
  const histogram: HistogramData<UTCTimestamp>[] = [];
  const fast = calculateEmaValues(candles, 12);
  const slow = calculateEmaValues(candles, 26);
  const macdValues: { time: UTCTimestamp; value: number }[] = [];

  candles.forEach((candle, index) => {
    const fastValue = fast[index];
    const slowValue = slow[index];
    if (fastValue === undefined || slowValue === undefined) return;

    macdValues.push({ time: candle.time, value: fastValue - slowValue });
  });

  const signalValues = calculateEmaForValues(macdValues, 9);

  macdValues.forEach((point, index) => {
    macd.push(point);
    const signalValue = signalValues[index];

    if (signalValue === undefined) return;

    signal.push({ time: point.time, value: signalValue });
    const diff = point.value - signalValue;
    histogram.push({
      time: point.time,
      value: diff,
      color: diff >= 0 ? "hsl(164 80% 54% / 0.5)" : "hsl(0 72% 71% / 0.5)",
    });
  });

  return { macd, signal, histogram };
}

function calculateVwap(candles: BtcCandle[]): LineData<UTCTimestamp>[] {
  const data: LineData<UTCTimestamp>[] = [];
  let priceVolume = 0;
  let volume = 0;

  candles.forEach((candle) => {
    const typical = (candle.high + candle.low + candle.close) / 3;
    priceVolume += typical * candle.volume;
    volume += candle.volume;
    if (volume > 0) {
      data.push({ time: candle.time, value: priceVolume / volume });
    }
  });

  return data;
}

function makeGuideLines(data: LineData<UTCTimestamp>[], high: number, low: number) {
  return {
    high: data.map((point) => ({ time: point.time, value: high })),
    low: data.map((point) => ({ time: point.time, value: low })),
  };
}

function rsiFromAverages(avgGain: number, avgLoss: number) {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calculateEmaValues(candles: BtcCandle[], period: number) {
  if (candles.length < period) return [];

  const values: Array<number | undefined> = Array(candles.length).fill(undefined);
  const multiplier = 2 / (period + 1);
  let ema = candles.slice(0, period).reduce((sum, candle) => sum + candle.close, 0) / period;

  values[period - 1] = ema;

  for (let index = period; index < candles.length; index += 1) {
    ema = (candles[index].close - ema) * multiplier + ema;
    values[index] = ema;
  }

  return values;
}

function calculateEmaForValues(values: { time: UTCTimestamp; value: number }[], period: number) {
  if (values.length < period) return [];

  const out: Array<number | undefined> = Array(values.length).fill(undefined);
  const multiplier = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((sum, point) => sum + point.value, 0) / period;

  out[period - 1] = ema;

  for (let index = period; index < values.length; index += 1) {
    ema = (values[index].value - ema) * multiplier + ema;
    out[index] = ema;
  }

  return out;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: fractionDigitsForPrice(value),
  }).format(value);
}

function formatRelativeTime(timestamp: string): string {
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: fractionDigitsForPrice(value),
  }).format(value);
}

function formatVolume(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function fractionDigitsForPrice(value: number) {
  const absolute = Math.abs(value);

  if (absolute >= 1000000) return 0;
  if (absolute >= 1000) return 1;
  if (absolute >= 1) return 2;
  if (absolute >= 0.01) return 4;
  if (absolute >= 0.0001) return 6;
  return 8;
}
