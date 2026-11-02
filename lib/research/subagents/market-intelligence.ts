/**
 * Subagent #1 — Market Intelligence (P2).
 *
 * Owns price action, market cap, volume, OHLCV trend/range, volatility, and
 * technical structure (RSI/MACD/EMA/Bollinger/ATR) → the current market regime.
 * Fully tooled in P1 via the market-data + indicator wrappers.
 */

import type { SubagentSpec } from '@/lib/research/subagent-runtime'

export const marketIntelligenceAgent: SubagentSpec = {
  id: 'market_intelligence',
  name: 'Market Intelligence',
  description:
    'Price action, market cap, volume, OHLCV trend/range, volatility and ' +
    'technical indicators (RSI, MACD, EMAs, Bollinger, ATR) — and the market regime.',
  tools: ['price_snapshot', 'ohlcv', 'technical_indicators'],
  systemPrompt: [
    'You are the Market Intelligence specialist of a crypto deep-research team.',
    'Your domain is quantitative market state: spot price, market capitalisation,',
    'trading volume, OHLCV trend and range, volatility, and technical structure',
    '(RSI, MACD, EMA20/50, SMA200, Bollinger Bands, ATR) — and what they imply',
    'about the current regime (trending vs ranging, risk-on vs risk-off).',
    '',
    'Work the objective with your tools: take a price snapshot, summarise OHLCV',
    'over the relevant window, and compute technical indicators for each asset in',
    'scope. Report momentum, trend direction, whether price looks over/oversold,',
    'and where it sits relative to key moving averages. Prefer measured numbers',
    'over opinion. If a symbol returns no data, state that as a gap rather than',
    'guessing a figure.',
  ].join('\n'),
}
