/**
 * Deep Research — News & Narrative tool (P1).
 *
 * Wraps the ATS news layer (`fetchNewsBundle`, RSS over CoinDesk / CoinTelegraph
 * / The Block) as a callable tool. Returns recent headlines, optionally filtered
 * to a ticker, each as its own `news`-tier Evidence record so the citation pass
 * can attribute claims to a source URL later.
 *
 * This is the in-house news primitive; broader web/social search (X, Reddit,
 * forums) arrives in P3 as a separate `web_search` tool.
 *
 * Server-only.
 */

import { fetchNewsBundle } from '@/lib/ats/data/news'
import type { ResearchTool } from '@/lib/research/tools/types'
import { asUpperTicker, evidence, fail, ok } from '@/lib/research/tools/helpers'

const MAX_ITEMS = 8

export const cryptoNewsTool: ResearchTool = {
  name: 'crypto_news',
  description:
    'Fetch recent crypto news headlines from major outlets (CoinDesk, ' +
    'CoinTelegraph, The Block), optionally filtered to a specific asset. Use to ' +
    'surface narrative, catalysts and breaking events. Headlines are leads to ' +
    'verify against on-chain/price data, not facts on their own.',
  trustTier: 'news',
  parameters: {
    type: 'object',
    properties: {
      ticker: {
        type: 'string',
        description: 'Optional asset symbol to filter headlines to, e.g. BTC. Omit for the general feed.',
      },
      limit: {
        type: 'number',
        description: `Max headlines to return (1–${MAX_ITEMS}, default ${MAX_ITEMS}).`,
      },
    },
    additionalProperties: false,
  },
  async execute(args, _ctx) {
    const ticker = args.ticker ? asUpperTicker(args.ticker) : ''
    const rawLimit = typeof args.limit === 'number' ? args.limit : MAX_ITEMS
    const limit = Math.max(1, Math.min(MAX_ITEMS, Math.floor(rawLimit)))

    try {
      const bundle = await fetchNewsBundle(ticker || undefined)
      const items = bundle.items.slice(0, limit)

      if (items.length === 0) {
        return ok(
          ticker
            ? `No recent headlines mentioning ${ticker}.`
            : 'No recent crypto headlines available.',
          [],
        )
      }

      const evidenceList = items.map((item) =>
        evidence(
          item.title,
          item.source,
          'news',
          {
            title: item.title,
            description: item.description,
            tickers: item.tickers,
            published_at: item.published_at,
          },
          item.url,
          item.published_at,
        ),
      )

      const scope = ticker ? `for ${ticker}` : 'across the market'
      const summary =
        `${items.length} recent headline(s) ${scope}:\n` +
        items.map((i, n) => `${n + 1}. ${i.title} (${i.source})`).join('\n')

      return ok(summary, evidenceList)
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'News fetch failed.')
    }
  },
}
