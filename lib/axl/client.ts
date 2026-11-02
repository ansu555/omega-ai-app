/**
 * AXL HTTP client
 *
 * Thin wrapper over the local AXL node's HTTP bridge. Used by the orchestrator
 * to invoke remote agent services across the encrypted mesh.
 *
 * Reference: https://docs.gensyn.ai/tech/agent-exchange-layer/examples-and-building
 *   POST /mcp/{peer_id}/{service}   — JSON-RPC body, response on the same call
 *   GET  /topology                  — local node identity + spanning tree
 */
import { getAxlConfig, getPeerForRole, type AxlConfig } from '@/lib/axl/config'
import {
  AXL_TOOL_NAMES,
  type AgentInvokeResponse,
  type AxlAgentRole,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type ToolCallParams,
  type ToolCallResult,
} from '@/lib/axl/types'

export interface AxlTopology {
  our_public_key: string
  our_ipv6: string
  /** Other fields are present but not used by OmeSwap */
  [key: string]: unknown
}

/** GET /topology — verify the local AXL node is reachable */
export async function getTopology(cfg: AxlConfig = getAxlConfig()): Promise<AxlTopology> {
  const res = await fetch(`${cfg.apiUrl}/topology`, { method: 'GET' })
  if (!res.ok) {
    throw new Error(`AXL /topology failed (${res.status}): ${await res.text()}`)
  }
  return (await res.json()) as AxlTopology
}

/** Quick liveness check; never throws. */
export async function isAxlReachable(cfg: AxlConfig = getAxlConfig()): Promise<boolean> {
  try {
    await getTopology(cfg)
    return true
  } catch {
    return false
  }
}

let nextRequestId = 1
function makeRequestId(): number {
  const id = nextRequestId
  nextRequestId = id >= Number.MAX_SAFE_INTEGER - 1 ? 1 : id + 1
  return id
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(t)
  }
}

/**
 * Low-level JSON-RPC call to a peer's MCP service.
 *
 * Endpoint: `POST {apiUrl}/mcp/{peerId}/{serviceName}`
 *
 * Returns the parsed JSON-RPC response so callers can inspect either
 * `result` or `error` directly.
 */
export async function callMcpService<R = unknown, P = unknown>(
  peerId: string,
  serviceName: string,
  request: Omit<JsonRpcRequest<P>, 'jsonrpc' | 'id'> & { id?: JsonRpcRequest['id'] },
  cfg: AxlConfig = getAxlConfig(),
): Promise<JsonRpcResponse<R>> {
  const body: JsonRpcRequest<P> = {
    jsonrpc: '2.0',
    id: request.id ?? makeRequestId(),
    method: request.method,
    params: request.params,
  }

  const url = `${cfg.apiUrl}/mcp/${peerId}/${serviceName}`
  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    cfg.timeoutMs,
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AXL MCP call ${res.status} ${url}: ${text}`)
  }

  return (await res.json()) as JsonRpcResponse<R>
}

/**
 * Invoke a remote agent role on its configured peer and return the parsed
 * `AgentInvokeResponse<R>` envelope.
 *
 * The remote service must implement MCP `tools/call` and return the OmeSwap
 * envelope JSON-stringified inside `result.content[0].text`.
 */
export async function invokeRemoteAgent<R = unknown, A = unknown>(
  role: AxlAgentRole,
  args: A,
  cfg: AxlConfig = getAxlConfig(),
): Promise<AgentInvokeResponse<R>> {
  const peerId = getPeerForRole(role, cfg)
  if (!peerId) {
    return {
      ok: false,
      role,
      events: [],
      error: `No AXL peer configured for role "${role}". Set AXL_PEER_${role.toUpperCase()} or AXL_PEER_ID.`,
    }
  }

  const params: ToolCallParams<A> = {
    name: AXL_TOOL_NAMES[role],
    arguments: args,
  }

  let rpc: JsonRpcResponse<ToolCallResult>
  try {
    rpc = await callMcpService<ToolCallResult, ToolCallParams<A>>(
      peerId,
      cfg.serviceName,
      { method: 'tools/call', params },
      cfg,
    )
  } catch (e) {
    return {
      ok: false,
      role,
      peer_id: peerId,
      events: [],
      error: e instanceof Error ? e.message : String(e),
    }
  }

  if (rpc.error) {
    return {
      ok: false,
      role,
      peer_id: peerId,
      events: [],
      error: `Remote MCP error ${rpc.error.code}: ${rpc.error.message}`,
    }
  }

  const text = rpc.result?.content?.[0]?.text
  if (typeof text !== 'string') {
    return {
      ok: false,
      role,
      peer_id: peerId,
      events: [],
      error: 'Remote MCP response missing content[0].text',
    }
  }

  let envelope: AgentInvokeResponse<R>
  try {
    envelope = JSON.parse(text) as AgentInvokeResponse<R>
  } catch (e) {
    return {
      ok: false,
      role,
      peer_id: peerId,
      events: [],
      error: `Failed to parse remote envelope: ${e instanceof Error ? e.message : String(e)}`,
    }
  }

  return {
    ...envelope,
    role,
    peer_id: envelope.peer_id ?? peerId,
  }
}
