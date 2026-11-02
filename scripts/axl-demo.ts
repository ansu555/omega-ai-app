/**
 * AXL Demo
 *
 * End-to-end smoke test for the AXL-backed ATS swarm. Verifies both AXL nodes,
 * confirms the peer MCP service is registered, then runs one ATS decision
 * with `transport: 'axl'` and prints the SSE events as they arrive.
 *
 * Usage:
 *   bun run scripts/axl-demo.ts                # uses AXL_PEER_ID from env
 *   bun run scripts/axl-demo.ts BTC            # override ticker
 *   bun run scripts/axl-demo.ts BTC autonomous # ticker + mode
 *
 * Required env (any one is enough to demonstrate AXL routing):
 *   AXL_API_URL              http://127.0.0.1:9002 (default)
 *   AXL_PEER_ID              64-hex public key of the peer running ats-agents
 *   AXL_MCP_ROUTER_URL       http://127.0.0.1:9013 (default; peer-side)
 *
 * Optional:
 *   AXL_PEER_API_URL         http://127.0.0.1:9012 (Node B HTTP bridge for the
 *                            local-pair demo; used only for the topology dump)
 *   OPENROUTER_API_KEY       LLM access for regime/signal/graph agents
 */
import {
  getAtsTransport,
  getAxlConfig,
  getTopology,
  isAxlReachable,
} from '@/lib/axl'
import { runOrchestrator } from '@/lib/ats/orchestrator'
import type { Mode, RunEvent } from '@/lib/ats/types'
import { getDefaultChainId } from '@/lib/chain-registry'

type CliArgs = { ticker: string; mode: Mode }

function parseCliArgs(argv: string[]): CliArgs {
  const ticker = (argv[2] ?? 'BTC').toUpperCase()
  const modeArg = (argv[3] ?? 'solo').toLowerCase()
  const mode: Mode =
    modeArg === 'autonomous' || modeArg === 'assisted' || modeArg === 'solo'
      ? modeArg
      : 'solo'
  return { ticker, mode }
}

function fmtKey(key: string | undefined): string {
  if (!key) return '(unknown)'
  return `${key.slice(0, 8)}…${key.slice(-6)}`
}

function color(s: string, code: string): string {
  if (process.env.NO_COLOR) return s
  return `\u001b[${code}m${s}\u001b[0m`
}
const cyan   = (s: string) => color(s, '36')
const green  = (s: string) => color(s, '32')
const yellow = (s: string) => color(s, '33')
const red    = (s: string) => color(s, '31')
const dim    = (s: string) => color(s, '2')

async function checkRouter(routerUrl: string, serviceName: string): Promise<void> {
  const url = `${routerUrl.replace(/\/$/, '')}/services`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(yellow(`! MCP router ${url} returned ${res.status}`))
      return
    }
    const body = (await res.json()) as { services?: unknown[] }
    const services = Array.isArray(body.services) ? body.services : (body as unknown as unknown[])
    console.log(green(`✓ MCP router reachable at ${routerUrl}`))
    console.log(dim(`  registered services: ${JSON.stringify(services)}`))
    const registered = JSON.stringify(services).includes(serviceName)
    if (!registered) {
      console.warn(
        yellow(
          `! service "${serviceName}" not visible on router. ` +
            `Start the agent service: bun run axl:agent`,
        ),
      )
    }
  } catch (e) {
    console.warn(yellow(`! Could not reach MCP router at ${url}: ${e instanceof Error ? e.message : e}`))
    console.warn(dim(`  This is OK if the router runs on a different machine than this script.`))
  }
}

async function main(): Promise<void> {
  const { ticker, mode } = parseCliArgs(process.argv)
  const cfg = getAxlConfig()
  const transport = getAtsTransport()

  console.log(cyan('━━━ AXL ATS Swarm Demo ━━━'))
  console.log(`Ticker:           ${ticker}`)
  console.log(`Mode:             ${mode}`)
  console.log(`Transport (env):  ${transport}`)
  console.log(`AXL API URL:      ${cfg.apiUrl}`)
  console.log(`MCP router URL:   ${cfg.mcpRouterUrl}`)
  console.log(`Service name:     ${cfg.serviceName}`)
  console.log(`Default peer:     ${fmtKey(cfg.defaultPeerId ?? undefined)}`)
  console.log(`Per-role peers:   ` +
    Object.entries(cfg.peerByRole)
      .map(([role, key]) => `${role}=${fmtKey(key ?? undefined)}`)
      .join(' '))
  console.log()

  // ── 1. Verify Node A (orchestrator-side AXL bridge) ──────────────────────
  if (!(await isAxlReachable(cfg))) {
    console.error(red(`✗ Local AXL node unreachable at ${cfg.apiUrl}`))
    console.error(`  Start it with: ./node -config node-config.json`)
    process.exit(1)
  }
  const nodeA = await getTopology(cfg)
  console.log(green(`✓ Node A (local) reachable`))
  console.log(`  public key: ${nodeA.our_public_key}`)
  console.log(`  ipv6:       ${nodeA.our_ipv6}`)
  console.log()

  // ── 2. Verify Node B (peer-side AXL bridge), optional ─────────────────────
  const peerApiUrl = process.env.AXL_PEER_API_URL
  if (peerApiUrl) {
    try {
      const nodeB = await getTopology({ ...cfg, apiUrl: peerApiUrl })
      console.log(green(`✓ Node B (peer) reachable at ${peerApiUrl}`))
      console.log(`  public key: ${nodeB.our_public_key}`)
      console.log(`  ipv6:       ${nodeB.our_ipv6}`)
      if (cfg.defaultPeerId && cfg.defaultPeerId !== nodeB.our_public_key) {
        console.warn(
          yellow(`! AXL_PEER_ID does not match Node B's public key:`),
        )
        console.warn(dim(`    AXL_PEER_ID=${cfg.defaultPeerId}`))
        console.warn(dim(`    Node B key=${nodeB.our_public_key}`))
      }
    } catch (e) {
      console.warn(yellow(`! Could not reach Node B at ${peerApiUrl}: ${e instanceof Error ? e.message : e}`))
    }
    console.log()
  }

  // ── 3. Verify peer MCP router & service registration ─────────────────────
  await checkRouter(cfg.mcpRouterUrl, cfg.serviceName)
  console.log()

  // ── 4. Run one ATS decision over AXL ──────────────────────────────────────
  if (!cfg.defaultPeerId && Object.values(cfg.peerByRole).every((v) => !v)) {
    console.error(red(`✗ No peer key configured. Set AXL_PEER_ID to Node B's public key.`))
    process.exit(1)
  }

  console.log(cyan(`▶ Running ATS pipeline over AXL transport for ${ticker}…`))
  console.log()

  const run_id = `axl-demo-${Date.now()}`
  const events: RunEvent[] = []

  const onEvent = (evt: RunEvent) => {
    events.push(evt)
    const tag = evt.payload?.axl ? cyan('[AXL]') : dim('[local]')
    const agent = evt.agent ? `${evt.agent.padEnd(13)}` : ''.padEnd(13)
    const message = evt.message ?? ''
    console.log(`${tag} ${dim(evt.type.padEnd(20))} ${agent} ${message}`)
  }

  try {
    const receipt = await runOrchestrator(
      {
        run_id,
        query: `Demo AXL run for ${ticker}`,
        ticker,
        mode,
        userWallet: '0x0000000000000000000000000000000000000000',
        chainId: getDefaultChainId(),
        transport: 'axl',
      },
      onEvent,
    )

    console.log()
    console.log(cyan('━━━ Decision Receipt ━━━'))
    console.log(`Decision:    ${receipt.consensus.decision}`)
    console.log(`Confidence:  ${(receipt.consensus.confidence * 100).toFixed(0)}%`)
    console.log(`Approved by: ${receipt.consensus.approved_by.join(', ') || '(none)'}`)
    console.log(`Vetoed by:   ${receipt.consensus.vetoed_by.join(', ') || '(none)'}`)
    console.log()
    console.log(cyan('━━━ Per-Agent Votes ━━━'))
    for (const v of receipt.agent_votes) {
      const tagged = events.some((e) => e.agent === v.agent && e.payload?.axl)
      const where = tagged ? cyan('AXL ') : dim('local')
      console.log(`  ${where}  ${v.agent.padEnd(7)} ${v.vote.padEnd(7)} conf=${(v.confidence * 100).toFixed(0)}%`)
    }
    console.log()
    const axlEventCount = events.filter((e) => e.payload?.axl).length
    console.log(green(`✓ Demo complete — ${axlEventCount} event(s) crossed the AXL mesh.`))
  } catch (e) {
    console.error(red(`✗ Demo run failed: ${e instanceof Error ? e.message : String(e)}`))
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[axl-demo] Fatal:', err)
  process.exit(1)
})
