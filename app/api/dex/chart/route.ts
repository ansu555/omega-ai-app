import { NextResponse } from "next/server";

import { DEFAULT_DEX_MARKET_ID } from "@/lib/dex/markets";
import { getDexCandles } from "@/lib/dex/geckoterminal";

const allowedIntervals = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
type AllowedInterval = (typeof allowedIntervals)[number];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const marketId = searchParams.get("market") ?? DEFAULT_DEX_MARKET_ID;
  const intervalParam = searchParams.get("interval");
  const interval = allowedIntervals.includes(intervalParam as AllowedInterval)
    ? (intervalParam as AllowedInterval)
    : "5m";
  const { candles, isFallback } = await getDexCandles(marketId, interval);

  return NextResponse.json({ candles, isFallback });
}
