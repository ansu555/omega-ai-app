/**
 * Thin proxy to the realtime-service /price endpoint. Used for SSR / first
 * paint so the UI has prices before the client WebSocket connects; live updates
 * thereafter arrive over the socket (see hooks/use-realtime-feed.tsx).
 *
 * If the service is unreachable the caller should fall back to /api/crypto.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SERVICE_URL =
  process.env.REALTIME_HTTP_URL?.trim() ||
  process.env.NEXT_PUBLIC_REALTIME_HTTP_URL?.trim() ||
  "http://localhost:8080";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const target = symbol
    ? `${SERVICE_URL}/price?symbol=${encodeURIComponent(symbol)}`
    : `${SERVICE_URL}/price`;

  try {
    const res = await fetch(target, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `realtime-service ${res.status}` },
        { status: 502 },
      );
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "unreachable";
    return NextResponse.json(
      { error: `realtime-service unreachable: ${message}` },
      { status: 503 },
    );
  }
}
