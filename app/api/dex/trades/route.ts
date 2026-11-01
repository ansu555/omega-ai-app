import { NextResponse } from "next/server";

import { DEFAULT_DEX_MARKET_ID } from "@/lib/dex/markets";
import { getDexTrades } from "@/lib/dex/geckoterminal";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const marketId = searchParams.get("market") ?? DEFAULT_DEX_MARKET_ID;
  const trades = await getDexTrades(marketId);

  return NextResponse.json({ trades });
}
