"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChartStore } from "@/store/chart";
import { useTerminalStore } from "@/store/terminal";

type Side = "buy" | "sell";

export function OrderPanelTile() {
  const activeSymbol = useTerminalStore((s) => s.activeSymbol);
  const candles = useChartStore((s) => s.candles);
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");

  const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
  const numAmount = parseFloat(amount);
  const estimatedOut = Number.isFinite(numAmount) && lastPrice > 0
    ? side === "buy" ? numAmount / lastPrice : numAmount * lastPrice
    : 0;

  return (
    <div className="flex h-full w-full flex-col text-xs">
      <div className="border-b border-border/40 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        Order Panel
      </div>
      <div className="flex flex-1 flex-col gap-2 px-3 py-2">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted/40 p-0.5">
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              onMouseDown={(e) => e.stopPropagation()}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-medium uppercase transition-colors",
                side === s
                  ? s === "buy"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground">
            {side === "buy" ? "Pay (USD)" : `Sell (${activeSymbol.symbol})`}
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="0.00"
            className="w-full rounded-md border border-border/50 bg-background px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center justify-center text-muted-foreground">
          <ArrowUpDown size={12} />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground">
            {side === "buy" ? `Receive (${activeSymbol.symbol})` : "Receive (USD)"}
          </span>
          <div className="rounded-md border border-border/50 bg-muted/30 px-2 py-1.5 text-sm font-mono text-muted-foreground">
            {estimatedOut > 0 ? estimatedOut.toFixed(6) : "—"}
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Mid price</span>
          <span className="font-mono">{lastPrice ? `$${lastPrice.toFixed(4)}` : "—"}</span>
        </div>

        <Link
          href="/trade"
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            "mt-auto flex items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-semibold uppercase transition-colors",
            side === "buy"
              ? "bg-green-500/80 text-white hover:bg-green-500"
              : "bg-red-500/80 text-white hover:bg-red-500",
          )}
        >
          {side === "buy" ? "Buy" : "Sell"} {activeSymbol.symbol}
        </Link>
      </div>
    </div>
  );
}
