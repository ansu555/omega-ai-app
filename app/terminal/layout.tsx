import type { Metadata } from "next";

import "./terminal.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trading Terminal · Omega",
  description:
    "Trade coins and perps with onchain market data, liquidity depth, and agentic execution context.",
};

export default function TerminalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="terminal-page">{children}</div>;
}
