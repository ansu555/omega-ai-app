/**
 * Client-side driver for the ATS agent pipeline SSE stream.
 *
 * Wraps POST /api/research/run (which streams `RunEvent`s as Server-Sent
 * Events) into an async iterator, so terminal UI can render the six-agent
 * pipeline live: data → regime ∥ signal ∥ graph → risk → consensus → execution.
 *
 * The route already accepts an explicit `ticker`, which short-circuits
 * free-form intake and goes straight to the ATS fast path — exactly what a
 * terminal market pane wants (the market is already chosen).
 */

import type { RunEvent, Mode } from '@/lib/ats/types'

/** Parses a `text/event-stream` body into RunEvents. */
export async function* parseRunEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<RunEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (raw === '[DONE]') return
        try {
          yield JSON.parse(raw) as RunEvent
        } catch {
          // Ignore malformed frames rather than killing the stream.
        }
      }
    }
  } finally {
    // Releasing the lock lets an aborted fetch tear the socket down cleanly.
    try {
      reader.releaseLock()
    } catch {
      /* already released */
    }
  }
}

export interface StartAgentRunOptions {
  /** Authenticated wallet — sent as the x-wallet-address header. */
  address: string
  /** Canonical asset ticker, e.g. "WHSK" / "WETH" / "WBTC". */
  ticker: string
  /** Natural-language framing recorded on the decision receipt. */
  query: string
  mode: Mode
  chainId?: number
  /** Only meaningful in `assisted` mode — approves the pending trade. */
  executionApproved?: boolean
  signal?: AbortSignal
}

/**
 * Starts a run and returns the RunEvent stream.
 * Throws with the server's error message when the run is rejected up front
 * (bad mode, unfunded agent wallet, missing Supabase config, …).
 */
export async function startAgentRun(
  opts: StartAgentRunOptions,
): Promise<AsyncGenerator<RunEvent>> {
  const res = await fetch('/api/research/run', {
    method: 'POST',
    signal: opts.signal,
    headers: {
      'Content-Type': 'application/json',
      'x-wallet-address': opts.address,
    },
    body: JSON.stringify({
      query: opts.query,
      ticker: opts.ticker,
      mode: opts.mode,
      ...(opts.chainId !== undefined ? { chainId: opts.chainId } : {}),
      ...(opts.executionApproved ? { executionApproved: true } : {}),
    }),
  })

  if (!res.ok || !res.body) {
    let message = `HTTP ${res.status}: ${res.statusText}`
    try {
      const data = (await res.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      // Non-JSON error body — keep the status line.
    }
    throw new Error(message)
  }

  return parseRunEvents(res.body)
}
