import type { OHLCVCandle } from "@/types/agent-builder-canvas";
import type { ChartInterval } from "@/store/chart";

const INTERVAL_DAYS: Record<ChartInterval, number> = {
  "1m": 1,
  "5m": 1,
  "15m": 1,
  "1h": 7,
  "4h": 30,
  "1d": 90,
};

export async function fetchCoingeckoOhlc(
  coingeckoId: string,
  interval: ChartInterval,
  signal?: AbortSignal,
): Promise<OHLCVCandle[]> {
  const days = INTERVAL_DAYS[interval];
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coingeckoId}/ohlc?vs_currency=usd&days=${days}`,
    { signal },
  );
  if (!res.ok) throw new Error(`Coingecko ${res.status}`);
  const raw = (await res.json()) as [number, number, number, number, number][];
  return raw.map((row) => ({
    time: Math.floor(row[0] / 1000),
    open: row[1],
    high: row[2],
    low: row[3],
    close: row[4],
    volume: 0,
  }));
}
