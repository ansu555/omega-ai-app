/**
 * AXL Agent Service
 *
 * Hosts the OmeSwap ATS Regime / Signal / Graph / Risk agents as a local MCP
 * service that an AXL node can dispatch to. Run one instance per peer node
 * (typically Node B in the demo). The script:
 *
 *   1. Starts an HTTP server on `--port` (default 7100) implementing the
 *      MCP `tools/list` + `tools/call` JSON-RPC methods.
 *   2. Registers itself with the AXL MCP router at `--router`
 *      (default http://127.0.0.1:9013) under `--service` (default `ats-agents`).
 *   3. Calls the existing in-process agent functions and returns the
 *      `AgentInvokeResponse` envelope expected by `lib/ats/remote-agents.ts`.
 *   4. Deregisters cleanly on SIGINT / SIGTERM.
 *
 * Usage:
 *   bun run scripts/axl-agent-service.ts \
 *     --port 7100 \
 *     --router http://127.0.0.1:9013 \
 *     --service ats-agents \
 *     --roles regime,signal,graph,risk
 *
 * Env (optional):
 *   AXL_PEER_LABEL  — human label included in responses for debugging
 *   AXL_PUBLIC_KEY  — peer public key included in responses for debugging
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

import type { RunEvent } from '@/lib/ats/types'
import { runRegimeAgent } from '@/lib/ats/agents/regime-agent'
import { runSignalAgent } from '@/lib/ats/agents/signal-agent'
import { runGraphAgent } from '@/lib/ats/agents/graph-agent'
import { runRiskAgent } from '@/lib/ats/agents/risk-agent'
import {
  AXL_TOOL_NAMES,
  type AgentInvokeResponse,
  type AxlAgentRole,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type ToolCallParams,
  type ToolCallResult,
} from '@/lib/axl/types'
import type {
  RegimeRemoteArgs,
  SignalRemoteArgs,
  GraphRemoteArgs,
  RiskRemoteArgs,
} from '@/lib/ats/remote-agents'

// ── CLI parsing ──────────────────────────────────────────────────────────────

interface CliArgs {
  port: number
  routerUrl: string
  serviceName: string
  roles: AxlAgentRole[]
}

const ALL_ROLES: AxlAgentRole[] = ['regime', 'signal', 'graph', 'risk']

function parseArgs(argv: string[]): CliArgs {
  let port = 7100
  let routerUrl = process.env.AXL_MCP_ROUTER_URL ?? 'http://127.0.0.1:9013'
  let serviceName = process.env.AXL_SERVICE_NAME ?? 'ats-agents'
  let roles: AxlAgentRole[] = [...ALL_ROLES]

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]
    switch (arg) {
      case '--port':
        port = parseInt(next, 10)
        i++
        break
      case '--router':
        routerUrl = next
        i++
        break
      case '--service':
        serviceName = next
        i++
        break
      case '--roles':
        roles = next
          .split(',')
          .map((r) => r.trim().toLowerCase())
          .filter((r): r is AxlAgentRole => ALL_ROLES.includes(r as AxlAgentRole))
        i++
        break
      case '--help':
      case '-h':
        printHelp()
        process.exit(0)
      default:
        if (arg.startsWith('--')) {
          console.warn(`[axl-agent-service] Unknown flag: ${arg}`)
        }
    }
  }

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid --port value`)
  }
  if (roles.length === 0) {
    throw new Error(`At least one role must be enabled (--roles regime,signal,graph,risk)`)
  }
  return { port, routerUrl, serviceName, roles }
}

function printHelp(): void {
  console.log(`Usage: bun run scripts/axl-agent-service.ts [options]

Options:
  --port <n>         HTTP port for this MCP service (default: 7100)
  --router <url>     AXL MCP router URL (default: http://127.0.0.1:9013)
  --service <name>   Service name to register (default: ats-agents)
  --roles <list>     Comma-separated agent roles to enable
                     (default: regime,signal,graph,risk)
  -h, --help         Show this help and exit
`)
}

// ── MCP tool descriptors ─────────────────────────────────────────────────────

interface ToolDescriptor {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

function buildToolDescriptors(roles: AxlAgentRole[]): ToolDescriptor[] {
  const all: Record<AxlAgentRole, ToolDescriptor> = {
    regime: {
      name: AXL_TOOL_NAMES.regime,
      description:
        'Classify the market regime for a ticker using a rules + LLM classifier. ' +
        'Arguments: { data: DataBundle, news: NewsBundle, userWallet?: string, run_id: string }',
      inputSchema: { type: 'object', required: ['data', 'news', 'run_id'] },
    },
    signal: {
      name: AXL_TOOL_NAMES.signal,
      description:
        'Run technical / sentiment / causal / institutional signal sub-modules. ' +
        'Arguments: { data, news, regime, userWallet?, run_id }',
      inputSchema: { type: 'object', required: ['data', 'news', 'regime', 'run_id'] },
    },
    graph: {
      name: AXL_TOOL_NAMES.graph,
      description:
        'Compute cross-asset correlation graph implications. ' +
        'Arguments: { data, regime, userWallet?, run_id }',
      inputSchema: { type: 'object', required: ['data', 'regime', 'run_id'] },
    },
    risk: {
      name: AXL_TOOL_NAMES.risk,
      description:
        'Apply Kelly sizing and hard veto rules to a vote bundle. ' +
        'Arguments: { data, votes, technical, agentBalanceUSD?, run_id }',
      inputSchema: { type: 'object', required: ['data', 'votes', 'technical', 'run_id'] },
    },
  }
  return roles.map((r) => all[r])
}

// ── Tool dispatch ────────────────────────────────────────────────────────────

const PEER_LABEL     = process.env.AXL_PEER_LABEL ?? 'axl-agent-service'
const PEER_PUBLIC_ID = process.env.AXL_PUBLIC_KEY ?? null

async function dispatchTool(
  name: string,
  args: unknown,
): Promise<AgentInvokeResponse<unknown>> {
  const start = Date.now()
  const events: RunEvent[] = []
  const collect = (evt: RunEvent) => {
    events.push(evt)
  }

  try {
    switch (name) {
      case AXL_TOOL_NAMES.regime: {
        const a = args as RegimeRemoteArgs
        const result = await runRegimeAgent(a.data, a.news, a.userWallet, collect, a.run_id)
        return finish('regime', result, events, start)
      }
      case AXL_TOOL_NAMES.signal: {
        const a = args as SignalRemoteArgs
        const result = await runSignalAgent(a.data, a.news, a.regime, a.userWallet, collect, a.run_id)
        return finish('signal', result, events, start)
      }
      case AXL_TOOL_NAMES.graph: {
        const a = args as GraphRemoteArgs
        const result = await runGraphAgent(a.data, a.regime, a.userWallet, collect, a.run_id)
        return finish('graph', result, events, start)
      }
      case AXL_TOOL_NAMES.risk: {
        const a = args as RiskRemoteArgs
        const result = await runRiskAgent(
          a.data,
          a.votes,
          a.technical,
          a.agentBalanceUSD,
          collect,
          a.run_id,
        )
        return finish('risk', result, events, start)
      }
      default:
        return {
          ok: false,
          role: 'regime',
          peer_id: PEER_PUBLIC_ID ?? undefined,
          events,
          elapsed_ms: Date.now() - start,
          error: `Unknown tool name: ${name}`,
        }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      role: roleFromTool(name),
      peer_id: PEER_PUBLIC_ID ?? undefined,
      events,
      elapsed_ms: Date.now() - start,
      error: msg,
    }
  }
}

function roleFromTool(name: string): AxlAgentRole {
  for (const role of ALL_ROLES) {
    if (AXL_TOOL_NAMES[role] === name) return role
  }
  return 'regime'
}

function finish<R>(
  role: AxlAgentRole,
  result: R,
  events: RunEvent[],
  start: number,
): AgentInvokeResponse<R> {
  return {
    ok: true,
    role,
    peer_id: PEER_PUBLIC_ID ?? undefined,
    events,
    elapsed_ms: Date.now() - start,
    result,
  }
}

// ── HTTP handler ─────────────────────────────────────────────────────────────

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer))
  }
  return Buffer.concat(chunks).toString('utf-8')
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload).toString(),
  })
  res.end(payload)
}

function makeHandler(toolDescriptors: ToolDescriptor[]) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'GET' && req.url === '/health') {
      writeJson(res, 200, { ok: true, peer: PEER_LABEL })
      return
    }

    if (req.method !== 'POST') {
      writeJson(res, 405, { error: 'Method not allowed' })
      return
    }

    let body: string
    try {
      body = await readBody(req)
    } catch (e) {
      writeJson(res, 400, { error: e instanceof Error ? e.message : 'invalid body' })
      return
    }

    let rpc: JsonRpcRequest<unknown>
    try {
      rpc = JSON.parse(body) as JsonRpcRequest<unknown>
    } catch {
      writeJson(res, 400, {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      } satisfies JsonRpcResponse)
      return
    }

    if (rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
      writeJson(res, 400, {
        jsonrpc: '2.0',
        id: rpc.id ?? null,
        error: { code: -32600, message: 'Invalid Request' },
      } satisfies JsonRpcResponse)
      return
    }

    if (rpc.method === 'tools/list') {
      writeJson(res, 200, {
        jsonrpc: '2.0',
        id: rpc.id,
        result: { tools: toolDescriptors },
      } satisfies JsonRpcResponse)
      return
    }

    if (rpc.method === 'tools/call') {
      const params = rpc.params as ToolCallParams | undefined
      if (!params || typeof params.name !== 'string') {
        writeJson(res, 400, {
          jsonrpc: '2.0',
          id: rpc.id,
          error: { code: -32602, message: 'Invalid params: missing tool name' },
        } satisfies JsonRpcResponse)
        return
      }

      const envelope = await dispatchTool(params.name, params.arguments ?? {})
      const toolResult: ToolCallResult = {
        content: [{ type: 'text', text: JSON.stringify(envelope) }],
        isError: !envelope.ok,
      }
      writeJson(res, 200, {
        jsonrpc: '2.0',
        id: rpc.id,
        result: toolResult,
      } satisfies JsonRpcResponse)
      return
    }

    writeJson(res, 400, {
      jsonrpc: '2.0',
      id: rpc.id,
      error: { code: -32601, message: `Method not found: ${rpc.method}` },
    } satisfies JsonRpcResponse)
  }
}

// ── MCP router registration ──────────────────────────────────────────────────

async function registerWithRouter(
  routerUrl: string,
  serviceName: string,
  endpoint: string,
): Promise<void> {
  const url = `${routerUrl.replace(/\/$/, '')}/register`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service: serviceName, endpoint }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Registration with MCP router failed (${res.status}): ${text}`)
  }
}

async function deregisterFromRouter(routerUrl: string, serviceName: string): Promise<void> {
  const url = `${routerUrl.replace(/\/$/, '')}/register/${encodeURIComponent(serviceName)}`
  try {
    await fetch(url, { method: 'DELETE' })
  } catch {
    // Best-effort during shutdown
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv)
  const toolDescriptors = buildToolDescriptors(args.roles)
  const handler = makeHandler(toolDescriptors)

  const server = createServer((req, res) => {
    handler(req, res).catch((e) => {
      console.error('[axl-agent-service] Handler error:', e)
      try {
        writeJson(res, 500, { error: e instanceof Error ? e.message : String(e) })
      } catch {
        // socket may already be closed
      }
    })
  })

  await new Promise<void>((resolve) => server.listen(args.port, '127.0.0.1', resolve))

  const endpoint = `http://127.0.0.1:${args.port}`
  console.log(`[axl-agent-service] Listening on ${endpoint}`)
  console.log(`[axl-agent-service] Roles: ${args.roles.join(', ')}`)
  console.log(`[axl-agent-service] Tools: ${toolDescriptors.map((t) => t.name).join(', ')}`)

  try {
    await registerWithRouter(args.routerUrl, args.serviceName, endpoint)
    console.log(`[axl-agent-service] Registered "${args.serviceName}" with ${args.routerUrl}`)
  } catch (e) {
    console.warn(
      `[axl-agent-service] Could not register with router (${args.routerUrl}). ` +
        `Service is still callable directly at ${endpoint}.`,
    )
    console.warn(`  ↪ ${e instanceof Error ? e.message : String(e)}`)
  }

  const shutdown = async (signal: string) => {
    console.log(`\n[axl-agent-service] Received ${signal}, shutting down…`)
    await deregisterFromRouter(args.routerUrl, args.serviceName)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2000).unref()
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((err) => {
  console.error('[axl-agent-service] Fatal:', err)
  process.exit(1)
})
