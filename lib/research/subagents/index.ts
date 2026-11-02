/**
 * Deep Research — subagent registry (P2).
 *
 * The six specialist subagents from the blueprint (§1). Each is a declarative
 * `SubagentSpec` (system prompt + toolset); the generic ReAct loop in
 * `lib/research/subagent-runtime.ts` runs them, and the lead researcher
 * (`lib/research/lead.ts`) selects which to spawn per query.
 *
 * Some specialists reference tools that only land in P3 (web_search, defillama,
 * onchain_reader, …). The tool registry silently drops unknown tool names, so
 * those agents run on their available P1 tools today and automatically gain the
 * richer toolset once it is built — no spec changes needed.
 */

import type { SubagentSpec } from '@/lib/research/subagent-runtime'

import { marketIntelligenceAgent } from '@/lib/research/subagents/market-intelligence'
import { onchainLiquidityAgent } from '@/lib/research/subagents/onchain-liquidity'
import { newsSentimentAgent } from '@/lib/research/subagents/news-sentiment'
import { defiYieldAgent } from '@/lib/research/subagents/defi-yield'
import { fundamentalsAgent } from '@/lib/research/subagents/fundamentals'
import { riskPortfolioAgent } from '@/lib/research/subagents/risk-portfolio'

/** All six specialist subagents, in canonical order. */
export const SUBAGENTS: SubagentSpec[] = [
  marketIntelligenceAgent,
  onchainLiquidityAgent,
  newsSentimentAgent,
  defiYieldAgent,
  fundamentalsAgent,
  riskPortfolioAgent,
]

const BY_ID: Map<string, SubagentSpec> = new Map(SUBAGENTS.map((s) => [s.id, s]))

/** Look up a specialist by id. */
export function getSubagent(id: string): SubagentSpec | undefined {
  return BY_ID.get(id)
}

/** All registered subagent ids. */
export function allSubagentIds(): string[] {
  return SUBAGENTS.map((s) => s.id)
}

/** Markdown bullet list of `id: description` — fed to the lead planner. */
export function subagentDirectory(): string {
  return SUBAGENTS.map((s) => `- ${s.id}: ${s.description ?? s.name}`).join('\n')
}

export {
  marketIntelligenceAgent,
  onchainLiquidityAgent,
  newsSentimentAgent,
  defiYieldAgent,
  fundamentalsAgent,
  riskPortfolioAgent,
}
