/**
 * AXL configuration
 *
 * Reads peer + service mappings from env vars so the orchestrator can route
 * each agent role to an AXL peer. All values default to a local single-machine
 * two-node setup, matching `doc/axl.md`.
 *
 * Env vars (all optional except in `axl` transport mode):
 *
 *   ATS_AGENT_TRANSPORT       local | axl | auto    (default: local)
 *   AXL_API_URL               http://127.0.0.1:9002 (orchestrator-side AXL HTTP bridge)
 *   AXL_MCP_ROUTER_URL        http://127.0.0.1:9013 (peer-side MCP router for service registration)
 *   AXL_PEER_ID               default peer public key for all roles
 *   AXL_PEER_REGIME           per-role peer override
 *   AXL_PEER_SIGNAL           per-role peer override
 *   AXL_PEER_GRAPH            per-role peer override
 *   AXL_PEER_RISK             per-role peer override
 *   AXL_SERVICE_NAME          MCP service name on the peer (default: ats-agents)
 *   AXL_REQUEST_TIMEOUT_MS    per-call timeout in ms (default: 60000)
 */
import type { AxlAgentRole, AxlTransport } from '@/lib/axl/types'

const DEFAULT_AXL_API_URL        = 'http://127.0.0.1:9002'
const DEFAULT_AXL_MCP_ROUTER_URL = 'http://127.0.0.1:9013'
const DEFAULT_SERVICE_NAME       = 'ats-agents'
const DEFAULT_TIMEOUT_MS         = 60_000

export interface AxlConfig {
  /** AXL HTTP bridge for the orchestrator's local node */
  apiUrl: string
  /** MCP router URL on the peer side (used by `scripts/axl-agent-service.ts`) */
  mcpRouterUrl: string
  /** Default peer public key when a role-specific override is not set */
  defaultPeerId: string | null
  /** Per-role peer overrides */
  peerByRole: Record<AxlAgentRole, string | null>
  /** Service name registered with the MCP router on each peer */
  serviceName: string
  /** Per-call HTTP timeout */
  timeoutMs: number
}

function readEnv(name: string): string | null {
  const raw = process.env[name]
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readNumber(name: string, fallback: number): number {
  const raw = readEnv(name)
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Reads the configured ATS transport, defaulting to `local`. */
export function getAtsTransport(): AxlTransport {
  const raw = readEnv('ATS_AGENT_TRANSPORT')?.toLowerCase()
  if (raw === 'axl' || raw === 'local' || raw === 'auto') return raw
  return 'local'
}

/** Reads the AXL HTTP bridge / MCP router / peer mapping from env. */
export function getAxlConfig(): AxlConfig {
  const defaultPeerId = readEnv('AXL_PEER_ID')

  return {
    apiUrl:       readEnv('AXL_API_URL')        ?? DEFAULT_AXL_API_URL,
    mcpRouterUrl: readEnv('AXL_MCP_ROUTER_URL') ?? DEFAULT_AXL_MCP_ROUTER_URL,
    defaultPeerId,
    peerByRole: {
      regime: readEnv('AXL_PEER_REGIME') ?? defaultPeerId,
      signal: readEnv('AXL_PEER_SIGNAL') ?? defaultPeerId,
      graph:  readEnv('AXL_PEER_GRAPH')  ?? defaultPeerId,
      risk:   readEnv('AXL_PEER_RISK')   ?? defaultPeerId,
    },
    serviceName: readEnv('AXL_SERVICE_NAME')   ?? DEFAULT_SERVICE_NAME,
    timeoutMs:   readNumber('AXL_REQUEST_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
  }
}

/**
 * Resolve the peer public key for a given role, falling back to the default.
 * Returns null when no peer key has been configured for the role.
 */
export function getPeerForRole(role: AxlAgentRole, cfg = getAxlConfig()): string | null {
  return cfg.peerByRole[role] ?? cfg.defaultPeerId ?? null
}
