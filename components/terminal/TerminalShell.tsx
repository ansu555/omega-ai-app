"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Layout } from "react-grid-layout";
import { Plus, RotateCcw, X } from "lucide-react";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { cn } from "@/lib/utils";
import {
  ALL_TILE_IDS,
  TILE_LABELS,
  TileId,
  TileLayoutItem,
  useTerminalStore,
} from "@/store/terminal";
import { useTerminalLayout } from "./hooks/useTerminalLayout";
import { registerBuiltinIndicators } from "@/lib/indicators/builtins";
import { ChartTile } from "./tiles/ChartTile";
import { WatchlistTile } from "./tiles/WatchlistTile";
import { TradesTile } from "./tiles/TradesTile";
import { DepthTile } from "./tiles/DepthTile";
import { InfoTile } from "./tiles/InfoTile";
import { OrderPanelTile } from "./tiles/OrderPanelTile";
import { AgentCopilotTile } from "./tiles/AgentCopilotTile";
import { loadUserIndicators } from "@/lib/indicators/userIndicators";

const ResponsiveGridLayout = dynamic(
  () => import("./ResponsiveGrid").then((m) => m.ResponsiveGridLayout),
  { ssr: false },
);

const ROW_HEIGHT = 36;
const COLS: Record<string, number> = { lg: 12, md: 12, sm: 8, xs: 4, xxs: 2 };
const BREAKPOINTS: Record<string, number> = { lg: 1280, md: 1024, sm: 768, xs: 480, xxs: 0 };

function TileBody({ id }: { id: TileId }) {
  switch (id) {
    case "chart":
      return <ChartTile />;
    case "watchlist":
      return <WatchlistTile />;
    case "trades":
      return <TradesTile />;
    case "depth":
      return <DepthTile />;
    case "info":
      return <InfoTile />;
    case "order":
      return <OrderPanelTile />;
    case "copilot":
      return <AgentCopilotTile />;
    default:
      return null;
  }
}

function Tile({ id, onClose }: { id: TileId; onClose: () => void }) {
  return (
    <div className="grid-tile flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-card/60 backdrop-blur-md shadow-sm">
      <div className="drag-handle flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5 cursor-move select-none">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
          {TILE_LABELS[id]}
        </span>
        <button
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Close ${TILE_LABELS[id]}`}
        >
          <X size={12} />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <TileBody id={id} />
      </div>
    </div>
  );
}

function AddTileMenu() {
  const [open, setOpen] = useState(false);
  const mountedTiles = useTerminalStore((s) => s.mountedTiles);
  const mountTile = useTerminalStore((s) => s.mountTile);

  const available = useMemo(
    () => ALL_TILE_IDS.filter((id) => !mountedTiles.has(id)),
    [mountedTiles],
  );

  if (available.length === 0) {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 rounded-md border border-border/50 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground"
      >
        <Plus size={12} /> All tiles mounted
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-border/50 bg-card/60 px-3 py-1.5 text-xs hover:bg-card"
      >
        <Plus size={12} /> Add tile
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-md border border-border bg-popover p-1 shadow-lg">
          {available.map((id) => (
            <button
              key={id}
              onClick={() => {
                mountTile(id);
                setOpen(false);
              }}
              className="flex w-full items-center rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
            >
              {TILE_LABELS[id]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TerminalShell() {
  useTerminalLayout();

  // Register the indicator catalog on mount (idempotent).
  useEffect(() => {
    registerBuiltinIndicators();
    loadUserIndicators();
  }, []);

  const layout = useTerminalStore((s) => s.layout);
  const setLayout = useTerminalStore((s) => s.setLayout);
  const resetLayout = useTerminalStore((s) => s.resetLayout);
  const unmountTile = useTerminalStore((s) => s.unmountTile);
  const activeSymbol = useTerminalStore((s) => s.activeSymbol);

  const onLayoutChange = (next: Layout) => {
    const minSizes = new Map(layout.map((l) => [l.i, { minW: l.minW, minH: l.minH }]));
    const merged: TileLayoutItem[] = Array.from(next, (l) => ({
      i: l.i as TileId,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h,
      ...(minSizes.get(l.i as TileId) ?? {}),
    }));
    const same =
      merged.length === layout.length &&
      merged.every((m, idx) => {
        const a = layout[idx];
        return a && a.i === m.i && a.x === m.x && a.y === m.y && a.w === m.w && a.h === m.h;
      });
    if (same) return;
    setLayout(merged);
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b border-border/40 px-6 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold">Terminal</h1>
          <span className="text-xs text-muted-foreground">
            {activeSymbol.symbol} · {activeSymbol.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AddTileMenu />
          <button
            onClick={() => resetLayout()}
            className="flex items-center gap-1.5 rounded-md border border-border/50 bg-card/60 px-3 py-1.5 text-xs hover:bg-card"
          >
            <RotateCcw size={12} /> Reset layout
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-3 py-3">
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: layout, md: layout, sm: layout, xs: layout, xxs: layout }}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          margin={[10, 10]}
          containerPadding={[0, 0]}
          draggableHandle=".drag-handle"
          onLayoutChange={onLayoutChange}
        >
          {layout.map((item) => (
            <div key={item.i} data-grid={item} className={cn("group")}>
              <Tile id={item.i} onClose={() => unmountTile(item.i)} />
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}
