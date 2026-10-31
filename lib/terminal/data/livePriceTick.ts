export function pollLivePrice(opts: {
  marketId: string;
  intervalMs?: number;
  onTick: (priceUsd: number) => void;
  onError?: (e: unknown) => void;
}): () => void {
  const { marketId, intervalMs = 6000, onTick, onError } = opts;
  let cancelled = false;

  const tick = async () => {
    if (cancelled) return;
    try {
      const res = await fetch(`/api/dex/markets?id=${encodeURIComponent(marketId)}`);
      if (!res.ok) throw new Error(`Markets fetch failed: ${res.status}`);
      const json = (await res.json()) as { market: { priceUsd: number } };
      if (!cancelled && json.market?.priceUsd > 0) onTick(json.market.priceUsd);
    } catch (e) {
      if (!cancelled) onError?.(e);
    }
    if (!cancelled) setTimeout(tick, intervalMs);
  };

  tick();
  return () => { cancelled = true; };
}
