/**
 * Deep Research — durable run manager (P5).
 *
 * Decouples a deep-research run from the HTTP request that started it so the run
 * survives a client disconnect and can run for minutes (blueprint §7). The route
 * calls `startRun` (fire-and-forget) and then `subscribe`s to stream events; if
 * the client goes away, the background job keeps going and keeps persisting.
 *
 * What this module owns:
 *   • a process-level registry of active/recent runs, each with a monotonic
 *     event buffer and a set of live subscribers.
 *   • assigning `seq` to every RunEvent, buffering it, persisting it
 *     (`run-store`), and fanning it out to subscribers.
 *   • running the lead orchestrator (`runDeepResearch`) in the background and,
 *     on completion, persisting the final report to Supabase + 0G Storage.
 *   • `subscribe(runId, afterSeq, …)` — replay buffered events past a cursor and
 *     then receive live ones, with per-subscriber de-duplication.
 *
 * Durability scope: this is an in-process manager — correct for a long-lived
 * Node server (e.g. `bun run dev` or the realtime-service-style deployment).
 * Cross-instance / post-restart replay is served from the persisted event log
 * by the route's reconnect handler. The production upgrade path (per the
 * blueprint) is Vercel Workflow DevKit or a dedicated worker; the contracts here
 * (run_id + seq + persisted events) are designed to slot under either.
 *
 * Server-only.
 */

import type { RunEvent } from '@/lib/ats/types'
import type { ResearchRequest, ResearchReport, ResearchRunStatus } from '@/lib/research/types'
import { runDeepResearch } from '@/lib/research/lead'
import * as runStore from '@/lib/research/run-store'
import { saveAgentMemory } from '@/lib/zerog'

/** Keep finished runs in memory this long so reconnects replay from RAM, not the DB. */
const FINISHED_TTL_MS = 15 * 60_000

interface RunHandle {
  runId: string
  userWallet?: string
  status: ResearchRunStatus
  /** Highest seq assigned so far. */
  seq: number
  /** All events emitted so far, in order (each carries its seq). */
  buffer: RunEvent[]
  subscribers: Set<(event: RunEvent) => void>
  report?: ResearchReport
  finished: boolean
  finishedAt?: number
}

const RUNS = new Map<string, RunHandle>()

/** Drop finished runs whose TTL has elapsed (called opportunistically). */
function gc(): void {
  const now = Date.now()
  for (const [id, h] of RUNS) {
    if (h.finished && h.finishedAt && now - h.finishedAt > FINISHED_TTL_MS) {
      RUNS.delete(id)
    }
  }
}

export interface StartRunOptions {
  request: ResearchRequest
  run_id: string
  chainId: number
  userWallet?: string
  budget?: { maxRounds?: number; wallClockMs?: number }
}

/**
 * Kick off a deep-research run in the background. Returns immediately with the
 * handle (already registered, so a caller can `subscribe` straight away). The
 * actual work runs detached and continues even if every subscriber disconnects.
 */
export function startRun(opts: StartRunOptions): RunHandle {
  gc()

  const handle: RunHandle = {
    runId: opts.run_id,
    userWallet: opts.userWallet,
    status: 'running',
    seq: 0,
    buffer: [],
    subscribers: new Set(),
    finished: false,
  }
  RUNS.set(opts.run_id, handle)

  // The emit the lead streams through: assign seq → buffer → persist → fan out.
  const emit = (event: RunEvent): void => {
    const seq = ++handle.seq
    event.seq = seq
    handle.buffer.push(event)
    if (event.type === 'run.done') handle.status = 'done'
    else if (event.type === 'run.error') handle.status = 'error'
    void runStore.persistEvent(opts.run_id, seq, event)
    for (const sub of handle.subscribers) {
      try {
        sub(event)
      } catch {
        // a bad subscriber must not break the fan-out
      }
    }
  }

  // Detached background execution.
  void (async () => {
    // Persist the run row BEFORE any event (events FK-reference it).
    await runStore.createRun({
      runId: opts.run_id,
      userWallet: opts.userWallet,
      query: opts.request.query,
      chainId: opts.chainId,
      queryType: opts.request.queryType,
    })

    let report: ResearchReport | undefined
    try {
      const result = await runDeepResearch({
        request: opts.request,
        run_id: opts.run_id,
        chainId: opts.chainId,
        userWallet: opts.userWallet,
        emit,
        budget: opts.budget,
      })
      report = result.report
      handle.report = report
      // runDeepResearch never throws and emits its own run.done/run.error, so
      // handle.status is already set; default to 'done' if somehow unset.
      if (handle.status === 'running') handle.status = report || result.synthesis ? 'done' : 'error'
    } catch {
      // Defensive — the lead is supposed to be throw-proof.
      handle.status = 'error'
    } finally {
      // Persist the final report (+ best-effort 0G Storage blob for the audit trail).
      let rootHash: string | undefined
      if (report) {
        try {
          const saved = await saveAgentMemory(`research_report_${opts.run_id}`, report)
          rootHash = saved.rootHash
        } catch {
          // 0G upload is best-effort
        }
      }
      await runStore.finishRun(opts.run_id, handle.status, report ?? null, rootHash ?? null)
      handle.finished = true
      handle.finishedAt = Date.now()
      gc()
    }
  })()

  return handle
}

/** Snapshot of a run's in-memory state (undefined when not in this instance). */
export interface RunSnapshot {
  status: ResearchRunStatus
  finished: boolean
  userWallet?: string
  lastSeq: number
}

/** Peek at a run held in this process (for authorization + reconnect routing). */
export function peek(runId: string): RunSnapshot | undefined {
  const h = RUNS.get(runId)
  if (!h) return undefined
  return { status: h.status, finished: h.finished, userWallet: h.userWallet, lastSeq: h.seq }
}

export interface Subscription {
  /** False when the run is not held in this process. */
  found: boolean
  /** True when the run is already finished (no live events will follow). */
  done: boolean
  unsubscribe: () => void
}

/**
 * Replay buffered events past `afterSeq` to `onEvent`, then receive live events
 * as they are emitted. A per-subscription cursor guarantees each event is
 * delivered at most once and strictly in seq order, even across the
 * replay→live boundary.
 */
export function subscribe(
  runId: string,
  afterSeq: number,
  onEvent: (event: RunEvent) => void,
): Subscription {
  const handle = RUNS.get(runId)
  if (!handle) return { found: false, done: false, unsubscribe: () => {} }

  let deliveredUpTo = afterSeq
  const guarded = (event: RunEvent): void => {
    const s = event.seq ?? 0
    if (s > deliveredUpTo) {
      deliveredUpTo = s
      onEvent(event)
    }
  }

  // Register first, then drain the buffer synchronously — JS is single-threaded
  // so no live emit can interleave during this loop, and the guard dedupes the
  // boundary event.
  handle.subscribers.add(guarded)
  for (const event of handle.buffer) guarded(event)

  if (handle.finished) {
    handle.subscribers.delete(guarded)
    return { found: true, done: true, unsubscribe: () => {} }
  }

  return {
    found: true,
    done: false,
    unsubscribe: () => handle.subscribers.delete(guarded),
  }
}
