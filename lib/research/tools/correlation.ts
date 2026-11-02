/**
 * Deep Research — Correlation tool (P3).
 *
 * The Risk & Portfolio specialist's diversification/contagion primitive
 * (blueprint §1 agent #6). Reuses the ATS Graph Agent's correlation model
 * (`lookupCorrelation` static matrix + `dynamicCorrelation` candle adjustment)
 * rather than rebuilding it, then approximates pairwise correlations via the
 * single-factor (BTC-driven) model ρ(A,B) ≈ ρ(A,BTC)·ρ(B,BTC) so the agent can
 * reason about whether a basket is actually diversified or just one bet in
 * disguise.
 *
 * Evidence is tagged `derived` (computed from reference data + recent candles).
 * Degrades gracefully: tokens with no candle history fall back to the static
 * BTC correlation and are flagged.
 *
 * Server-only.
 */

import { fetchPriceBundle } from '@/lib/ats/data/prices'
import { dynamicCorrelation, lookupCorrelation } from '@/lib/ats/agents/graph-agent'
import type { Evidence } from '@/lib/research/types'
import type { ResearchTool, ToolResult } from '@/lib/research/tools/types'
import { asUpperTicker, evidence, fail, ok, round } from '@/lib/research/tools/helpers'

const MAX_TOKENS = 6

function asTickerList(value: unknown): string[] {
  const raw: unknown[] = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s]+/)
      : []
  const out: string[] = []
  for (const v of raw) {
    const t = asUpperTicker(v)
    if (t && !out.includes(t)) out.push(t)
    if (out.length >= MAX_TOKENS) break
  }
  return out
}

interface TokenCorr {
  ticker: string
  btcCorrelation: number
  hadCandles: boolean
}

/** Resolve each token's BTC correlation (static + dynamic when candles exist). */
async function resolveCorrelations(tickers: string[]): Promise<TokenCorr[]> {
  return Promise.all(
    tickers.map(async (ticker): Promise<TokenCorr> => {
      const staticCorr = lookupCorrelation(ticker)
      try {
        const bundle = await fetchPriceBundle(ticker)
        if (bundle.candles_daily.length >= 5) {
          return { ticker, btcCorrelation: round(dynamicCorrelation(bundle, staticCorr), 2), hadCandles: true }
        }
      } catch {
        // fall through to the static value
      }
      return { ticker, btcCorrelation: round(staticCorr, 2), hadCandles: false }
    }),
  )
}

function diversificationLabel(avgPairwise: number): string {
  if (avgPairwise >= 0.7) return 'poorly diversified — assets move together'
  if (avgPairwise >= 0.5) return 'moderately correlated'
  return 'reasonably diversified'
}

export const correlationTool: ResearchTool = {
  name: 'correlation',
  description:
    'Estimate cross-asset correlation for a set of tokens: each token\'s correlation ' +
    'to BTC (the dominant market factor) plus approximate pairwise correlations. Use ' +
    'to judge whether a basket is genuinely diversified or a concentrated single bet, ' +
    'and to reason about contagion risk. Accepts 1–6 tickers.',
  trustTier: 'derived',
  parameters: {
    type: 'object',
    properties: {
      tokens: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tickers to analyse, e.g. ["BTC","ETH","WHSK"] (1–6).',
      },
    },
    required: ['tokens'],
    additionalProperties: false,
  },
  async execute(args): Promise<ToolResult> {
    const tickers = asTickerList(args.tokens)
    if (tickers.length === 0) {
      return fail('Provide 1–6 tickers in "tokens" to analyse correlation.')
    }

    const corrs = await resolveCorrelations(tickers)
    const ev: Evidence[] = corrs.map((c) =>
      evidence(
        `${c.ticker} correlation with BTC ≈ ${c.btcCorrelation}${c.hadCandles ? '' : ' (static estimate — no recent candles)'}.`,
        c.hadCandles ? 'ATS correlation engine' : 'ATS correlation matrix',
        'derived',
        { ticker: c.ticker, btc_correlation: c.btcCorrelation, dynamic: c.hadCandles },
        '',
      ),
    )

    // Pairwise via single-factor (BTC-driven) approximation: ρ(A,B) ≈ ρ(A,BTC)·ρ(B,BTC).
    const pairs: Array<{ a: string; b: string; rho: number }> = []
    for (let i = 0; i < corrs.length; i++) {
      for (let j = i + 1; j < corrs.length; j++) {
        const rho = round(corrs[i].btcCorrelation * corrs[j].btcCorrelation, 2)
        pairs.push({ a: corrs[i].ticker, b: corrs[j].ticker, rho })
      }
    }

    let summary: string
    if (pairs.length === 0) {
      summary = `${corrs[0].ticker} correlation with BTC ≈ ${corrs[0].btcCorrelation}. Add more tokens to assess diversification.`
    } else {
      const avg = round(pairs.reduce((s, p) => s + p.rho, 0) / pairs.length, 2)
      ev.push(
        evidence(
          `Basket [${tickers.join(', ')}] average pairwise correlation ≈ ${avg} — ${diversificationLabel(avg)}.`,
          'ATS correlation engine',
          'derived',
          {
            tickers,
            avg_pairwise: avg,
            pairs: pairs.map((p) => ({ pair: `${p.a}/${p.b}`, rho: p.rho })),
          },
          '',
        ),
      )
      summary =
        `Correlation for [${tickers.join(', ')}]:\n` +
        corrs.map((c) => `- ${c.ticker} vs BTC ≈ ${c.btcCorrelation}`).join('\n') +
        `\nAvg pairwise ≈ ${avg} → ${diversificationLabel(avg)}.`
    }

    return ok(summary, ev)
  },
}
