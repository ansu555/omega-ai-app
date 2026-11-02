/**
 * Subagent #4 — DeFi & Yield (P2).
 *
 * Owns protocol TVL, APYs, where to deploy stablecoins / idle capital, and
 * protocol health/risk. Its signature `defillama` tool lands in P3; in P2 it
 * reasons from token prices plus its own domain knowledge and records gaps.
 */

import type { SubagentSpec } from '@/lib/research/subagent-runtime'

export const defiYieldAgent: SubagentSpec = {
  id: 'defi_yield',
  name: 'DeFi & Yield',
  description:
    'Protocol TVL, APYs, where to park stablecoins / idle capital, and protocol ' +
    'health — always weighing yield against risk.',
  // defillama (protocol TVL + yields) lands in P3; price_snapshot grounds tokens.
  tools: ['defillama', 'price_snapshot'],
  systemPrompt: [
    'You are the DeFi & Yield specialist of a crypto deep-research team. Your',
    'domain is yield and capital deployment: protocol TVL, APYs, where stablecoins',
    'and idle capital can be put to work, and protocol health and risk. You answer',
    '"where can this capital earn yield, and how safely?".',
    '',
    'Use your tools to gather protocol and yield data (DefiLlama when available)',
    'and token prices. When yield data sources are unavailable, reason from what',
    'you can measure and record the missing APY/TVL figures as gaps rather than',
    'inventing numbers. Never quote a yield without its risk context — always pair',
    'an APY with the protocol risk (audits, TVL durability, peg/depeg, lockups).',
  ].join('\n'),
}
