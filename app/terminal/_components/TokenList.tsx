"use client";

import { useEffect, useMemo, useState } from "react";
import type { DexMarket } from "@/lib/dex/types";
import { isHashKeyNetwork } from "@/lib/dex/markets";
import { TokenIcon } from "./Icon";

type MarketsResponse = {
  markets: DexMarket[];
};

type MarketTab = "Coins";

export function TokenList({
  activeMarketId,
  onMarketSelect,
}: {
  activeMarketId: string;
  onMarketSelect: (marketId: string) => void;
}) {
  const [markets, setMarkets] = useState<DexMarket[]>([]);
  const [activeTab, setActiveTab] = useState<MarketTab>("Coins");
  const [status, setStatus] = useState<"loading" | "live" | "offline">("loading");

  useEffect(() => {
    let disposed = false;
    const aborter = new AbortController();

    async function loadMarkets() {
      setStatus("loading");

      try {
        const response = await fetch("/api/dex/markets", { signal: aborter.signal });

        if (!response.ok) throw new Error("Market snapshot failed");

        const snapshot = (await response.json()) as MarketsResponse;
        if (disposed) return;

        setMarkets(snapshot.markets);
        setStatus("live");
      } catch {
        if (!disposed && !aborter.signal.aborted) setStatus("offline");
      }
    }

    loadMarkets();
    const timer = window.setInterval(loadMarkets, 30000);

    return () => {
      disposed = true;
      aborter.abort();
      window.clearInterval(timer);
    };
  }, []);

  const totalVolume = useMemo(
    () => markets.filter((m) => isHashKeyNetwork(m.network) && m.kind === "spot").reduce((sum, m) => sum + m.volume24hUsd, 0),
    [markets],
  );
  const visibleMarkets = useMemo(() => {
    return markets.filter((market) => isHashKeyNetwork(market.network) && market.kind === "spot");
  }, [markets]);
  const sectionLabel = "HashKey Chain spot markets";
  const footerLabel = "24h spot volume";

  return (
    <aside className="w-[300px] shrink-0 border-r border-border bg-background flex flex-col">
      <div className="grid grid-cols-3 text-sm border-b border-border">
        <button
          onClick={() => setActiveTab("Coins")}
          className={`py-3 font-medium ${activeTab === "Coins" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          Coins
        </button>
        <button disabled className="py-3 font-medium text-muted-foreground/40 cursor-not-allowed">
          Perps
        </button>
        <button disabled className="py-3 font-medium text-muted-foreground/40 cursor-not-allowed">
          Follows
        </button>
      </div>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border text-[11px] text-muted-foreground">
        <span>{sectionLabel}</span>
        <span className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === "live" ? "bg-bull animate-pulse" : status === "loading" ? "bg-primary" : "bg-bear"
            }`}
          />
          {status === "live" ? "Live" : status === "loading" ? "Loading" : "Offline"}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {visibleMarkets.map((market) => {
          const isActive = market.id === activeMarketId;
          const change = market.change24h;
          const positive = change >= 0;

          return (
            <button
              key={market.id}
              onClick={() => onMarketSelect(market.id)}
              className={`w-full grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-panel-hover transition-colors ${
                isActive ? "bg-panel" : ""
              }`}
            >
              <TokenIcon symbol={market.symbol} color={market.color} size={28} />
              <div className="min-w-0 text-left">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-medium truncate">{market.pairLabel}</span>
                  {market.kind === "perp" && market.leverage && (
                    <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">
                      {market.leverage}x
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{market.dex}</div>
              </div>
              <span className="tabular text-foreground">{formatPrice(market.priceUsd)}</span>
              <span className={`tabular text-xs w-16 text-right ${positive ? "text-bull" : "text-bear"}`}>
                {positive ? "+" : ""}
                {change.toFixed(2)}%
              </span>
            </button>
          );
        })}
        {!visibleMarkets.length ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            {status === "loading" ? "Loading markets..." : "No markets in this section yet."}
          </div>
        ) : null}
      </div>
      <div className="px-3 py-2 border-t border-border text-xs tabular text-muted-foreground">
        {footerLabel} {totalVolume ? formatCompactUsd(totalVolume) : "..."}
      </div>
    </aside>
  );
}

function formatPrice(value: number) {
  if (value >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: fractionDigitsForPrice(value),
  }).format(value);
}

function formatCompactUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function fractionDigitsForPrice(value: number) {
  const absolute = Math.abs(value);

  if (absolute >= 1) return 2;
  if (absolute >= 0.01) return 4;
  if (absolute >= 0.0001) return 6;
  return 8;
}
