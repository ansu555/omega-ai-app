/**
 * AXL transport types
 *
 * AXL (Agent eXchange Layer) is Gensyn's peer-to-peer network node. Each AXL
 * node exposes an HTTP bridge on `localhost:9002` (default) and routes traffic
 * across the encrypted Yggdrasil mesh.
 *
 * For OmeSwap we use the structured MCP path (`/mcp/{peer_id}/{service}`) so
 * remote agents can be invoked using JSON-RPC `tools/call`. The envelope below
 * is what flows between the orchestrator and the remote MCP service handler.
 */
import type { RunEvent } from '@/lib/ats/types'

/** AXL transport mode chosen per-run by the orchestrator */
export type AxlTransport = 'local' | 'axl' | 'auto'

/** Logical role exposed by a peer agent service */
export type AxlAgentRole = 'regime' | 'signal' | 'graph' | 'risk'

/** AXL peer service tools (one tool per role on each peer) */
export const AXL_TOOL_NAMES = {
  regime: 'run_regime_agent',
  signal: 'run_signal_agent',
  graph:  'run_graph_agent',
  risk:   'run_risk_agent',
} as const satisfies Record<AxlAgentRole, string>

/** JSON-RPC 2.0 id (null is allowed for unparseable requests per spec) */
export type JsonRpcId = number | string | null

/** JSON-RPC 2.0 request used by AXL MCP routing */
export interface JsonRpcRequest<T = unknown> {
  jsonrpc: '2.0'
  id: JsonRpcId
  method: string
  params?: T
}

/** JSON-RPC 2.0 response used by AXL MCP routing */
export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0'
  id: JsonRpcId
  result?: T
  error?: { code: number; message: string; data?: unknown }
}

/** Standard MCP `tools/call` parameters */
export interface ToolCallParams<A = Record<string, unknown>> {
  name: string
  arguments: A
}

/** Standard MCP `tools/call` result */
export interface ToolCallResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

/**
 * Envelope returned by every OmeSwap AXL agent service. The MCP `tools/call`
 * result wraps this object as a JSON-stringified text content block.
 */
export interface AgentInvokeResponse<R = unknown> {
  /** True when the remote agent completed without throwing */
  ok: boolean
  /** Agent role that produced the result */
  role: AxlAgentRole
  /** Public key of the peer that handled the call */
  peer_id?: string
  /** Wall-clock ms the remote agent spent producing the result */
  elapsed_ms?: number
  /** RunEvents emitted by the remote agent (re-emitted by the orchestrator) */
  events: RunEvent[]
  /** Strongly typed agent result (regime/signal/graph/risk) */
  result?: R
  /** Populated when ok=false */
  error?: string
}
