/**
 * Deep Research — tool registry (P1).
 *
 * Single source of truth for the callable tools the subagent runtime can use.
 * The lead planner (P2) will assign a subset of these names to each specialist;
 * here we just register them, look them up by name, convert them to the OpenAI
 * function-calling schema, and run them behind a never-throws safety wrapper.
 *
 * In-house tools (P1):
 *   price_snapshot · ohlcv · technical_indicators · crypto_news · asset_decision
 * Hybrid-retrieval tools (P3):
 *   web_search · read_url · defillama · onchain_reader · dex_liquidity ·
 *   token_audit · correlation
 *
 * Server-only.
 */

import type { ChatTool } from '@/lib/ats/llm'
import type { ResearchTool, ToolContext, ToolResult } from '@/lib/research/tools/types'

import {
  priceSnapshotTool,
  ohlcvTool,
  technicalIndicatorsTool,
} from '@/lib/research/tools/market'
import { cryptoNewsTool } from '@/lib/research/tools/news'
import { assetDecisionTool } from '@/lib/research/tools/asset-decision'
import { webSearchTool, readUrlTool } from '@/lib/research/tools/web'
import { defillamaTool } from '@/lib/research/tools/defillama'
import { onchainReaderTool, dexLiquidityTool } from '@/lib/research/tools/onchain'
import { tokenAuditTool } from '@/lib/research/tools/fundamentals'
import { correlationTool } from '@/lib/research/tools/correlation'

/** Every registered research tool. */
export const RESEARCH_TOOLS: ResearchTool[] = [
  // In-house (P1)
  priceSnapshotTool,
  ohlcvTool,
  technicalIndicatorsTool,
  cryptoNewsTool,
  assetDecisionTool,
  // Hybrid retrieval (P3)
  webSearchTool,
  readUrlTool,
  defillamaTool,
  onchainReaderTool,
  dexLiquidityTool,
  tokenAuditTool,
  correlationTool,
]

const BY_NAME: Map<string, ResearchTool> = new Map(
  RESEARCH_TOOLS.map((t) => [t.name, t]),
)

/** All registered tool names. */
export function allToolNames(): string[] {
  return RESEARCH_TOOLS.map((t) => t.name)
}

/** Look up a single tool by name. */
export function getTool(name: string): ResearchTool | undefined {
  return BY_NAME.get(name)
}

/**
 * Resolve a list of tool names to tools, preserving order and silently dropping
 * unknown names (so a specialist's toolset can reference not-yet-built tools).
 */
export function getTools(names: string[]): ResearchTool[] {
  const out: ResearchTool[] = []
  for (const name of names) {
    const tool = BY_NAME.get(name)
    if (tool) out.push(tool)
  }
  return out
}

// ── OpenAI function-calling adapter ──────────────────────────────────────────

/** Convert one research tool to the OpenAI function-tool schema. */
export function toolToOpenAI(tool: ResearchTool): ChatTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as unknown as Record<string, unknown>,
    },
  }
}

/** Convert a list of research tools to OpenAI function-tool schemas. */
export function toOpenAITools(tools: ResearchTool[]): ChatTool[] {
  return tools.map(toolToOpenAI)
}

// ── Safe execution ───────────────────────────────────────────────────────────

/**
 * Execute a tool by name with a defensive wrapper: an unknown tool or an
 * (illegal) thrown error is converted to a `{ ok: false }` ToolResult so the
 * runtime loop never crashes on a single bad call.
 */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const tool = BY_NAME.get(name)
  if (!tool) {
    return { ok: false, evidence: [], summary: `Unknown tool: ${name}`, error: 'unknown_tool' }
  }
  try {
    return await tool.execute(args, ctx)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, evidence: [], summary: `Tool ${name} threw: ${message}`, error: message }
  }
}
