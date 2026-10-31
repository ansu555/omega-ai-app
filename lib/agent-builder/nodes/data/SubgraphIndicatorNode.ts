import type { Node, Edge } from '@xyflow/react'

import { BaseNode } from '../BaseNode'
import { createNodeInstance } from '../registry'
import { runBot } from '../../engine/BotRunner'
import type {
  ConfigField,
  ExecutionContext,
  HandleDef,
} from '@/types/agent-builder-canvas'

type IndicatorPayload = {
  nodes: Node[]
  edges: Edge[]
  configs?: Record<string, Record<string, unknown>>
  outputNodeId?: string
  outputHandle?: string
}

export class SubgraphIndicatorNode extends BaseNode {
  readonly type = 'subgraph_indicator'
  readonly label = 'Imported indicator'
  readonly description =
    'Runs a published marketplace indicator subgraph (n8n-style block).'
  readonly icon = 'Layers'
  readonly category = 'data' as const
  readonly color = 'border-cyan-500'
  readonly bgColor = 'bg-cyan-950'

  readonly handles: HandleDef[] = [
    {
      id: 'signal',
      label: 'Run',
      position: 'left',
      type: 'target',
      dataType: 'signal',
    },
    {
      id: 'out',
      label: 'Out',
      position: 'right',
      type: 'source',
      dataType: 'any',
    },
  ]

  readonly configSchema: ConfigField[] = [
    {
      key: 'indicatorVersionId',
      label: 'Indicator version ID',
      type: 'text',
      default: '',
      placeholder: 'UUID from marketplace',
    },
    {
      key: 'displayLabel',
      label: 'Display label',
      type: 'text',
      default: 'Imported indicator',
    },
  ]

  async execute(
    inputs: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<Record<string, unknown>> {
    if (!inputs.signal) return { out: null }

    const vid = String(this.config.indicatorVersionId ?? '').trim()
    if (!vid) {
      throw new Error('Configure indicator version ID on this node')
    }

    const res = await fetch(`/api/marketplace/indicator-versions/${vid}`)
    if (!res.ok) {
      const t = await res.text()
      throw new Error(t || `Failed to load indicator (${res.status})`)
    }

    const data = (await res.json()) as {
      payload: IndicatorPayload
    }

    const pl = data.payload
    const nodes = pl.nodes ?? []
    const edges = pl.edges ?? []
    const nodeInstances = new Map<string, BaseNode>()

    for (const n of nodes) {
      const nt = (n.data as { nodeType?: string } | undefined)?.nodeType
      if (!nt) continue
      const inst = createNodeInstance(nt, n.id)
      const cfg = pl.configs?.[n.id]
      if (cfg) inst.setConfig(cfg)
      nodeInstances.set(n.id, inst)
    }

    const outputs = await runBot(
      nodes,
      edges,
      nodeInstances,
      context,
      () => {},
      () => {},
      () => {},
      () => {},
    )

    const oid = pl.outputNodeId
    const oh = pl.outputHandle ?? 'out'
    if (!oid) {
      throw new Error('Indicator is missing outputNodeId in published payload')
    }

    const nodeOut = outputs[oid] ?? {}
    const out =
      nodeOut[oh] ??
      nodeOut.price ??
      nodeOut.value ??
      nodeOut.signal ??
      Object.values(nodeOut)[0]

    return { out }
  }
}
