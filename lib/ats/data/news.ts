/**
 * ATS Data Layer — News fetcher + entity tagger
 *
 * Exports:
 *   fetchNewsBundle(tickerFilter?) → NewsBundle
 *     Fetches recent crypto news from free RSS feeds (CoinDesk, CoinTelegraph,
 *     The Block), tags each item with recognised ticker symbols, then returns
 *     the 50 most recent items sorted newest-first.
 *
 *     Pass a ticker string (e.g. "BTC") to filter to items mentioning that
 *     asset. Leave it undefined for the full unfiltered feed.
 */

import type { NewsBundle, NewsItem } from '@/lib/ats/types'

// ── RSS feed registry ─────────────────────────────────────────────────────────

const RSS_FEEDS: { source: string; url: string }[] = [
  {
    source: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
  },
  {
    source: 'CoinTelegraph',
    url: 'https://cointelegraph.com/rss',
  },
  {
    source: 'The Block',
    url: 'https://www.theblock.co/rss.xml',
  },
]

// ── Ticker entity recognition ─────────────────────────────────────────────────

/** Known word-boundary terms → canonical ticker. Ordered longest-first to avoid
 *  partial matches (e.g. "SHIBA" before "SHI"). */
const TICKER_PATTERNS: Array<{ word: string; canonical: string }> = [
  { word: 'BITCOIN', canonical: 'BTC' },
  { word: 'ETHEREUM', canonical: 'ETH' },
  { word: 'SOLANA', canonical: 'SOL' },
  { word: 'AVALANCHE', canonical: 'AVAX' },
  { word: 'BINANCE', canonical: 'BNB' },
  { word: 'POLYGON', canonical: 'MATIC' },
  { word: 'CHAINLINK', canonical: 'LINK' },
  { word: 'UNISWAP', canonical: 'UNI' },
  { word: 'DOGECOIN', canonical: 'DOGE' },
  { word: 'CARDANO', canonical: 'ADA' },
  { word: 'POLKADOT', canonical: 'DOT' },
  { word: 'COSMOS', canonical: 'ATOM' },
  { word: 'ARBITRUM', canonical: 'ARB' },
  { word: 'OPTIMISM', canonical: 'OP' },
  { word: 'LITECOIN', canonical: 'LTC' },
  { word: 'RIPPLE', canonical: 'XRP' },
  { word: 'SHIBA', canonical: 'SHIB' },
  // Symbol-only matches
  { word: 'BTC', canonical: 'BTC' },
  { word: 'ETH', canonical: 'ETH' },
  { word: 'SOL', canonical: 'SOL' },
  { word: 'AVAX', canonical: 'AVAX' },
  { word: 'BNB', canonical: 'BNB' },
  { word: 'MATIC', canonical: 'MATIC' },
  { word: 'LINK', canonical: 'LINK' },
  { word: 'UNI', canonical: 'UNI' },
  { word: 'AAVE', canonical: 'AAVE' },
  { word: 'ARB', canonical: 'ARB' },
  { word: 'DOGE', canonical: 'DOGE' },
  { word: 'ADA', canonical: 'ADA' },
  { word: 'DOT', canonical: 'DOT' },
  { word: 'ATOM', canonical: 'ATOM' },
  { word: 'LTC', canonical: 'LTC' },
  { word: 'XRP', canonical: 'XRP' },
  { word: 'SHIB', canonical: 'SHIB' },
  { word: 'PEPE', canonical: 'PEPE' },
  { word: 'TRX', canonical: 'TRX' },
  { word: 'TON', canonical: 'TON' },
  { word: 'SUI', canonical: 'SUI' },
  { word: 'APT', canonical: 'APT' },
  { word: 'INJ', canonical: 'INJ' },
  { word: 'NEAR', canonical: 'NEAR' },
]

function extractTickers(text: string): string[] {
  const upper = text.toUpperCase()
  const found = new Set<string>()
  for (const { word, canonical } of TICKER_PATTERNS) {
    if (new RegExp(`\\b${word}\\b`).test(upper)) {
      found.add(canonical)
    }
  }
  return Array.from(found)
}

// ── RSS XML parser (no external dependency) ──────────────────────────────────

/** Extract the inner text of the first occurrence of <tag>...</tag>. */
function extractTag(xml: string, tag: string): string {
  const match = xml.match(
    new RegExp(
      `<${tag}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`,
      'i',
    ),
  )
  return (match?.[1] ?? match?.[2] ?? '').trim()
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function parseRssXml(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = []
  const itemRegex = /<item[\s\S]*?<\/item>/gi
  const matches = xml.match(itemRegex) ?? []

  for (const itemXml of matches) {
    const title = extractTag(itemXml, 'title')
    if (!title) continue

    const description = extractTag(itemXml, 'description')
    const link =
      extractTag(itemXml, 'link') || extractTag(itemXml, 'guid')
    const pubDate =
      extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'published')

    const cleanTitle = stripHtml(title)
    const cleanDesc = stripHtml(description).slice(0, 400)
    const tickers = extractTickers(`${cleanTitle} ${cleanDesc}`)

    items.push({
      title: cleanTitle,
      description: cleanDesc,
      url: link,
      source,
      published_at: pubDate
        ? new Date(pubDate).toISOString()
        : new Date().toISOString(),
      tickers,
    })
  }

  return items
}

// ── Single feed fetch ─────────────────────────────────────────────────────────

async function fetchFeed(feed: {
  source: string
  url: string
}): Promise<NewsItem[]> {
  try {
    const res = await fetch(feed.url, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
        'User-Agent': 'OmeswapATS/1.0',
      },
      next: { revalidate: 600 },
    })
    if (!res.ok) return []
    const xml = await res.text()
    return parseRssXml(xml, feed.source)
  } catch {
    return []
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch and merge recent crypto news from all registered RSS feeds.
 *
 * @param tickerFilter  Optional uppercase ticker (e.g. "ETH"). When supplied,
 *                      only items that mention this ticker in their tagged list
 *                      or in the headline are returned.
 * @returns             Up to 50 items sorted newest-first.
 */
export async function fetchNewsBundle(
  tickerFilter?: string,
): Promise<NewsBundle> {
  const results = await Promise.allSettled(RSS_FEEDS.map(fetchFeed))

  const all: NewsItem[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      all.push(...result.value)
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>()
  const deduped = all.filter((item) => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })

  // Sort newest-first
  deduped.sort(
    (a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  )

  const filtered = tickerFilter
    ? deduped.filter(
        (item) =>
          item.tickers.includes(tickerFilter.toUpperCase()) ||
          item.title.toUpperCase().includes(tickerFilter.toUpperCase()),
      )
    : deduped

  return {
    items: filtered.slice(0, 50),
    fetched_at: new Date().toISOString(),
  }
}
