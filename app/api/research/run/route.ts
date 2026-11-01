/**
 * /api/research/run
 *
 * POST — Starts a research run and streams RunEvents as Server-Sent Events.
 *
 *   • Explicit ticker / single-asset deep dive  → the ATS pipeline (fast path),
 *     run inline and streamed for the life of the request.
 *   • Any other free-form query                 → the Deep Research brain, run as
 *     a DURABLE BACKGROUND JOB via the run manager (P5). The job survives a
 *     client disconnect; this request just subscribes and streams its events. A
 *     client can later reconnect with `GET ?runId=&afterSeq=` to replay/resume.
 *
 * GET — Reconnect to an in-flight or recent deep run and replay its event stream
 *   from a sequence cursor (`?runId=<id>&afterSeq=<n>`). Serves live events when
 *   the run is held in this process, else replays from the persisted event log.
 *
 * Response: text/event-stream — each event is a JSON-serialised RunEvent
 * (lib/ats/types.ts) on a `data:` line. Deep events carry a monotonic `seq`.
 *
 * Auth: x-wallet-address header (requireWallet helper).
 */

import { type NextRequest } from 'next/server'
import { createPublicClient, http, formatEther } from 'viem'

import { requireWallet } from '@/lib/marketplace/wallet-header'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getOrCreateAgentWallet } from '@/lib/agent-wallet/manager'
import { runOrchestrator } from '@/lib/ats/orchestrator'
import { runIntake, canonicalizeTicker } from '@/lib/research/intake'
import * as runManager from '@/lib/research/run-manager'
import * as runStore from '@/lib/research/run-store'
import type { ResearchRequest } from '@/lib/research/types'
import { saveAgentMemory } from '@/lib/zerog'
import { getChainConfig, DEFAULT_CHAIN_ID } from '@/lib/chain-registry'
import type { RunEvent, Mode } from '@/lib/ats/types'
import type { AxlTransport } from '@/lib/axl'

export const dynamic = 'force-dynamic'

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_MODES: Mode[] = ['autonomous', 'assisted', 'solo']
const VALID_TRANSPORTS: AxlTransport[] = ['local', 'axl', 'auto']

/** Reconnect guardrails (P5) — bound how long a tailing reconnect stays open. */
const MAX_RECONNECT_MS = 12 * 60_000
const POLL_INTERVAL_MS = 1500

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no', // Disable Nginx proxy buffering
} as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function isTerminal(evt: RunEvent): boolean {
  return evt.type === 'run.done' || evt.type === 'run.error'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Best-effort estimate of the agent wallet balance in USD.
 * For HashKey Chain we don't have a live native-token price oracle here, so we
 * use a conservative placeholder (~$0.09 per HSK on mainnet, $1 elsewhere). On Ethereum mainnet we use $3,000/ETH.
 * Failures are swallowed and return 0 so Kelly sizing gracefully falls back.
 */
async function estimateAgentBalanceUSD(agentAddress: string, chainId: number): Promise<number> {
  try {
    const config = getChainConfig(chainId)
    const client = createPublicClient({
      chain: config.chain,
      transport: http(config.chain.rpcUrls.default.http[0]),
    })
    const raw = await client.getBalance({ address: agentAddress as `0x${string}` })
    const native = parseFloat(formatEther(raw))
    // ETH mainnet: rough $3k/ETH; HashKey mainnet: ~$0.09 HSK; others: $1 placeholder
    const priceUSD = chainId === 1 ? 3000 : chainId === 177 ? 0.09 : 1
    return native * priceUSD
  } catch {
    return 0
  }
}

function formatSSE(event: RunEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
}

// ── POST: start a run ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const userWallet = requireWallet(req)
  if (userWallet instanceof Response) return userWallet

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: {
    query?: string
    ticker?: string
    mode?: string
    chainId?: number
    executionApproved?: boolean
    transport?: string
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    body = {}
  }

  const query = body.query?.trim()
  if (!query) return jsonError(400, '`query` is required')

  // Explicit ticker (e.g. Terminal approval re-run) short-circuits intake and
  // goes straight to the ATS. Free-form queries are understood below.
  const explicitTicker = body.ticker?.trim()
    ? canonicalizeTicker(body.ticker) ?? body.ticker.trim().toUpperCase()
    : null

  const chainId =
    typeof body.chainId === 'number' && Number.isFinite(body.chainId) ? body.chainId : DEFAULT_CHAIN_ID

  // ── Load user settings (mode fallback) ──────────────────────────────────────
  const supabase = createSupabaseAdminClient()
  const { data: settings } = await supabase
    .from('user_settings')
    .select('mode')
    .eq('user_wallet', userWallet.toLowerCase())
    .maybeSingle()

  const modeFromBody = body.mode as Mode | undefined
  const mode: Mode =
    (modeFromBody && VALID_MODES.includes(modeFromBody) ? modeFromBody : null) ??
    (settings?.mode && VALID_MODES.includes(settings.mode as Mode) ? (settings.mode as Mode) : null) ??
    'solo'

  // Optional per-request transport override (defaults to ATS_AGENT_TRANSPORT in orchestrator)
  const transportFromBody = body.transport?.toLowerCase() as AxlTransport | undefined
  const transport: AxlTransport | undefined =
    transportFromBody && VALID_TRANSPORTS.includes(transportFromBody) ? transportFromBody : undefined

  const run_id = makeRunId()

  // Lets cancel()/disconnect tear down the live subscription without killing the
  // detached background run (assigned inside start() for the deep path).
  let detach: () => void = () => {}

  // ── SSE stream ──────────────────────────────────────────────────────────────
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (evt: RunEvent) => {
        try {
          controller.enqueue(formatSSE(evt))
        } catch {
          // Client disconnected — swallow enqueue errors so cleanup still runs
        }
      }

      try {
        // ── [0] Intake & understanding ──────────────────────────────────────
        let atsTicker = explicitTicker
        if (!atsTicker) {
          const request: ResearchRequest = await runIntake({ query, userWallet })
          send({
            type: 'intake.parsed',
            run_id,
            ts: new Date().toISOString(),
            agent: 'orchestrator',
            message: `Understood: ${request.queryType.replace(/_/g, ' ')}${
              request.tokens.length ? ` (${request.tokens.join(', ')})` : ''
            }.`,
            payload: {
              query_type: request.queryType,
              tokens: request.tokens,
              amount_usd: request.amountUsd,
              primary_ticker: request.primaryTicker,
              source: request.source,
            },
          })

          // Single-asset deep dive over a covered token → drill the full ATS
          // (the legacy fast path). Everything else routes to the Deep Research
          // brain, run as a DURABLE BACKGROUND JOB (P5): the run survives this
          // request closing, and this stream just tails it.
          if (!request.primaryTicker) {
            runManager.startRun({ request, run_id, chainId, userWallet })
            let unsubscribe: () => void = () => {}
            await new Promise<void>((resolve) => {
              const sub = runManager.subscribe(run_id, 0, (evt) => {
                send(evt)
                if (isTerminal(evt)) resolve()
              })
              unsubscribe = sub.unsubscribe
              detach = () => {
                sub.unsubscribe()
                resolve()
              }
              if (sub.done) resolve()
            })
            unsubscribe()
            return
          }
          atsTicker = request.primaryTicker
        }

        // ── ATS path: agent wallet init (idempotent) + Kelly-sizing balance ──
        let agentBalanceUSD = 0
        try {
          const { address } = await getOrCreateAgentWallet(userWallet, chainId)
          agentBalanceUSD = await estimateAgentBalanceUSD(address, chainId)
        } catch (walletErr) {
          console.warn('[ATS run] Agent wallet init failed (non-fatal):', walletErr)
        }

        const receipt = await runOrchestrator(
          {
            run_id,
            query,
            ticker: atsTicker,
            mode,
            userWallet,
            chainId,
            executionApproved: body.executionApproved,
            agentBalanceUSD,
            transport,
          },
          send,
        )

        // ── 0G Storage: persist receipt blob (best-effort) ──────────────────
        if (receipt.id) {
          try {
            const { rootHash } = await saveAgentMemory(`ats_receipt_${run_id}`, receipt)
            await supabase
              .from('ats_receipts')
              .update({ storage_root_hash: rootHash })
              .eq('id', receipt.id)
          } catch (storageErr) {
            console.warn(
              '[ATS run] 0G Storage upload failed (non-fatal):',
              storageErr instanceof Error ? storageErr.message : storageErr,
            )
          }
        }
      } catch (err) {
        // Top-level safety net — orchestrator/lead emit run.error internally, but
        // we guard against any uncaught exception so the stream closes cleanly.
        const msg = err instanceof Error ? err.message : String(err)
        send({
          type: 'run.error',
          run_id,
          ts: new Date().toISOString(),
          agent: 'orchestrator',
          message: `Unhandled error: ${msg}`,
          payload: { error: msg },
        })
      } finally {
        controller.close()
      }
    },
    cancel() {
      // Client disconnected — detach the live subscription. The detached deep
      // run keeps executing and persisting in the background.
      detach()
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}

// ── GET: reconnect / replay a deep run ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  const userWallet = requireWallet(req)
  if (userWallet instanceof Response) return userWallet

  const runId = req.nextUrl.searchParams.get('runId')?.trim()
  if (!runId) return jsonError(400, '`runId` is required')

  const rawAfter = parseInt(req.nextUrl.searchParams.get('afterSeq') ?? '0', 10)
  const afterSeq = Number.isNaN(rawAfter) ? 0 : Math.max(0, rawAfter)

  // Resolve the run from this process (live) or the persisted log (replay).
  const snapshot = runManager.peek(runId)
  const persisted = await runStore.loadRun(runId)
  if (!snapshot && !persisted) return jsonError(404, 'Run not found')

  // Authorize: a run may only be reconnected by the wallet that started it.
  const owner = (snapshot?.userWallet ?? persisted?.user_wallet ?? '').toLowerCase()
  if (owner && owner !== userWallet.toLowerCase()) return jsonError(403, 'Forbidden')

  let detach: () => void = () => {}
  let cancelled = false

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (evt: RunEvent) => {
        try {
          controller.enqueue(formatSSE(evt))
        } catch {
          // client disconnected mid-replay
        }
      }

      try {
        if (snapshot) {
          // Held in this process → replay buffer past the cursor, then tail live.
          let unsubscribe: () => void = () => {}
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, MAX_RECONNECT_MS)
            const finish = () => {
              clearTimeout(timeout)
              resolve()
            }
            const sub = runManager.subscribe(runId, afterSeq, (evt) => {
              send(evt)
              if (isTerminal(evt)) finish()
            })
            unsubscribe = sub.unsubscribe
            detach = () => {
              sub.unsubscribe()
              finish()
            }
            if (sub.done) finish()
          })
          unsubscribe()
        } else {
          // Not in this process (finished, or another instance) → replay from the
          // persisted log and poll for any late events until terminal/timeout.
          let cursor = afterSeq
          const startedAt = Date.now()
          while (!cancelled) {
            const rows = await runStore.loadEvents(runId, cursor)
            let terminal = false
            for (const r of rows) {
              send(r.event)
              cursor = Math.max(cursor, r.seq)
              if (isTerminal(r.event)) terminal = true
            }
            if (terminal) break
            // A finished run with no terminal event persisted (e.g. an aborted
            // process) should not be polled forever.
            if (persisted && persisted.status !== 'running' && rows.length === 0) break
            if (Date.now() - startedAt > MAX_RECONNECT_MS) break
            await sleep(POLL_INTERVAL_MS)
          }
        }
      } finally {
        controller.close()
      }
    },
    cancel() {
      cancelled = true
      detach()
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}
