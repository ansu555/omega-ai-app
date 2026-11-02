"use client";

import type { MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { DexDepth, DexDepthRow, DexMarket, DexTrade } from "@/lib/dex/types";

type Tab = "depth" | "swaps";

type DepthResponse = {
  depth: DexDepth;
};

type TradesResponse = {
  trades: DexTrade[];
};

type MarketResponse = {
  market: DexMarket;
};

const ROW_LIMIT = 10;

export function OrderBook({ marketId }: { marketId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("depth");
  const [asks, setAsks] = useState<DexDepthRow[]>([]);
  const [bids, setBids] = useState<DexDepthRow[]>([]);
  const [trades, setTrades] = useState<DexTrade[]>([]);
  const [spread, setSpread] = useState(0);
  const [market, setMarket] = useState<DexMarket | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "offline">("loading");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    if (!lastUpdated) return;
    setSecondsAgo(0);
    const tick = window.setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [lastUpdated]);

  useEffect(() => {
    let disposed = false;
    const aborter = new AbortController();

    async function loadDepth() {
      if (!disposed) setStatus("loading");

      try {
        const [depthResponse, tradesResponse, marketResponse] = await Promise.all([
          fetch(`/api/dex/depth?market=${encodeURIComponent(marketId)}`, {
            signal: aborter.signal,
          }),
          fetch(`/api/dex/trades?market=${encodeURIComponent(marketId)}`, {
            signal: aborter.signal,
          }),
          fetch(`/api/dex/markets?id=${encodeURIComponent(marketId)}`, {
            signal: aborter.signal,
          }),
        ]);

        if (!depthResponse.ok || !tradesResponse.ok || !marketResponse.ok) {
          throw new Error("Liquidity snapshot failed");
        }

        const depth = (await depthResponse.json()) as DepthResponse;
        const recentTrades = (await tradesResponse.json()) as TradesResponse;
        const marketSnapshot = (await marketResponse.json()) as MarketResponse;

        if (disposed) return;

        setAsks(depth.depth.asks.slice(0, ROW_LIMIT));
        setBids(depth.depth.bids.slice(0, ROW_LIMIT));
        setSpread(depth.depth.spread);
        setTrades(recentTrades.trades);
        setMarket(marketSnapshot.market);
        setStatus("live");
        setLastUpdated(new Date());
      } catch {
        if (!disposed && !aborter.signal.aborted) {
          setStatus("offline");
        }
      }
    }

    loadDepth();
    const timer = window.setInterval(loadDepth, 10000);

    return () => {
      disposed = true;
      aborter.abort();
      window.clearInterval(timer);
    };
  }, [marketId]);

  const maxTotal = useMemo(
    () => Math.max(1, ...asks.map((a) => a.total), ...bids.map((b) => b.total)),
    [asks, bids],
  );
  const sizeLabel = market?.symbol ?? "Token";
  const isPerp = market?.kind === "perp";

  return (
    <div className="h-full w-[340px] shrink-0 border-r border-border bg-background flex flex-col">
      <div className="grid grid-cols-2 border-b border-border text-sm">
        <button
          onClick={() => setActiveTab("depth")}
          className={`py-3 font-medium ${
            activeTab === "depth" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Liquidity Depth
        </button>
        <button
          onClick={() => setActiveTab("swaps")}
          className={`py-3 font-medium ${
            activeTab === "swaps" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Swaps
        </button>
      </div>

      {activeTab === "depth" ? (
        <div className="relative flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-3 px-3 py-2 text-[11px] text-muted-foreground border-b border-border">
            <span className="flex items-center gap-1.5">
              <StatusDot status={status} />
              AMM spread · <span className="tabular text-foreground">{spread ? formatPrice(spread) : "..."}</span>
            </span>
            <span className="tabular">
              {status === "live" && lastUpdated
                ? secondsAgo < 5
                  ? "just now"
                  : `${secondsAgo}s ago`
                : status === "loading"
                  ? "updating…"
                  : "offline"}
            </span>
          </div>

          <DepthChart
            asks={asks.length ? asks : placeholderRows("ask")}
            bids={bids.length ? bids : placeholderRows("bid")}
            maxTotal={maxTotal}
            sizeLabel={sizeLabel}
            muted={!asks.length && !bids.length}
          />

          <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            Synthetic AMM depth from pool liquidity, not centralized limit orders.
          </div>

          {isPerp && <ComingSoonOverlay />}
        </div>
      ) : (
        <div className="relative flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-3 px-3 py-2 text-[11px] text-muted-foreground">
            <span>Price</span>
            <span className="text-right">Size ({sizeLabel})</span>
            <span className="text-right">Time</span>
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-muted-foreground border-y border-border bg-panel/40">
            <span className="flex items-center gap-1.5">
              <StatusDot status={status} />
              {status === "live" ? "Onchain swaps" : status === "loading" ? "Loading…" : "Offline"}
            </span>
            <span className="tabular">
              {status === "live" && lastUpdated
                ? secondsAgo < 5
                  ? "just now"
                  : `${secondsAgo}s ago`
                : status === "loading"
                  ? "updating…"
                  : ""}
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            {(trades.length ? trades : placeholderTrades()).map((trade, index) => (
              <TradeRowView key={`${trade.id}-${index}`} trade={trade} muted={!trades.length} />
            ))}
          </div>
          {isPerp && <ComingSoonOverlay />}
        </div>
      )}
    </div>
  );
}

type DepthPoint = { row: DexDepthRow; x: number; y: number };

const CHART_W = 100;
const CHART_H = 56;
const CENTER_X = CHART_W / 2;

function toDepthPoints(rows: DexDepthRow[], maxTotal: number, side: "ask" | "bid"): DepthPoint[] {
  // bids are ordered closest-to-spread -> outward; asks are ordered farthest -> closest.
  // Reverse both so x increases away from the spread on each side.
  const ordered = [...rows].reverse();
  const n = ordered.length;

  return ordered.map((row, index) => {
    const t = n > 1 ? index / (n - 1) : 0;
    const x = side === "bid" ? t * CENTER_X : CENTER_X + t * (CHART_W - CENTER_X);
    const y = (row.total / maxTotal) * CHART_H;
    return { row, x, y };
  });
}

function buildStepArea(points: DepthPoint[]): string {
  if (!points.length) return "";

  let path = `M ${points[0].x} ${CHART_H}`;
  points.forEach((point, index) => {
    path += ` L ${point.x} ${CHART_H - point.y}`;
    const next = points[index + 1];
    if (next) path += ` L ${next.x} ${CHART_H - point.y}`;
  });
  const last = points[points.length - 1];
  path += ` L ${last.x} ${CHART_H} Z`;

  return path;
}

function DepthChart({
  asks,
  bids,
  maxTotal,
  sizeLabel,
  muted,
}: {
  asks: DexDepthRow[];
  bids: DexDepthRow[];
  maxTotal: number;
  sizeLabel: string;
  muted?: boolean;
}) {
  const [hover, setHover] = useState<{ point: DepthPoint; side: "ask" | "bid" } | null>(null);

  const bidPoints = useMemo(() => toDepthPoints(bids, maxTotal, "bid"), [bids, maxTotal]);
  const askPoints = useMemo(() => toDepthPoints(asks, maxTotal, "ask"), [asks, maxTotal]);
  const bidPath = useMemo(() => buildStepArea(bidPoints), [bidPoints]);
  const askPath = useMemo(() => buildStepArea(askPoints), [askPoints]);

  const leftPrice = bidPoints[0]?.row.price ?? 0;
  const rightPrice = askPoints[askPoints.length - 1]?.row.price ?? 0;
  const midPrice =
    (bidPoints[bidPoints.length - 1]?.row.price ?? 0) > 0 && (askPoints[0]?.row.price ?? 0) > 0
      ? ((bidPoints[bidPoints.length - 1]?.row.price ?? 0) + (askPoints[0]?.row.price ?? 0)) / 2
      : 0;

  function handleMove(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * CHART_W;
    const points = px < CENTER_X ? bidPoints : askPoints;
    if (!points.length) {
      setHover(null);
      return;
    }

    let nearest = points[0];
    for (const point of points) {
      if (Math.abs(point.x - px) < Math.abs(nearest.x - px)) nearest = point;
    }
    setHover({ point: nearest, side: px < CENTER_X ? "bid" : "ask" });
  }

  return (
    <div className={`relative flex-1 flex flex-col min-h-0 px-3 py-3 ${muted ? "opacity-40" : ""}`}>
      <div className="text-center mb-2">
        <div className="text-lg font-semibold tabular text-amber-400">{midPrice ? formatPrice(midPrice) : "..."}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Mid-Market Price</div>
      </div>

      <div className="relative flex-1 min-h-0 flex">
        <div className="relative flex-1 min-h-0">
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            preserveAspectRatio="none"
            className="h-full w-full"
            onMouseMove={handleMove}
            onMouseLeave={() => setHover(null)}
          >
            <line x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke="hsl(var(--border))" strokeWidth={0.3} />
            <path d={bidPath} fill="hsl(var(--bull) / 0.18)" stroke="hsl(var(--bull))" strokeWidth={0.4} />
            <path d={askPath} fill="hsl(var(--bear) / 0.18)" stroke="hsl(var(--bear))" strokeWidth={0.4} />
            {hover && (
              <line
                x1={hover.point.x}
                y1={0}
                x2={hover.point.x}
                y2={CHART_H}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={0.3}
                strokeDasharray="1 1"
              />
            )}
          </svg>

          {hover && (
            <div
              className={`pointer-events-none absolute top-1 -translate-x-1/2 rounded border border-border bg-card px-2 py-1 text-[11px] tabular shadow-sm ${
                hover.side === "ask" ? "text-bear" : "text-bull"
              }`}
              style={{
                left: `${hover.point.x}%`,
                transform: hover.point.x > CHART_W - 12 ? "translateX(-100%)" : hover.point.x < 12 ? "translateX(0)" : "translateX(-50%)",
              }}
            >
              <div>{hover.point.row.price ? formatPrice(hover.point.row.price) : "..."}</div>
              <div className="text-muted-foreground">
                {hover.point.row.total ? formatSize(hover.point.row.total) : "..."} {sizeLabel}
              </div>
            </div>
          )}
        </div>

        <div className="flex w-12 flex-col pl-1.5 text-right text-[10px] text-muted-foreground tabular">
          <span className="text-[9px] uppercase tracking-wide">{sizeLabel}</span>
          <div className="flex flex-1 flex-col justify-between">
            <span>{formatSize(maxTotal)}</span>
            <span>{formatSize(maxTotal / 2)}</span>
            <span>0</span>
          </div>
        </div>
      </div>

      <div className="mt-1.5 flex justify-between border-t border-border pt-1.5 text-[11px] text-muted-foreground tabular">
        <span className="text-bull">{leftPrice ? formatPrice(leftPrice) : "..."}</span>
        <span>{midPrice ? formatPrice(midPrice) : "..."}</span>
        <span className="text-bear">{rightPrice ? formatPrice(rightPrice) : "..."}</span>
      </div>
      <div className="mt-0.5 text-center text-[9px] uppercase tracking-widest text-muted-foreground">Price</div>
    </div>
  );
}

function TradeRowView({ trade, muted }: { trade: DexTrade; muted?: boolean }) {
  const color = trade.side === "buy" ? "text-bull" : "text-bear";

  return (
    <div className={`grid grid-cols-3 px-3 py-[3px] text-xs tabular hover:bg-panel/60 ${muted ? "opacity-40" : ""}`}>
      <span className={color}>{trade.priceUsd ? formatPrice(trade.priceUsd) : "..."}</span>
      <span className="text-right">{trade.size ? formatSize(trade.size) : "..."}</span>
      <span className="text-right text-muted-foreground">{trade.timestamp ? formatTime(trade.timestamp) : "..."}</span>
    </div>
  );
}

function StatusDot({ status }: { status: "loading" | "live" | "offline" }) {
  return (
    <span
      className={`h-1.5 w-1.5 rounded-full ${
        status === "live" ? "bg-bull animate-pulse" : status === "loading" ? "bg-primary" : "bg-bear"
      }`}
    />
  );
}

function placeholderRows(side: "ask" | "bid"): DexDepthRow[] {
  return Array.from({ length: ROW_LIMIT }, (_, index) => ({
    price: 0,
    size: 0,
    total: side === "ask" ? ROW_LIMIT - index : index + 1,
    notionalUsd: 0,
  }));
}

function placeholderTrades(): DexTrade[] {
  return Array.from({ length: 36 }, (_, index) => ({
    id: `placeholder-${index}`,
    txHash: "",
    priceUsd: 0,
    size: 0,
    volumeUsd: 0,
    timestamp: "",
    side: index % 2 === 0 ? "buy" : "sell",
  }));
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 1 ? 2 : 0,
    maximumFractionDigits: fractionDigitsForPrice(value),
  }).format(value);
}

function formatSize(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 2 : 5,
  }).format(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function fractionDigitsForPrice(value: number) {
  const absolute = Math.abs(value);

  if (absolute >= 1) return 2;
  if (absolute >= 0.01) return 4;
  if (absolute >= 0.0001) return 6;
  return 8;
}

function ComingSoonOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 backdrop-blur-sm bg-background/60">
      <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Coming Soon
      </span>
      <p className="max-w-[200px] text-center text-xs text-muted-foreground leading-relaxed">
        Perp market data is not publicly available yet
      </p>
    </div>
  );
}
