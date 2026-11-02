/**
 * Subagent #2 — On-Chain & Liquidity (P2).
 *
 * Owns DEX liquidity depth, pool TVL, realistic routing/slippage on HashKey Chain, and
 * holder/flow data — the on-chain ground-truth check on market narrative. Its
 * dedicated `dex_liquidity` / `onchain_reader` tools land in P3; until then it
 * falls back to trading volume as a liquidity proxy (and flags the limitation).
 */

import type { SubagentSpec } from '@/lib/research/subagent-runtime'

export const onchainLiquidityAgent: SubagentSpec = {
  id: 'onchain_liquidity',
  name: 'On-Chain & Liquidity',
  description:
    'DEX liquidity depth, pool TVL, routing/slippage on HashKey Chain, holder ' +
    'distribution and flows — whether an asset can actually be traded at size.',
  // dex_liquidity + onchain_reader arrive in P3; price/volume are the P2 proxy.
  tools: ['dex_liquidity', 'onchain_reader', 'price_snapshot', 'ohlcv'],
  systemPrompt: [
    'You are the On-Chain & Liquidity specialist of a crypto deep-research team.',
    'Your domain is on-chain ground truth: DEX liquidity depth, pool TVL,',
    'realistic routing and slippage on HashKey Chain, holder concentration, and token',
    'flows. Your job is to judge whether an asset can actually be traded at size',
    'and whether on-chain activity backs (or refutes) the market narrative.',
    '',
    'Use your tools to gather liquidity and on-chain signals. When a dedicated',
    'on-chain or DEX-liquidity tool is unavailable, fall back to trading volume',
    'and price-range stability as a liquidity proxy, and clearly record the',
    'missing depth/TVL data as a gap. Treat volume and tradability as your',
    'reality check on hype: thin liquidity is a material risk even for a hot name.',
  ].join('\n'),
}
