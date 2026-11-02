"use client";

import { useState } from "react";
import { PoolComparisonPanel } from "@/components/trade/PoolComparisonPanel";
import { SwapCardDex } from "@/components/trade/SwapCardDex";

export default function TradePage() {
  const [tokenIn, setTokenIn] = useState("WHSK");
  const [tokenOut, setTokenOut] = useState("USDT");

  return (
    <div className="min-h-screen bg-transparent relative z-10">
      <main className="container mx-auto px-4 py-8 pt-28">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_minmax(320px,420px)] lg:items-start lg:justify-center">
          <section className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold">Trade</h1>
              <p className="text-sm text-muted-foreground">Best-route swaps via HSKSwap on HashKey Chain</p>
            </div>
            <SwapCardDex onTokensChange={(i, o) => { setTokenIn(i); setTokenOut(o); }} />
          </section>
          <PoolComparisonPanel token0Symbol={tokenIn} token1Symbol={tokenOut} />
        </div>
      </main>
    </div>
  );
}
