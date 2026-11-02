/**
 * Deep Research — ATS bridge tool (P1).
 *
 * `asset_decision` wraps the ENTIRE existing six-agent ATS pipeline
 * (`runOrchestrator`) as a single callable tool. This is the "evolve, don't
 * replace" hinge from the blueprint: when a deep run needs a hard BUY/SELL/HOLD
 * verdict on one token, a subagent drills down through the full v1 engine and
 * gets back a structured decision + Kelly sizing + regime + agent votes.
 *
 * Always runs in `solo` mode — research only, never executes a trade — and gives
 * the inner run its own receipt id derived from the parent research run. The
 * inner orchestrator's SSE events are swallowed here (the tool emits its own
 * `tool.called` / `evidence.found` via the runtime); the rich receipt is reduced
 * to evidence the subagent can reason over.
 *
 * Server-only.
 */

import { runOrchestrator } from '@/lib/ats/orchestrator'
import type { RunEvent } from '@/lib/ats/types'
import { canonicalizeTicker } from '@/lib/research/intake'
import type { ResearchTool } from '@/lib/research/tools/types'
import { asUpperTicker, evidence, fail, ok, round } from '@/lib/research/tools/helpers'

export const assetDecisionTool: ResearchTool = {
  name: 'asset_decision',
  description:
    'Run the full multi-agent ATS pipeline (data → regime → signal → graph → ' +
    'risk → consensus) to get a hard BUY/SELL/HOLD/VETO verdict on ONE token, ' +
    'with confidence, Kelly position sizing and market regime. Use this when the ' +
    'question hinges on a concrete trade decision for a single covered asset. ' +
    'Heavyweight — call at most once per asset per run.',
  trustTier: 'derived',
  parameters: {
    type: 'object',
    properties: {
      ticker: {
        type: 'string',
        description: 'The single asset symbol to get a decision on, e.g. WHSK, BTC, ETH.',
      },
    },
    required: ['ticker'],
    additionalProperties: false,
  },
  async execute(args, ctx) {
    const raw = asUpperTicker(args.ticker)
    const ticker = canonicalizeTicker(raw) ?? raw
    if (!ticker) return fail('Missing required argument: ticker.')
    if (!ctx.userWallet) {
      return fail('asset_decision requires an authenticated wallet (none in context).')
    }

    // Own receipt id so concurrent drill-downs never collide, traceable to parent.
    const innerRunId = `${ctx.run_id}_ats_${ticker}_${Math.random().toString(36).slice(2, 7)}`
    const swallow = (_evt: RunEvent) => {} // inner SSE events stay internal

    try {
      const receipt = await runOrchestrator(
        {
          run_id: innerRunId,
          query: `Deep-research drill-down: assess ${ticker}.`,
          ticker,
          mode: 'solo', // research only — never executes
          userWallet: ctx.userWallet,
          chainId: ctx.chainId,
        },
        swallow,
      )

      const c = receipt.consensus
      const sizing = receipt.risk_sizing
      const votes = receipt.agent_votes.map((v) => `${v.agent}:${v.vote}`).join(', ')

      const summary =
        `ATS verdict on ${ticker}: ${c.decision} ` +
        `(confidence ${round(c.confidence * 100, 0)}%) · regime ${receipt.regime} · ` +
        `votes [${votes}]` +
        (sizing.veto_triggered
          ? ` · VETO: ${sizing.veto_reason}`
          : ` · suggested size $${sizing.size_usd} (Kelly ${round(sizing.kelly_fraction * 100, 1)}%)`) +
        `. ${c.rationale}`

      return ok(summary, [
        evidence(
          `ATS multi-agent consensus on ${ticker} is ${c.decision} at ${round(c.confidence * 100, 0)}% confidence.`,
          'ATS',
          'derived',
          {
            ticker,
            decision: c.decision,
            confidence: c.confidence,
            rationale: c.rationale,
            regime: receipt.regime,
            agent_votes: receipt.agent_votes,
            risk_sizing: sizing,
            net_directional_bias: receipt.causal_chain.net_directional_bias,
            receipt_id: receipt.id ?? null,
            run_id: innerRunId,
          },
        ),
      ])
    } catch (err) {
      return fail(err instanceof Error ? err.message : `ATS run failed for ${ticker}.`)
    }
  },
}
