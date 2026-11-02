import { create } from 'zustand'
import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type {
  AgentName,
  DecisionReceipt,
  Mode,
  ResearchBrief,
  RunEvent,
} from '@/lib/ats/types'
import type { ResearchReport } from '@/lib/research/types'

export type NodeState = 'idle' | 'thinking' | 'done' | 'vetoed'
export type EdgeState = 'idle' | 'active' | 'complete' | 'veto'

export interface AgentNodeData extends Record<string, unknown> {
  agentId: AgentName
  label: string
  roleLabel: string
  processLabel: string
  state: NodeState
  lastOutput: string
  confidence: number | null
  subTasks: { label: string; done: boolean }[]
}

export interface ResearchEdgeData extends Record<string, unknown> {
  status: EdgeState
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  ts: string
  pending?: boolean
  brief?: ResearchBrief | null
}

export interface PendingApproval {
  run_id: string
  decision: 'BUY' | 'SELL'
  size_usd: number
}

// ── Deep Research live state (P6) ──────────────────────────────────────────────
// Multi-subagent deep runs stream a dynamic event graph (plan → N specialists →
// synthesis → citations → attestation) that the fixed 7-node ATS graph above
// can't represent. This slice is built up from the subagent.* / tool.* /
// evidence.* / plan.created / round.evaluated / synthesis.draft / citation.attached
// events so DeepResearchGraph can render the live topology and activity feed.

export type DeepPhase =
  | 'idle'
  | 'planning'
  | 'researching'
  | 'evaluating'
  | 'synthesizing'
  | 'citing'
  | 'done'
  | 'error'

export type DeepSubagentStatus = 'spawned' | 'working' | 'done' | 'error'

export interface DeepSubagentState {
  id: string
  name: string
  objective: string
  status: DeepSubagentStatus
  tools: string[]
  toolCalls: number
  evidenceCount: number
  claims: number
  confidence: number | null
  lastMessage: string
}

export type DeepActivityKind =
  | 'phase'
  | 'plan'
  | 'subagent'
  | 'tool'
  | 'evidence'
  | 'round'
  | 'synthesis'
  | 'citation'
  | 'report'

export interface DeepActivityEntry {
  id: string
  kind: DeepActivityKind
  agent?: string
  message: string
  ts: string
}

export interface DeepCrossVerification {
  corroborated: number
  contradicted: number
  unverified: number
  summary: string
}

export interface DeepCitationStats {
  coverage: number
  citations: number
  unsupported: number
}

export interface DeepAttestation {
  proofRef: string
  sealed: boolean
  source: string
  note: string
}

export interface DeepRunState {
  /** True from the deep run.start until resetRun — keeps the graph + report visible. */
  active: boolean
  phase: DeepPhase
  goal: string | null
  queryType: string | null
  objectives: { agentId: string; objective: string }[]
  /** Specialists, in spawn order. */
  subagents: DeepSubagentState[]
  /** Capped, chronological activity feed. */
  activity: DeepActivityEntry[]
  round: number
  confidence: number | null
  crossVerification: DeepCrossVerification | null
  citation: DeepCitationStats | null
  attestation: DeepAttestation | null
}

const MAX_ACTIVITY = 80
let activitySeq = 0

function initialDeepRun(): DeepRunState {
  return {
    active: false,
    phase: 'idle',
    goal: null,
    queryType: null,
    objectives: [],
    subagents: [],
    activity: [],
    round: 0,
    confidence: null,
    crossVerification: null,
    citation: null,
    attestation: null,
  }
}

function addActivity(
  deep: DeepRunState,
  kind: DeepActivityKind,
  message: string,
  agent?: string,
): DeepRunState {
  const entry: DeepActivityEntry = {
    id: `act_${Date.now()}_${++activitySeq}`,
    kind,
    message,
    agent,
    ts: new Date().toISOString(),
  }
  const activity = [...deep.activity, entry]
  return { ...deep, activity: activity.length > MAX_ACTIVITY ? activity.slice(-MAX_ACTIVITY) : activity }
}

function upsertSubagent(
  deep: DeepRunState,
  id: string,
  patch: Partial<DeepSubagentState>,
): DeepRunState {
  const idx = deep.subagents.findIndex((s) => s.id === id)
  if (idx === -1) {
    const base: DeepSubagentState = {
      id,
      name: id,
      objective: '',
      status: 'spawned',
      tools: [],
      toolCalls: 0,
      evidenceCount: 0,
      claims: 0,
      confidence: null,
      lastMessage: '',
    }
    return { ...deep, subagents: [...deep.subagents, { ...base, ...patch }] }
  }
  const subagents = deep.subagents.map((s, i) => (i === idx ? { ...s, ...patch } : s))
  return { ...deep, subagents }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

const AGENT_META: Record<AgentName, { label: string; roleLabel: string; processLabel: string }> = {
  data: {
    label: 'Data Agent',
    roleLabel: 'Market Intake',
    processLabel: 'Price, volume, and news aggregation',
  },
  regime: {
    label: 'Regime Agent',
    roleLabel: 'Regime Model',
    processLabel: 'Market regime classification',
  },
  signal: {
    label: 'Signal Agent',
    roleLabel: 'Signal Stack',
    processLabel: 'Technical, sentiment, causal, and institutional checks',
  },
  graph: {
    label: 'Graph Agent',
    roleLabel: 'Contagion Map',
    processLabel: 'BTC correlation and contagion analysis',
  },
  risk: {
    label: 'Risk Agent',
    roleLabel: 'Risk Control',
    processLabel: 'Sizing, exposure caps, and veto rules',
  },
  orchestrator: {
    label: 'Orchestrator',
    roleLabel: 'Decision Desk',
    processLabel: 'Consensus and thesis synthesis',
  },
  execution: {
    label: 'Execution Agent',
    roleLabel: 'HashKey Execution',
    processLabel: 'HashKey execution readiness and approval state',
  },
}

const INCOMING_EDGE_IDS: Record<AgentName, string[]> = {
  data: [],
  regime: ['data-regime'],
  signal: ['data-signal'],
  graph: ['data-graph'],
  risk: ['regime-risk', 'signal-risk', 'graph-risk'],
  orchestrator: ['risk-orch'],
  execution: ['orch-exec'],
}

const OUTGOING_EDGE_IDS: Record<AgentName, string[]> = {
  data: ['data-regime', 'data-signal', 'data-graph'],
  regime: ['regime-risk'],
  signal: ['signal-risk'],
  graph: ['graph-risk'],
  risk: ['risk-orch'],
  orchestrator: ['orch-exec'],
  execution: [],
}

function createNode(agentId: AgentName, position: { x: number; y: number }, subTasks: AgentNodeData['subTasks'] = []): Node<AgentNodeData> {
  const meta = AGENT_META[agentId]
  return {
    id: agentId,
    type: 'agentNode',
    position,
    data: {
      agentId,
      label: meta.label,
      roleLabel: meta.roleLabel,
      processLabel: meta.processLabel,
      state: 'idle',
      lastOutput: '',
      confidence: null,
      subTasks,
    },
  }
}

const INITIAL_NODES: Node<AgentNodeData>[] = [
  createNode('data',         { x:  60, y: 360 }),
  createNode('regime',       { x: 420, y:  30 }),
  createNode('signal',       { x: 420, y: 330 }, [
    { label: 'Technical',    done: false },
    { label: 'Sentiment',    done: false },
    { label: 'Causal',       done: false },
    { label: 'Institutional',done: false },
  ]),
  createNode('graph',        { x: 420, y: 720 }),
  createNode('risk',         { x: 780, y: 360 }),
  createNode('orchestrator', { x: 1140, y: 180 }),
  createNode('execution',    { x: 1140, y: 490 }),
]

function edgeVisuals(status: EdgeState) {
  if (status === 'active') {
    return {
      animated: true,
      color: '#8b5cf6',
      width: 2.4,
    }
  }

  if (status === 'complete') {
    return {
      animated: false,
      color: '#34d399',
      width: 2.6,
    }
  }

  if (status === 'veto') {
    return {
      animated: false,
      color: '#f87171',
      width: 2.4,
    }
  }

  return {
    animated: false,
    color: '#4b5563',
    width: 1.6,
  }
}

function styleEdge(edge: Edge<ResearchEdgeData>, status: EdgeState): Edge<ResearchEdgeData> {
  const visuals = edgeVisuals(status)
  return {
    ...edge,
    data: { status },
    animated: visuals.animated,
    style: {
      stroke: visuals.color,
      strokeWidth: visuals.width,
      opacity: status === 'idle' ? 0.65 : 1,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: visuals.color,
      width: 18,
      height: 18,
    },
  }
}

function createEdge(id: string, source: string, target: string): Edge<ResearchEdgeData> {
  return styleEdge(
    {
      id,
      source,
      target,
      type: 'smoothstep',
      data: { status: 'idle' },
    },
    'idle',
  )
}

const INITIAL_EDGES: Edge<ResearchEdgeData>[] = [
  createEdge('data-regime', 'data', 'regime'),
  createEdge('data-signal', 'data', 'signal'),
  createEdge('data-graph', 'data', 'graph'),
  createEdge('regime-risk', 'regime', 'risk'),
  createEdge('signal-risk', 'signal', 'risk'),
  createEdge('graph-risk', 'graph', 'risk'),
  createEdge('risk-orch', 'risk', 'orchestrator'),
  createEdge('orch-exec', 'orchestrator', 'execution'),
]

interface ResearchStore {
  nodes: Node<AgentNodeData>[]
  edges: Edge<ResearchEdgeData>[]
  messages: ChatMessage[]
  currentRun: string | null
  currentTicker: string | null
  currentReceipt: DecisionReceipt | null
  currentBrief: ResearchBrief | null
  /** Full Deep Research document (P4), captured on `report.done`. */
  currentReport: ResearchReport | null
  /** Live state of a multi-subagent deep run (P6), built from streamed events. */
  deepRun: DeepRunState
  mode: Mode
  isRunning: boolean
  receiptOpen: boolean
  /** Whether the Deep Research report drawer is open (P6). */
  reportOpen: boolean
  pendingApproval: PendingApproval | null
  pendingAssistantMessageId: string | null

  setMode: (mode: Mode) => void
  setReceiptOpen: (open: boolean) => void
  setReportOpen: (open: boolean) => void
  clearPendingApproval: () => void
  addUserMessage: (content: string) => void
  startAssistantDraft: (content?: string) => void
  applyEvent: (evt: RunEvent) => void
  resetRun: () => void
}

function cloneInitialNodes(): Node<AgentNodeData>[] {
  return INITIAL_NODES.map((node) => ({
    ...node,
    data: {
      ...node.data,
      state: 'idle',
      lastOutput: '',
      confidence: null,
      subTasks: node.data.subTasks.map((task) => ({ ...task, done: false })),
    },
  }))
}

function cloneInitialEdges(): Edge<ResearchEdgeData>[] {
  return INITIAL_EDGES.map((edge) => styleEdge(edge, 'idle'))
}

function patchNode(
  nodes: Node<AgentNodeData>[],
  agentId: AgentName,
  patch: Partial<AgentNodeData>,
): Node<AgentNodeData>[] {
  return nodes.map((node) =>
    node.id === agentId ? { ...node, data: { ...node.data, ...patch } } : node,
  )
}

function setEdgeStatus(
  edges: Edge<ResearchEdgeData>[],
  ids: string[],
  status: EdgeState,
): Edge<ResearchEdgeData>[] {
  return edges.map((edge) => (ids.includes(edge.id) ? styleEdge(edge, status) : edge))
}

function setAgentIncomingStatus(
  edges: Edge<ResearchEdgeData>[],
  agentId: AgentName,
  status: EdgeState,
): Edge<ResearchEdgeData>[] {
  return setEdgeStatus(edges, INCOMING_EDGE_IDS[agentId], status)
}

function setAgentOutgoingStatus(
  edges: Edge<ResearchEdgeData>[],
  agentId: AgentName,
  status: EdgeState,
): Edge<ResearchEdgeData>[] {
  return setEdgeStatus(edges, OUTGOING_EDGE_IDS[agentId], status)
}

function updateSignalTasks(
  nodes: Node<AgentNodeData>[],
  completedLabels: string[],
  lastOutput: string,
): Node<AgentNodeData>[] {
  return nodes.map((node) => {
    if (node.id !== 'signal') return node
    return {
      ...node,
      data: {
        ...node.data,
        state: 'thinking',
        lastOutput,
        subTasks: node.data.subTasks.map((task) => ({
          ...task,
          done: task.done || completedLabels.some((label) => label.toLowerCase() === task.label.toLowerCase()),
        })),
      },
    }
  })
}

function buildPendingAssistantMessage(content?: string): ChatMessage {
  return {
    id: `assistant_${Date.now()}`,
    role: 'assistant',
    content: content ?? 'Six ATS agents are gathering data, scoring the setup, and building the final brief.',
    ts: new Date().toISOString(),
    pending: true,
    brief: null,
  }
}

function buildFinalAssistantMessage(receipt: DecisionReceipt): ChatMessage {
  const brief = receipt.research_brief ?? null
  return {
    id: `assistant_${Date.now()}`,
    role: 'assistant',
    content: brief?.summary ?? `Research complete for ${receipt.ticker}.`,
    ts: new Date().toISOString(),
    pending: false,
    brief,
  }
}

function finalizeAssistantMessage(
  messages: ChatMessage[],
  pendingId: string | null,
  nextMessage: ChatMessage,
): ChatMessage[] {
  if (!pendingId) {
    return [...messages, nextMessage]
  }

  let replaced = false
  const nextMessages = messages.map((message) =>
    message.id === pendingId ? { ...nextMessage, id: message.id } : message,
  )
  replaced = nextMessages.some((message) => message.id === pendingId)
  return replaced ? nextMessages : [...messages, nextMessage]
}

export const useResearchStore = create<ResearchStore>((set) => ({
  nodes: cloneInitialNodes(),
  edges: cloneInitialEdges(),
  messages: [],
  currentRun: null,
  currentTicker: null,
  currentReceipt: null,
  currentBrief: null,
  currentReport: null,
  deepRun: initialDeepRun(),
  mode: 'solo',
  isRunning: false,
  receiptOpen: false,
  reportOpen: false,
  pendingApproval: null,
  pendingAssistantMessageId: null,

  setMode: (mode) => set({ mode }),
  setReceiptOpen: (open) => set({ receiptOpen: open }),
  setReportOpen: (open) => set({ reportOpen: open }),
  clearPendingApproval: () => set({ pendingApproval: null }),

  addUserMessage: (content) => {
    const message: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content,
      ts: new Date().toISOString(),
    }
    set((state) => ({ messages: [...state.messages, message] }))
  },

  startAssistantDraft: (content) =>
    set((state) => {
      const pending = buildPendingAssistantMessage(content)
      return {
        messages: [...state.messages, pending],
        pendingAssistantMessageId: pending.id,
      }
    }),

  resetRun: () =>
    set({
      nodes: cloneInitialNodes(),
      edges: cloneInitialEdges(),
      currentRun: null,
      currentTicker: null,
      currentReceipt: null,
      currentBrief: null,
      currentReport: null,
      deepRun: initialDeepRun(),
      isRunning: false,
      receiptOpen: false,
      reportOpen: false,
      pendingApproval: null,
      pendingAssistantMessageId: null,
    }),

  applyEvent: (evt) =>
    set((state) => {
      let nodes = state.nodes
      let edges = state.edges
      let isRunning = state.isRunning
      let currentRun = state.currentRun
      let currentTicker = state.currentTicker
      let currentReceipt = state.currentReceipt
      let currentBrief = state.currentBrief
      let currentReport = state.currentReport
      let deepRun = state.deepRun
      let receiptOpen = state.receiptOpen
      let reportOpen = state.reportOpen
      let pendingApproval = state.pendingApproval
      let pendingAssistantMessageId = state.pendingAssistantMessageId
      let messages = state.messages

      switch (evt.type) {
        case 'run.start': {
          const payloadTicker =
            typeof evt.payload?.ticker === 'string' ? evt.payload.ticker.toUpperCase() : null
          nodes = cloneInitialNodes()
          edges = cloneInitialEdges()
          isRunning = true
          currentRun = evt.run_id
          currentTicker = payloadTicker
          currentReceipt = null
          currentBrief = null
          currentReport = null
          receiptOpen = false
          reportOpen = false
          pendingApproval = null
          if (evt.payload?.deep === true) {
            deepRun = initialDeepRun()
            deepRun.active = true
            deepRun.phase = 'planning'
            deepRun.queryType =
              typeof evt.payload?.query_type === 'string' ? evt.payload.query_type : null
            deepRun = addActivity(deepRun, 'phase', evt.message ?? 'Starting deep research.')
          } else {
            deepRun = initialDeepRun()
          }
          break
        }

        case 'plan.created': {
          if (deepRun.active) {
            const goal =
              typeof evt.payload?.goal === 'string' ? evt.payload.goal : deepRun.goal
            const rawObjectives = Array.isArray(evt.payload?.objectives)
              ? (evt.payload!.objectives as unknown[])
              : []
            const objectives = rawObjectives
              .map((o) => {
                const obj = (o ?? {}) as Record<string, unknown>
                return {
                  agentId: typeof obj.agentId === 'string' ? obj.agentId : '',
                  objective: typeof obj.objective === 'string' ? obj.objective : '',
                }
              })
              .filter((o) => o.agentId)
            deepRun = { ...deepRun, goal, objectives, phase: 'researching' }
            for (const o of objectives) {
              deepRun = upsertSubagent(deepRun, o.agentId, { objective: o.objective })
            }
            deepRun = addActivity(
              deepRun,
              'plan',
              evt.message ?? `Plan ready — ${objectives.length} specialist(s).`,
            )
          }
          break
        }

        case 'subagent.spawned': {
          if (deepRun.active) {
            const id = typeof evt.payload?.agent === 'string' ? evt.payload.agent : ''
            if (id) {
              const patch: Partial<DeepSubagentState> = { status: 'working' }
              if (typeof evt.payload?.name === 'string') patch.name = evt.payload.name
              if (typeof evt.payload?.objective === 'string' && evt.payload.objective)
                patch.objective = evt.payload.objective
              if (Array.isArray(evt.payload?.tools)) patch.tools = asStringArray(evt.payload.tools)
              deepRun = upsertSubagent(deepRun, id, patch)
              deepRun = addActivity(deepRun, 'subagent', evt.message ?? `Spawned ${patch.name ?? id}.`, id)
            }
          }
          break
        }

        case 'subagent.progress': {
          if (deepRun.active) {
            const id = typeof evt.payload?.agent === 'string' ? evt.payload.agent : ''
            if (id) {
              if (evt.payload?.done === true) {
                const patch: Partial<DeepSubagentState> = {
                  status: 'done',
                  confidence:
                    typeof evt.payload?.confidence === 'number' ? evt.payload.confidence : null,
                  claims: typeof evt.payload?.claims === 'number' ? evt.payload.claims : 0,
                  lastMessage: evt.message ?? '',
                }
                if (typeof evt.payload?.evidence === 'number') patch.evidenceCount = evt.payload.evidence
                if (Array.isArray(evt.payload?.tools_used))
                  patch.tools = asStringArray(evt.payload.tools_used)
                deepRun = upsertSubagent(deepRun, id, patch)
                deepRun = addActivity(deepRun, 'subagent', evt.message ?? `${id} done.`, id)
              } else if (evt.payload?.error === true) {
                deepRun = upsertSubagent(deepRun, id, {
                  status: 'error',
                  lastMessage: evt.message ?? 'Reasoning step failed.',
                })
                deepRun = addActivity(deepRun, 'subagent', evt.message ?? `${id} error.`, id)
              } else {
                deepRun = upsertSubagent(deepRun, id, {
                  status: 'working',
                  lastMessage: evt.message ?? '',
                })
              }
            }
          }
          break
        }

        case 'tool.called': {
          if (deepRun.active) {
            const id = typeof evt.payload?.agent === 'string' ? evt.payload.agent : ''
            const tool = typeof evt.payload?.tool === 'string' ? evt.payload.tool : 'tool'
            if (id) {
              const sub = deepRun.subagents.find((s) => s.id === id)
              deepRun = upsertSubagent(deepRun, id, { toolCalls: (sub?.toolCalls ?? 0) + 1 })
            }
            deepRun = addActivity(deepRun, 'tool', evt.message ?? `Called ${tool}.`, id || undefined)
          }
          break
        }

        case 'evidence.found': {
          if (deepRun.active) {
            const id = typeof evt.payload?.agent === 'string' ? evt.payload.agent : ''
            if (id) {
              const sub = deepRun.subagents.find((s) => s.id === id)
              deepRun = upsertSubagent(deepRun, id, { evidenceCount: (sub?.evidenceCount ?? 0) + 1 })
            }
            deepRun = addActivity(deepRun, 'evidence', evt.message ?? 'Evidence found.', id || undefined)
          }
          break
        }

        case 'round.evaluated': {
          if (deepRun.active) {
            const round = typeof evt.payload?.round === 'number' ? evt.payload.round : deepRun.round
            deepRun = { ...deepRun, round, phase: 'evaluating' }
            deepRun = addActivity(deepRun, 'round', evt.message ?? `Round ${round} evaluated.`)
          }
          break
        }

        case 'synthesis.draft': {
          if (deepRun.active) {
            const confidence =
              typeof evt.payload?.confidence === 'number' ? evt.payload.confidence : deepRun.confidence
            const cv = evt.payload?.cross_verification as Record<string, unknown> | undefined
            const crossVerification: DeepCrossVerification | null = cv
              ? {
                  corroborated: typeof cv.corroborated === 'number' ? cv.corroborated : 0,
                  contradicted: typeof cv.contradicted === 'number' ? cv.contradicted : 0,
                  unverified: typeof cv.unverified === 'number' ? cv.unverified : 0,
                  summary: typeof cv.summary === 'string' ? cv.summary : '',
                }
              : deepRun.crossVerification
            deepRun = { ...deepRun, phase: 'synthesizing', confidence, crossVerification }
            deepRun = addActivity(deepRun, 'synthesis', evt.message ?? 'Composing the document…')
          }
          break
        }

        case 'citation.attached': {
          if (deepRun.active) {
            const citation: DeepCitationStats = {
              coverage: typeof evt.payload?.coverage === 'number' ? evt.payload.coverage : 0,
              citations: typeof evt.payload?.citations === 'number' ? evt.payload.citations : 0,
              unsupported: typeof evt.payload?.unsupported === 'number' ? evt.payload.unsupported : 0,
            }
            deepRun = { ...deepRun, phase: 'citing', citation }
            deepRun = addActivity(deepRun, 'citation', evt.message ?? 'Citations mapped.')
          }
          break
        }

        case 'report.done': {
          // Deep Research (P4/P6): capture the full cited + attested document.
          // The terminal run.done that follows finalizes the assistant bubble.
          const report = (evt.payload?.report as ResearchReport | undefined) ?? null
          if (report) {
            currentReport = report
            currentRun = evt.run_id
          }
          if (deepRun.active) {
            const att = evt.payload?.attestation as Record<string, unknown> | undefined
            const attestation: DeepAttestation | null = att
              ? {
                  proofRef: typeof att.proof_ref === 'string' ? att.proof_ref : '',
                  sealed: att.sealed === true,
                  source: typeof att.source === 'string' ? att.source : '',
                  note: typeof att.note === 'string' ? att.note : '',
                }
              : deepRun.attestation
            deepRun = { ...deepRun, attestation }
            deepRun = addActivity(
              deepRun,
              'report',
              attestation?.sealed ? 'Report sealed on 0G Compute.' : 'Research document ready.',
            )
          }
          break
        }

        case 'run.done':
          isRunning = false
          pendingApproval = null
          currentRun = evt.run_id
          if (deepRun.active && deepRun.phase !== 'error') {
            deepRun = addActivity({ ...deepRun, phase: 'done' }, 'phase', 'Deep research complete.')
          }
          currentReceipt = evt.receipt ?? state.currentReceipt
          currentBrief = evt.receipt?.research_brief ?? null
          currentTicker = evt.receipt?.ticker ?? state.currentTicker
          receiptOpen = false
          if (evt.receipt) {
            messages = finalizeAssistantMessage(
              messages,
              pendingAssistantMessageId,
              buildFinalAssistantMessage(evt.receipt),
            )
            pendingAssistantMessageId = null
          } else if (pendingAssistantMessageId) {
            // Receipt-less completion (e.g. the Deep Research stub for non-ATS
            // query types) — resolve the pending bubble with the run message so
            // the UI doesn't spin forever.
            messages = finalizeAssistantMessage(messages, pendingAssistantMessageId, {
              id: `assistant_${Date.now()}`,
              role: 'assistant',
              content: evt.message ?? 'Research complete.',
              ts: evt.ts,
              pending: false,
              brief: null,
            })
            pendingAssistantMessageId = null
          }
          nodes = patchNode(nodes, 'orchestrator', {
            state: 'done',
            lastOutput: evt.message ?? 'Research brief ready',
            confidence: evt.receipt?.consensus.confidence ?? nodes.find((node) => node.id === 'orchestrator')?.data.confidence ?? null,
          })
          edges = setAgentIncomingStatus(edges, 'orchestrator', 'complete')
          break

        case 'run.error':
          isRunning = false
          pendingApproval = null
          if (deepRun.active) {
            deepRun = addActivity(
              { ...deepRun, phase: 'error' },
              'phase',
              evt.message ?? 'Deep research failed.',
            )
          }
          messages = finalizeAssistantMessage(messages, pendingAssistantMessageId, {
            id: `error_${Date.now()}`,
            role: 'error',
            content: evt.message ?? 'Research failed.',
            ts: evt.ts,
            pending: false,
            brief: null,
          })
          pendingAssistantMessageId = null
          break

        case 'agent.thinking':
          if (evt.agent) {
            nodes = patchNode(nodes, evt.agent, {
              state: 'thinking',
              lastOutput: evt.message ?? '',
            })
            if (evt.agent === 'data') {
              edges = setAgentOutgoingStatus(edges, 'data', 'active')
            } else {
              edges = setAgentIncomingStatus(edges, evt.agent, 'active')
            }
          }
          break

        case 'agent.done': {
          if (evt.agent) {
            const confidence =
              typeof evt.payload?.confidence === 'number' ? evt.payload.confidence : null
            nodes = patchNode(nodes, evt.agent, {
              state: 'done',
              lastOutput: evt.message ?? '',
              confidence,
            })
            edges = setAgentIncomingStatus(edges, evt.agent, 'complete')
            if (evt.agent === 'data' || evt.agent === 'regime' || evt.agent === 'signal' || evt.agent === 'graph') {
              edges = setAgentOutgoingStatus(edges, evt.agent, 'complete')
            }
          }
          break
        }

        case 'agent.vetoed':
          if (evt.agent) {
            nodes = patchNode(nodes, evt.agent, {
              state: 'vetoed',
              lastOutput: evt.message ?? 'Blocked by risk controls',
            })
            edges = setAgentIncomingStatus(edges, evt.agent, 'veto')
            edges = setAgentOutgoingStatus(edges, evt.agent, 'veto')
          }
          break

        case 'agent.data':
          nodes = patchNode(nodes, 'data', {
            state: 'done',
            lastOutput: evt.message ?? 'Fresh market packet ready',
          })
          edges = setAgentOutgoingStatus(edges, 'data', 'complete')
          break

        case 'regime.classified': {
          const confidence =
            typeof evt.payload?.confidence === 'number' ? evt.payload.confidence : null
          nodes = patchNode(nodes, 'regime', {
            state: 'done',
            lastOutput: evt.message ?? '',
            confidence,
          })
          edges = setAgentIncomingStatus(edges, 'regime', 'complete')
          edges = setAgentOutgoingStatus(edges, 'regime', 'complete')
          break
        }

        case 'signal.update': {
          const submodule = typeof evt.payload?.submodule === 'string' ? evt.payload.submodule : ''
          const completed =
            submodule === 'technical'
              ? ['Technical']
              : submodule === 'llm'
                ? ['Sentiment', 'Causal', 'Institutional']
                : []
          nodes = updateSignalTasks(nodes, completed, evt.message ?? '')
          edges = setAgentIncomingStatus(edges, 'signal', 'active')
          break
        }

        case 'graph.update':
          nodes = patchNode(nodes, 'graph', {
            state: 'thinking',
            lastOutput: evt.message ?? '',
          })
          edges = setAgentIncomingStatus(edges, 'graph', 'active')
          break

        case 'risk.sizing': {
          const vetoTriggered = evt.payload?.veto_triggered === true
          nodes = patchNode(nodes, 'risk', {
            state: vetoTriggered ? 'vetoed' : 'thinking',
            lastOutput: evt.message ?? '',
          })
          edges = setAgentIncomingStatus(edges, 'risk', vetoTriggered ? 'veto' : 'complete')
          edges = setAgentOutgoingStatus(edges, 'risk', vetoTriggered ? 'veto' : 'active')
          break
        }

        case 'consensus.reached': {
          const confidence =
            typeof evt.payload?.confidence === 'number' ? evt.payload.confidence : null
          nodes = patchNode(nodes, 'orchestrator', {
            state: 'thinking',
            lastOutput: evt.message ?? '',
            confidence,
          })
          edges = setAgentIncomingStatus(edges, 'orchestrator', 'active')
          break
        }

        case 'execution.pending': {
          const decision = evt.payload?.decision
          const sizeUsd =
            typeof evt.payload?.size_usd === 'number' ? evt.payload.size_usd : 0
          if (evt.payload?.awaiting_approval === true && (decision === 'BUY' || decision === 'SELL')) {
            pendingApproval = {
              run_id: evt.run_id,
              decision,
              size_usd: sizeUsd,
            }
          }

          nodes = patchNode(nodes, 'execution', {
            state: 'thinking',
            lastOutput: evt.message ?? '',
          })
          edges = setAgentIncomingStatus(edges, 'execution', 'active')
          break
        }

        case 'execution.done': {
          const status = typeof evt.payload?.status === 'string' ? evt.payload.status : null
          const blocked = status === 'failed' || status === 'pending_deployment'
          pendingApproval = null
          nodes = patchNode(nodes, 'execution', {
            state: blocked ? 'vetoed' : 'done',
            lastOutput: evt.message ?? '',
          })
          edges = setAgentIncomingStatus(edges, 'execution', blocked ? 'veto' : 'complete')
          break
        }
      }

      return {
        nodes,
        edges,
        messages,
        currentRun,
        currentTicker,
        currentReceipt,
        currentBrief,
        currentReport,
        deepRun,
        isRunning,
        receiptOpen,
        reportOpen,
        pendingApproval,
        pendingAssistantMessageId,
      }
    }),
}))
