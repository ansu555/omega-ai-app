"use client";

import { useChartStore } from "@/store/chart";
import { useTerminalStore } from "@/store/terminal";
import { cn } from "@/lib/utils";

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatAge(ms: number) {
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

export function TradesTile() {
  const trades = useChartStore((s) => s.trades);
  const activeSymbol = useTerminalStore((s) => s.activeSymbol);

  return (
    <div className="flex h-full w-full flex-col text-xs">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Trades · {activeSymbol.symbol}
        </span>
        <span className="text-[10px] text-muted-foreground">{trades.length}</span>
      </div>
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 border-b border-border/20 px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Vol $</span>
        <span>Price</span>
        <span>Trader</span>
        <span>Age</span>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-[10px]">
        {trades.length === 0 && (
          <div className="px-3 py-4 text-center text-muted-foreground">
            Waiting for swaps…
          </div>
        )}
        {trades.map((t) => (
          <div
            key={t.id}
            className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 border-b border-border/10 px-3 py-1"
          >
            <span className={cn(t.side === "buy" ? "text-green-400" : "text-red-400")}>
              ${t.amountUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span>{t.priceUsd.toFixed(4)}</span>
            <span className="text-muted-foreground">{formatAddress(t.trader)}</span>
            <span className="text-muted-foreground">{formatAge(t.timestamp)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
