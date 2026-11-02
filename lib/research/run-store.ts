/**
 * Deep Research — durable run store (P5).
 *
 * Persists deep-research runs and their RunEvents so a long-running job survives
 * a client disconnect and a reconnecting client can REPLAY the stream from a
 * sequence cursor (blueprint §7). Two tables (see
 * supabase/migrations/20260616_research_runs.sql):
 *
 *   research_runs   — one row per run: status, query, final report, 0G root hash.
 *   research_events — append-only RunEvent log keyed by (run_id, seq).
 *
 * Every function is best-effort and NEVER throws: if Supabase is unconfigured
 * (local dev) or a write fails, persistence silently no-ops. The in-process run
 * manager still buffers events, so live streaming and same-instance reconnect
 * keep working; only cross-instance / post-restart replay needs the DB.
 *
 * Server-only.
 */

import { tryCreateSupabaseAdminClient } from '@/lib/supabase/server'
import type { RunEvent } from '@/lib/ats/types'
import type { QueryType, ResearchReport, ResearchRunStatus } from '@/lib/research/types'

const RUNS_TABLE = 'research_runs'
const EVENTS_TABLE = 'research_events'

/** One persisted run row (the fields callers actually read back). */
export interface PersistedRun {
  run_id: string
  user_wallet: string | null
  status: ResearchRunStatus
  query: string | null
  query_type: string | null
  report: ResearchReport | null
}

/** One persisted event row, ordered by `seq`. */
export interface PersistedEvent {
  seq: number
  event: RunEvent
}

/** Insert the run row at kickoff. Awaited before events are persisted (FK order). */
export async function createRun(p: {
  runId: string
  userWallet?: string
  query: string
  chainId: number
  queryType: QueryType
}): Promise<void> {
  const sb = tryCreateSupabaseAdminClient()
  if (!sb) return
  try {
    await sb.from(RUNS_TABLE).insert({
      run_id: p.runId,
      user_wallet: p.userWallet ? p.userWallet.toLowerCase() : null,
      query: p.query,
      query_type: p.queryType,
      chain_id: p.chainId,
      status: 'running' satisfies ResearchRunStatus,
    })
  } catch {
    // best-effort
  }
}

/** Append one RunEvent to the durable log. */
export async function persistEvent(runId: string, seq: number, event: RunEvent): Promise<void> {
  const sb = tryCreateSupabaseAdminClient()
  if (!sb) return
  try {
    await sb.from(EVENTS_TABLE).insert({
      run_id: runId,
      seq,
      type: event.type,
      event,
    })
  } catch {
    // best-effort — a dropped event only degrades cross-instance replay
  }
}

/** Mark a run terminal, attaching the final report + 0G root hash when present. */
export async function finishRun(
  runId: string,
  status: ResearchRunStatus,
  report?: ResearchReport | null,
  storageRootHash?: string | null,
): Promise<void> {
  const sb = tryCreateSupabaseAdminClient()
  if (!sb) return
  try {
    await sb
      .from(RUNS_TABLE)
      .update({
        status,
        report: report ?? null,
        storage_root_hash: storageRootHash ?? null,
        proof_ref: report?.proof_ref ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('run_id', runId)
  } catch {
    // best-effort
  }
}

/** Load a run's metadata (for authorization + status on reconnect). */
export async function loadRun(runId: string): Promise<PersistedRun | null> {
  const sb = tryCreateSupabaseAdminClient()
  if (!sb) return null
  try {
    const { data, error } = await sb
      .from(RUNS_TABLE)
      .select('run_id, user_wallet, status, query, query_type, report')
      .eq('run_id', runId)
      .maybeSingle()
    if (error || !data) return null
    return data as PersistedRun
  } catch {
    return null
  }
}

/** Load persisted events with seq strictly greater than `afterSeq`, ordered. */
export async function loadEvents(runId: string, afterSeq = 0): Promise<PersistedEvent[]> {
  const sb = tryCreateSupabaseAdminClient()
  if (!sb) return []
  try {
    const { data, error } = await sb
      .from(EVENTS_TABLE)
      .select('seq, event')
      .eq('run_id', runId)
      .gt('seq', afterSeq)
      .order('seq', { ascending: true })
    if (error || !data) return []
    return (data as Array<{ seq: number; event: RunEvent }>).map((r) => ({ seq: r.seq, event: r.event }))
  } catch {
    return []
  }
}
