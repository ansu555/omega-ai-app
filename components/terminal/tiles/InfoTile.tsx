"use client";

import { ExternalLink } from "lucide-react";
import { useChartStore } from "@/store/chart";
import { useTerminalStore } from "@/store/terminal";
import { getChainConfig, getDefaultChainId, getExplorerLink } from "@/lib/chain-registry";

const EXPLORER_NAME =
  getChainConfig(getDefaultChainId()).chain.blockExplorers?.default.name ?? "Explorer";

function fmt(n: number, dp = 4) {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toFixed(dp);
}

export function InfoTile() {
  const activeSymbol = useTerminalStore((s) => s.activeSymbol);
  const candles = useChartStore((s) => s.candles);

  const last = candles.length > 0 ? candles[candles.length - 1] : null;
  const first24h = candles.length > 24 ? candles[candles.length - 24] : candles[0];
  const change24h = last && first24h && first24h.close ? ((last.close - first24h.close) / first24h.close) * 100 : null;
  const high24h = last
    ? Math.max(...candles.slice(-24).map((c) => c.high))
    : null;
  const low24h = last ? Math.min(...candles.slice(-24).map((c) => c.low)) : null;
  const vol24h = last
    ? candles.slice(-24).reduce((s, c) => s + c.volume, 0)
    : null;

  return (
    <div className="flex h-full w-full flex-col text-xs">
      <div className="border-b border-border/40 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        Token Info
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="mb-2">
          <div className="text-base font-semibold">{activeSymbol.symbol}</div>
          <div className="text-[10px] text-muted-foreground">{activeSymbol.name}</div>
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px]">
          <div className="text-muted-foreground">Price</div>
          <div className="font-mono">{last ? `$${fmt(last.close)}` : "—"}</div>

          <div className="text-muted-foreground">24h Change</div>
          <div className={change24h == null ? "" : change24h >= 0 ? "text-green-400" : "text-red-400"}>
            {change24h == null ? "—" : `${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%`}
          </div>

          <div className="text-muted-foreground">24h High</div>
          <div className="font-mono">{high24h ? `$${fmt(high24h)}` : "—"}</div>

          <div className="text-muted-foreground">24h Low</div>
          <div className="font-mono">{low24h ? `$${fmt(low24h)}` : "—"}</div>

          <div className="text-muted-foreground">24h Volume</div>
          <div className="font-mono">{vol24h ? fmt(vol24h, 0) : "—"}</div>

          <div className="text-muted-foreground">Chain</div>
          <div className="capitalize">{activeSymbol.chain}</div>
        </div>

        <a
          href={getExplorerLink(getDefaultChainId(), "address", activeSymbol.address)}
          target="_blank"
          rel="noopener noreferrer"
          onMouseDown={(e) => e.stopPropagation()}
          className="mt-3 flex items-center gap-1 text-[10px] text-primary hover:underline"
        >
          <ExternalLink size={10} /> View on {EXPLORER_NAME}
        </a>
      </div>
    </div>
  );
}
