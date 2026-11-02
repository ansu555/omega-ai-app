/**
 * Deep Research — tool contract (P1).
 *
 * Every capability the subagent runtime can call — in-house data fetchers,
 * technical analysis, the full ATS decision pipeline, and (later) web search /
 * DefiLlama — implements `ResearchTool`. A tool takes a JSON args object plus a
 * `ToolContext`, does its work, and returns a `ToolResult` whose `evidence` is
 * already normalised to the shared `Evidence` shape (`lib/research/types.ts`).
 *
 * Contract rules:
 *   • Tools MUST NOT throw — failures come back as `{ ok: false, error }` so a
 *     single bad source degrades gracefully instead of aborting a run (blueprint §9).
 *   • `summary` is the compact, model-facing observation fed back into the loop.
 *   • `parameters` is a JSON-schema object the model uses for argument shaping.
 *
 * Server-only (tools wrap server data layers / Supabase / OpenRouter).
 */

import type { Evidence, TrustTier } from '@/lib/research/types'
import type { RunEvent } from '@/lib/ats/types'

/** Runtime context threaded into every tool call. */
export interface ToolContext {
  /** Caller's wallet — resolves their stored OpenRouter key + funds ATS reads. */
  userWallet?: string
  /** Chain the research is scoped to (defaults to HashKey Chain at the call site). */
  chainId: number
  /** Run id for event attribution. */
  run_id: string
  /** Stable id of the calling subagent (e.g. 'market_intelligence'), if any. */
  agentId?: string
  /** Optional event sink. Tools/runtime stay silent when omitted. */
  emit?: (event: RunEvent) => void
  /** Cooperative cancellation when the run's wall-clock budget is exceeded. */
  signal?: AbortSignal
}

/** Outcome of a single tool invocation. */
export interface ToolResult {
  /** False when the tool failed; `error` is then populated. */
  ok: boolean
  /** Normalised evidence the tool produced (may be empty). */
  evidence: Evidence[]
  /** Compact natural-language observation fed back to the model. */
  summary: string
  /** Failure reason when `ok === false`. */
  error?: string
}

/** Minimal JSON-schema for a tool's argument object. */
export interface ToolParameterSchema {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
  additionalProperties?: boolean
}

/** A callable research capability exposed to the subagent runtime. */
export interface ResearchTool {
  /** Unique snake_case identifier the model uses to call it. */
  name: string
  /** What it does + when to use it — read by the model for tool selection. */
  description: string
  /** JSON-schema describing the args object. */
  parameters: ToolParameterSchema
  /** Default provenance tier for evidence this tool emits. */
  trustTier: TrustTier
  /**
   * Execute the tool. Implementations must never throw — catch internally and
   * return `{ ok: false, error }`.
   */
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>
}
