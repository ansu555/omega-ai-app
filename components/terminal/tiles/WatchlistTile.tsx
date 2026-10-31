"use client";

import { useTerminalStore } from "@/store/terminal";
import { cn } from "@/lib/utils";

export function WatchlistTile() {
  const watchlist = useTerminalStore((s) => s.watchlist);
  const activeSymbol = useTerminalStore((s) => s.activeSymbol);
  const setActiveSymbol = useTerminalStore((s) => s.setActiveSymbol);

  return (
    <div className="flex h-full w-full flex-col text-xs">
      <div className="border-b border-border/40 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        Watchlist
      </div>
      <div className="flex-1 overflow-y-auto">
        {watchlist.map((entry) => {
          const active = entry.address.toLowerCase() === activeSymbol.address.toLowerCase();
          return (
            <button
              key={entry.address}
              onClick={() => setActiveSymbol(entry)}
              onMouseDown={(e) => e.stopPropagation()}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 border-b border-border/20 px-3 py-2 text-left hover:bg-muted/40",
                active && "bg-primary/10",
              )}
            >
              <span className={cn("text-xs font-medium", active && "text-primary")}>
                {entry.symbol}
              </span>
              <span className="truncate text-[10px] text-muted-foreground">
                {entry.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
