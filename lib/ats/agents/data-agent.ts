/**
 * ATS Data Agent — fetches price + news data for a given ticker.
 *
 * Runs in Phase 1 of the orchestrator pipeline (before all other agents).
 * Emits:
 *   agent.thinking  — when the fetch starts
 *   agent.data      — when both bundles are ready (with quality metrics)
 *
 * Returns a DataAgentResult containing the full DataBundle and NewsBundle
 * that downstream agents (Regime, Signal, Graph) consume.
 */

import type { RunEvent, DataBundle, NewsBundle } from '@/lib/ats/types'
import { fetchPriceBundle } from '@/lib/ats/data/prices'
import { fetchNewsBundle } from '@/lib/ats/data/news'

// ── Result type ───────────────────────────────────────────────────────────────

export interface DataAgentResult {
  data: DataBundle
  news: NewsBundle
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches the price bundle and news bundle for `ticker` in parallel.
 * Gracefully tolerates partial failures — a missing news feed does not abort
 * the run; it just reduces the news item count.
 */
export async function runDataAgent(
  ticker: string,
  emit: (event: RunEvent) => void,
  run_id: string,
): Promise<DataAgentResult> {
  emit({
    type: 'agent.thinking',
    run_id,
    ts: new Date().toISOString(),
    agent: 'data',
    message: `Fetching price data and news for ${ticker.toUpperCase()}…`,
  })

  const [data, news] = await Promise.all([
    fetchPriceBundle(ticker),
    fetchNewsBundle(ticker),
  ])

  const qualityLabel =
    data.quality_score >= 0.7 ? 'high' :
    data.quality_score >= 0.4 ? 'medium' : 'low'

  emit({
    type: 'agent.data',
    run_id,
    ts: new Date().toISOString(),
    agent: 'data',
    message:
      `Data ready — price $${data.current_price.toLocaleString()} · ` +
      `${data.price_change_24h.toFixed(2)}% 24h · ` +
      `quality ${qualityLabel} (${data.quality_score.toFixed(2)}) · ` +
      `${news.items.length} news items`,
    payload: {
      ticker: data.ticker,
      current_price: data.current_price,
      price_change_24h: data.price_change_24h,
      market_cap: data.market_cap,
      volume_24h: data.volume_24h,
      quality_score: data.quality_score,
      candles_daily_count: data.candles_daily.length,
      candles_hourly_count: data.candles_hourly.length,
      news_count: news.items.length,
    },
  })

  return { data, news }
}
