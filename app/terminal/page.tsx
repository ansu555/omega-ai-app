"use client";

import { Suspense, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { DEFAULT_DEX_MARKET_ID } from "@/lib/dex/markets";
import { Header } from "./_components/Header";
import { TokenList } from "./_components/TokenList";
import { Chart } from "./_components/Chart";
import { OrderBook } from "./_components/OrderBook";
import { TradePanel } from "./_components/TradePanel";
import { Footer } from "./_components/Footer";
import { AgentPipelineDock } from "./_components/AgentPipelineDock";

export default function TerminalPage() {
  const [marketId, setMarketId] = useState(DEFAULT_DEX_MARKET_ID);
  const [isLeftListCollapsed, setIsLeftListCollapsed] = useState(false);
  const [isDepthCollapsed, setIsDepthCollapsed] = useState(false);
  const [isTradeCollapsed, setIsTradeCollapsed] = useState(false);
  const [isAgentDockCollapsed, setIsAgentDockCollapsed] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <Header />
      <main className="flex-1 flex min-h-0">
        <CollapsiblePanel
          panelId="terminal-token-list"
          collapsed={isLeftListCollapsed}
          onToggle={() => setIsLeftListCollapsed((current) => !current)}
          expandedWidth={300}
          railPosition="trailing"
          collapseDirection="left"
          collapseLabel="Collapse market list panel"
          expandLabel="Expand market list panel"
        >
          <TokenList activeMarketId={marketId} onMarketSelect={setMarketId} />
        </CollapsiblePanel>
        <div className="flex min-w-[460px] flex-1 flex-col min-h-0 border-r border-border">
          <Chart marketId={marketId} />
          <AgentPipelineDock
            marketId={marketId}
            collapsed={isAgentDockCollapsed}
            onToggle={() => setIsAgentDockCollapsed((current) => !current)}
          />
        </div>
        <CollapsiblePanel
          panelId="terminal-order-book"
          collapsed={isDepthCollapsed}
          onToggle={() => setIsDepthCollapsed((current) => !current)}
          expandedWidth={340}
          railPosition="leading"
          collapseDirection="right"
          collapseLabel="Collapse liquidity depth panel"
          expandLabel="Expand liquidity depth panel"
        >
          <OrderBook marketId={marketId} />
        </CollapsiblePanel>
        <CollapsiblePanel
          panelId="terminal-trade-panel"
          collapsed={isTradeCollapsed}
          onToggle={() => setIsTradeCollapsed((current) => !current)}
          expandedWidth={340}
          railPosition="leading"
          collapseDirection="right"
          collapseLabel="Collapse swap panel"
          expandLabel="Expand swap panel"
        >
          <Suspense fallback={<div className="h-full border-l border-border bg-background" />}>
            <TradePanel marketId={marketId} />
          </Suspense>
        </CollapsiblePanel>
      </main>
      <Footer />
    </div>
  );
}

type CollapsiblePanelProps = {
  panelId: string;
  collapsed: boolean;
  onToggle: () => void;
  expandedWidth: number;
  railPosition: "leading" | "trailing";
  collapseDirection: "left" | "right";
  collapseLabel: string;
  expandLabel: string;
  children: ReactNode;
};

function CollapsiblePanel({
  panelId,
  collapsed,
  onToggle,
  expandedWidth,
  railPosition,
  collapseDirection,
  collapseLabel,
  expandLabel,
  children,
}: CollapsiblePanelProps) {
  const CollapseIcon = collapseDirection === "left" ? ChevronLeft : ChevronRight;
  const ExpandIcon = collapseDirection === "left" ? ChevronRight : ChevronLeft;

  return (
    <div className="relative flex min-h-0">
      {railPosition === "leading" && collapsed ? (
        <PanelRail
          panelId={panelId}
          label={expandLabel}
          expanded={false}
          side="leading"
          icon={<ExpandIcon className="h-3.5 w-3.5" />}
          onClick={onToggle}
        />
      ) : null}

      <div
        id={panelId}
        className="shrink-0 min-h-0 overflow-hidden transition-[width] duration-200 ease-out"
        style={{ width: collapsed ? 0 : expandedWidth }}
        aria-hidden={collapsed}
      >
        {children}
      </div>

      {railPosition === "trailing" && collapsed ? (
        <PanelRail
          panelId={panelId}
          label={expandLabel}
          expanded={false}
          side="trailing"
          icon={<ExpandIcon className="h-3.5 w-3.5" />}
          onClick={onToggle}
        />
      ) : null}

      {!collapsed ? (
        <button
          type="button"
          aria-label={collapseLabel}
          aria-controls={panelId}
          aria-expanded={true}
          onClick={onToggle}
          className={`absolute top-1/2 z-20 flex h-8 w-4 -translate-y-1/2 items-center justify-center border border-border bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
            railPosition === "leading" ? "-left-2 rounded-r-md border-l-0" : "-right-2 rounded-l-md border-r-0"
          }`}
        >
          <CollapseIcon className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function PanelRail({
  panelId,
  label,
  expanded,
  side,
  icon,
  onClick,
}: {
  panelId: string;
  label: string;
  expanded: boolean;
  side: "leading" | "trailing";
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      className={`shrink-0 w-5 border-border bg-background/85 backdrop-blur-sm ${
        side === "leading" ? "border-r" : "border-l"
      }`}
    >
      <button
        type="button"
        aria-label={label}
        aria-controls={panelId}
        aria-expanded={expanded}
        onClick={onClick}
        className="flex h-full w-full items-center justify-center text-muted-foreground transition-colors hover:bg-panel hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {icon}
      </button>
    </div>
  );
}
