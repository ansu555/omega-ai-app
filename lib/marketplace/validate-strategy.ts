export type StrategyDraftPayload = {
  nodes?: unknown[]
  edges?: unknown[]
  configs?: Record<string, Record<string, unknown>>
  assetPairs?: string[]
  regimeGates?: string[]
  risk?: {
    maxPositionPct?: number
    maxTradesPerDay?: number
    maxDailyLossPct?: number
    slippageBps?: number
    stopLossPercent?: number
  }
  directionSupport?: string[]
  indicatorRefs?: { indicatorVersionId: string }[]
}

export function validateMarketplaceStrategyPayload(
  payload: StrategyDraftPayload | null | undefined,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = []
  if (!payload) {
    return { ok: false, errors: ['Missing draft payload'] }
  }
  const pairs = payload.assetPairs ?? []
  if (!Array.isArray(pairs) || pairs.length === 0) {
    errors.push('At least one asset pair is required')
  }
  const gates = payload.regimeGates ?? []
  if (!Array.isArray(gates) || gates.length === 0) {
    errors.push('At least one regime gate is required')
  }
  const risk = payload.risk ?? {}
  const stop =
    typeof risk.stopLossPercent === 'number' && risk.stopLossPercent > 0
  if (!stop) {
    errors.push('Stop-loss (risk.stopLossPercent) is required')
  }
  const nodes = payload.nodes ?? []
  const edges = payload.edges ?? []
  if (!Array.isArray(nodes) || nodes.length === 0) {
    errors.push('Strategy graph must have at least one node')
  }
  if (!Array.isArray(edges)) {
    errors.push('Invalid edges')
  }
  return errors.length ? { ok: false, errors } : { ok: true }
}

export type IndicatorDraftPayload = {
  nodes?: unknown[]
  edges?: unknown[]
  configs?: Record<string, Record<string, unknown>>
  outputNodeId?: string
  outputHandle?: string
  inputSchema?: { id: string; label: string; dataType: string }[]
}

export function validateIndicatorPayload(
  payload: IndicatorDraftPayload | null | undefined,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = []
  if (!payload) {
    return { ok: false, errors: ['Missing draft payload'] }
  }
  if (!payload.outputNodeId) {
    errors.push('Designate an output node for the indicator')
  }
  const nodes = payload.nodes ?? []
  if (!Array.isArray(nodes) || nodes.length === 0) {
    errors.push('Indicator graph must have at least one node')
  }
  return errors.length ? { ok: false, errors } : { ok: true }
}
