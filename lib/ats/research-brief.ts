import type {
  AgentVote,
  Consensus,
  DataBundle,
  Decision,
  Mode,
  NewsBundle,
  ResearchBrief,
  RiskSizing,
} from '@/lib/ats/types'
import type { ExecutionAgentResult } from '@/lib/ats/agents/execution-agent'
import type { GraphAgentResult } from '@/lib/ats/agents/graph-agent'
import type { RegimeAgentResult } from '@/lib/ats/agents/regime-agent'
import type { RiskAgentResult } from '@/lib/ats/agents/risk-agent'
import type { SignalAgentResult } from '@/lib/ats/agents/signal-agent'

interface BuildResearchBriefInput {
  query: string
  mode: Mode
  chainId: number
  data: DataBundle
  news: NewsBundle
  regimeResult: RegimeAgentResult
  signalResult: SignalAgentResult
  graphResult: GraphAgentResult
  riskResult: RiskAgentResult
  consensus: Consensus
  executionResult?: ExecutionAgentResult | null
  proofRef?: string | null
}

function getConvictionLabel(confidence: number): ResearchBrief['conviction_label'] {
  if (confidence >= 0.78) return 'high'
  if (confidence >= 0.56) return 'medium'
  return 'low'
}

function getWorthIt(decision: Decision, sizing: RiskSizing): ResearchBrief['worth_it'] {
  if (decision === 'BUY' && !sizing.veto_triggered && sizing.size_usd > 0) return 'yes'
  if (decision === 'SELL' || decision === 'VETO') return 'no'
  return 'watch'
}

function buildHeadline(
  ticker: string,
  worthIt: ResearchBrief['worth_it'],
  decision: Decision,
): string {
  if (worthIt === 'yes') return `${ticker} has a risk-adjusted entry setup right now.`
  if (decision === 'SELL') return `${ticker} does not justify fresh exposure right now.`
  if (decision === 'VETO') return `${ticker} is blocked by risk controls right now.`
  return `${ticker} is a watchlist name, not a conviction trade yet.`
}

function buildExecutionSummary(
  mode: Mode,
  chainId: number,
  consensus: Consensus,
  sizing: RiskSizing,
  executionResult?: ExecutionAgentResult | null,
): ResearchBrief['execution'] {
  if (executionResult?.status === 'submitted') {
    return {
      mode,
      status: 'submitted',
      summary: `Execution submitted on HashKey Chain ${chainId} with ${executionResult.token_in} -> ${executionResult.token_out}.`,
      chain_id: chainId,
      tx_hash: executionResult.tx_hash,
    }
  }

  if (executionResult?.status === 'failed' || executionResult?.status === 'pending_deployment') {
    return {
      mode,
      status: 'blocked',
      summary: executionResult.error ?? 'Execution is currently blocked on 0G.',
      chain_id: chainId,
      tx_hash: executionResult.tx_hash,
    }
  }

  if (mode === 'assisted' && (consensus.decision === 'BUY' || consensus.decision === 'SELL') && !sizing.veto_triggered) {
    return {
      mode,
      status: 'approval_required',
      summary: `The thesis is actionable on 0G, but execution still requires your approval for a ${consensus.decision} of about $${sizing.size_usd.toFixed(2)}.`,
      chain_id: chainId,
      tx_hash: null,
    }
  }

  if (mode === 'autonomous' && (consensus.decision === 'BUY' || consensus.decision === 'SELL') && !sizing.veto_triggered) {
    return {
      mode,
      status: 'ready',
      summary: `The setup is executable on 0G once routing and wallet conditions are satisfied.`,
      chain_id: chainId,
      tx_hash: null,
    }
  }

  return {
    mode,
    status: 'not_applicable',
    summary: sizing.veto_triggered
      ? `Execution is blocked because risk controls vetoed the trade: ${sizing.veto_reason ?? 'risk veto'}.`
      : `Execution is not active because the current decision is ${consensus.decision}.`,
    chain_id: chainId,
    tx_hash: null,
  }
}

function topEvidence(news: NewsBundle) {
  return news.items.slice(0, 5).map((item) => ({
    title: item.title,
    source: item.source,
    url: item.url,
    published_at: item.published_at,
    summary: item.description,
  }))
}

function voteSummary(vote: AgentVote): string {
  return vote.rationale || `${vote.agent} voted ${vote.vote}.`
}

export function buildResearchBrief(input: BuildResearchBriefInput): ResearchBrief {
  const {
    mode,
    chainId,
    data,
    news,
    regimeResult,
    signalResult,
    graphResult,
    riskResult,
    consensus,
    executionResult,
  } = input

  const worthIt = getWorthIt(consensus.decision, riskResult.sizing)
  const convictionLabel = getConvictionLabel(consensus.confidence)
  const execution = buildExecutionSummary(
    mode,
    chainId,
    consensus,
    riskResult.sizing,
    executionResult,
  )

  const thesis = [
    `Regime is ${regimeResult.regime.replace(/_/g, ' ')} with ${(regimeResult.confidence * 100).toFixed(0)}% confidence.`,
    `Signal stack leans ${signalResult.vote.vote} with scores T ${signalResult.scores.technical.toFixed(2)}, S ${signalResult.scores.sentiment.toFixed(2)}, C ${signalResult.scores.causal.toFixed(2)}, I ${signalResult.scores.institutional.toFixed(2)}.`,
    `Graph agent sees BTC correlation at ${graphResult.btc_correlation.toFixed(2)} and ${graphResult.insight.toLowerCase()}`,
  ]

  const counterPoints = [
    riskResult.sizing.veto_reason ?? `Risk guardrails cap the position to $${riskResult.sizing.size_usd.toFixed(2)} with max loss $${riskResult.sizing.max_loss_usd.toFixed(2)}.`,
    signalResult.sentiment.dominant_theme
      ? `Narrative risk is concentrated around: ${signalResult.sentiment.dominant_theme}.`
      : 'Narrative conviction is limited by the available news flow.',
    graphResult.btc_correlation >= 0.7
      ? 'The thesis is still highly dependent on BTC direction and broader market beta.'
      : 'Cross-asset contagion is moderate, so confirmation from price action still matters.',
  ]

  const riskFlags = [
    `Suggested size: $${riskResult.sizing.size_usd.toFixed(2)}.`,
    `Maximum modeled loss: $${riskResult.sizing.max_loss_usd.toFixed(2)}.`,
    riskResult.sizing.veto_triggered
      ? `Risk veto: ${riskResult.sizing.veto_reason ?? 'trade blocked'}`
      : `Kelly fraction: ${(riskResult.sizing.kelly_fraction * 100).toFixed(1)}%.`,
  ]

  const summary =
    worthIt === 'yes'
      ? `${data.ticker} has a ${convictionLabel}-conviction ${consensus.decision.toLowerCase()} thesis backed by the six-agent stack. The ATS recommends sizing into roughly $${riskResult.sizing.size_usd.toFixed(2)} while respecting a modeled max loss of $${riskResult.sizing.max_loss_usd.toFixed(2)}.`
      : worthIt === 'no'
        ? `${data.ticker} is not worth a fresh position right now. The ATS stack either sees a sell thesis or a hard risk veto, so the right move is to avoid adding size until the setup improves.`
        : `${data.ticker} is still a watchlist setup. The agents see some signal, but not enough aligned evidence to justify capital deployment yet.`

  return {
    verdict: consensus.decision,
    worth_it: worthIt,
    headline: buildHeadline(data.ticker, worthIt, consensus.decision),
    summary,
    conviction_label: convictionLabel,
    confidence: consensus.confidence,
    suggested_allocation_usd: riskResult.sizing.size_usd,
    max_loss_usd: riskResult.sizing.max_loss_usd,
    allocation_note: riskResult.vote.rationale,
    thesis,
    counter_points: counterPoints,
    risk_flags: riskFlags,
    execution,
    agent_findings: [
      {
        agent: 'data',
        label: 'Data Agent',
        summary: `Captured price $${data.current_price.toLocaleString()}, 24h change ${data.price_change_24h.toFixed(2)}%, quality ${(data.quality_score * 100).toFixed(0)}%, and ${news.items.length} tagged news items.`,
      },
      {
        agent: 'regime',
        label: 'Regime Agent',
        summary: voteSummary(regimeResult.vote),
        vote: regimeResult.vote.vote,
        confidence: regimeResult.vote.confidence,
      },
      {
        agent: 'signal',
        label: 'Signal Agent',
        summary: voteSummary(signalResult.vote),
        vote: signalResult.vote.vote,
        confidence: signalResult.vote.confidence,
      },
      {
        agent: 'graph',
        label: 'Graph Agent',
        summary: voteSummary(graphResult.vote),
        vote: graphResult.vote.vote,
        confidence: graphResult.vote.confidence,
      },
      {
        agent: 'risk',
        label: 'Risk Agent',
        summary: voteSummary(riskResult.vote),
        vote: riskResult.vote.vote,
        confidence: riskResult.vote.confidence,
      },
      {
        agent: 'orchestrator',
        label: 'Orchestrator',
        summary: consensus.rationale,
        vote: consensus.decision === 'VETO' ? 'HOLD' : consensus.decision === 'BUY' ? 'BUY' : consensus.decision === 'SELL' ? 'SELL' : 'HOLD',
        confidence: consensus.confidence,
      },
      {
        agent: 'execution',
        label: 'Execution Agent',
        summary: execution.summary,
      },
    ],
    evidence: topEvidence(news),
  }
}

export function buildFallbackResearchBrief(args: {
  ticker: string
  chainId: number
  mode: Mode
  consensus: Consensus
  sizing: RiskSizing
  error: string
}): ResearchBrief {
  return {
    verdict: args.consensus.decision,
    worth_it: 'watch',
    headline: `${args.ticker} research did not complete cleanly.`,
    summary: `The run stopped before the ATS could produce a full decision package. Error: ${args.error}`,
    conviction_label: 'low',
    confidence: 0,
    suggested_allocation_usd: args.sizing.size_usd,
    max_loss_usd: args.sizing.max_loss_usd,
    allocation_note: args.sizing.veto_reason ?? 'No allocation should be made from this failed run.',
    thesis: ['The run ended early, so the thesis is incomplete.'],
    counter_points: [args.error],
    risk_flags: [args.sizing.veto_reason ?? 'Treat this run as non-actionable.'],
    execution: {
      mode: args.mode,
      status: 'not_applicable',
      summary: 'Execution is disabled because the research run failed.',
      chain_id: args.chainId,
      tx_hash: null,
    },
    agent_findings: [],
    evidence: [],
  }
}
