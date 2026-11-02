/**
 * Deep Research — tool layer barrel (P1).
 *
 * Import everything tool-related from `@/lib/research/tools`.
 */

export type {
  ResearchTool,
  ToolContext,
  ToolResult,
  ToolParameterSchema,
} from '@/lib/research/tools/types'

export {
  RESEARCH_TOOLS,
  allToolNames,
  getTool,
  getTools,
  toolToOpenAI,
  toOpenAITools,
  runTool,
} from '@/lib/research/tools/registry'

export {
  priceSnapshotTool,
  ohlcvTool,
  technicalIndicatorsTool,
} from '@/lib/research/tools/market'
export { cryptoNewsTool } from '@/lib/research/tools/news'
export { assetDecisionTool } from '@/lib/research/tools/asset-decision'
export { webSearchTool, readUrlTool } from '@/lib/research/tools/web'
export { defillamaTool } from '@/lib/research/tools/defillama'
export { onchainReaderTool, dexLiquidityTool } from '@/lib/research/tools/onchain'
export { tokenAuditTool } from '@/lib/research/tools/fundamentals'
export { correlationTool } from '@/lib/research/tools/correlation'
