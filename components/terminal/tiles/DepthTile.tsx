"use client";

import { useMemo } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartStore } from "@/store/chart";
import { useTerminalStore } from "@/store/terminal";

const SAMPLE_AMOUNTS_USD = [1_000, 10_000, 100_000];

type DepthRow = { price: number; size: number; side: "bid" | "ask" };

function buildDepthCurve(midPrice: number, reserveIn: number, reserveOut: number, feeBps: number): DepthRow[] {
  if (!midPrice || !reserveIn || !reserveOut) return [];
  const fee = 1 - feeBps / 10_000;
  const points: DepthRow[] = [];
  for (let i = 1; i <= 25; i++) {
    const inAmount = (reserveIn * i) / 200; // up to 12.5% of reserves
    const outAmount = (reserveOut * inAmount * fee) / (reserveIn + inAmount * fee);
    const execPrice = inAmount / outAmount;
    points.push({ price: execPrice, size: inAmount, side: "ask" });
  }
  for (let i = 1; i <= 25; i++) {
    const outAmount = (reserveOut * i) / 200;
    const inAmount = (reserveIn * outAmount) / ((reserveOut - outAmount) * fee);
    const execPrice = inAmount / outAmount;
    points.push({ price: execPrice, size: -outAmount, side: "bid" });
  }
  return points.sort((a, b) => a.price - b.price);
}

function impactAtSize(midPrice: number, reserveIn: number, reserveOut: number, feeBps: number, sizeUsd: number) {
  if (!midPrice || !reserveIn || !reserveOut) return null;
  const fee = 1 - feeBps / 10_000;
  const inAmount = sizeUsd / midPrice;
  const outAmount = (reserveOut * inAmount * fee) / (reserveIn + inAmount * fee);
  const execPrice = inAmount / outAmount;
  return ((execPrice - midPrice) / midPrice) * 100;
}

export function DepthTile() {
  const reserves = useChartStore((s) => s.reserves);
  const candles = useChartStore((s) => s.candles);
  const activeSymbol = useTerminalStore((s) => s.activeSymbol);

  const lastClose = candles.length > 0 ? candles[candles.length - 1].close : 0;

  // Synthesize a fallback curve from price alone if reserves missing.
  const { rows, midPrice, reserveIn, reserveOut, feeBps } = useMemo(() => {
    if (reserves) {
      const r0 = Number(reserves.reserve0) / 10 ** reserves.decimals0;
      const r1 = Number(reserves.reserve1) / 10 ** reserves.decimals1;
      return {
        rows: buildDepthCurve(reserves.midPrice, r0, r1, reserves.feeBps),
        midPrice: reserves.midPrice,
        reserveIn: r0,
        reserveOut: r1,
        feeBps: reserves.feeBps,
      };
    }
    if (lastClose > 0) {
      // Synthetic: assume notional liquidity of 1M USD on each side at this price
      const reserveIn = 500_000 / lastClose;
      const reserveOut = 500_000;
      return {
        rows: buildDepthCurve(lastClose, reserveIn, reserveOut, 30),
        midPrice: lastClose,
        reserveIn,
        reserveOut,
        feeBps: 30,
      };
    }
    return { rows: [] as DepthRow[], midPrice: 0, reserveIn: 0, reserveOut: 0, feeBps: 30 };
  }, [reserves, lastClose]);

  return (
    <div className="flex h-full w-full flex-col text-xs">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Pool Depth · {activeSymbol.symbol}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {reserves ? "live" : "synthetic"}
        </span>
      </div>
      <div className="flex-1 px-2 py-1">
        {rows.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 4, left: 0, right: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="depth-bid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="depth-ask" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="price" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "#0d0d1a", border: "1px solid #1f2937", fontSize: 10 }}
                formatter={(v: number) => Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              />
              <ReferenceLine x={midPrice} stroke="#a78bfa" strokeDasharray="2 2" />
              <Area
                type="stepAfter"
                dataKey={(d: DepthRow) => (d.side === "bid" ? Math.abs(d.size) : 0)}
                stroke="#22c55e"
                fill="url(#depth-bid)"
              />
              <Area
                type="stepAfter"
                dataKey={(d: DepthRow) => (d.side === "ask" ? Math.abs(d.size) : 0)}
                stroke="#ef4444"
                fill="url(#depth-ask)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Waiting for reserves…
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1 border-t border-border/40 px-3 py-2 text-[10px]">
        {SAMPLE_AMOUNTS_USD.map((sz) => {
          const imp = impactAtSize(midPrice, reserveIn, reserveOut, feeBps, sz);
          return (
            <div key={sz} className="flex flex-col">
              <span className="text-muted-foreground">${sz.toLocaleString()}</span>
              <span className="font-mono text-foreground">
                {imp == null ? "—" : `${imp.toFixed(2)}%`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
