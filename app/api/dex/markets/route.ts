import { NextResponse } from "next/server";

import { getDexMarket, getDexMarkets } from "@/lib/dex/geckoterminal";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const market = await getDexMarket(id);
    return NextResponse.json({ market });
  }

  const markets = await getDexMarkets();
  return NextResponse.json({ markets });
}
