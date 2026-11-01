/**
 * 0G DA (Data Availability) wrapper
 *
 * 0G DA is an infinitely scalable data availability layer optimized for
 * high-throughput applications like AI inference results, agent swarm
 * message logs, and large on-chain datasets.
 *
 * Unlike 0G Storage (persistent content-addressed blobs), 0G DA is designed
 * for ephemeral high-volume data — you submit a blob, get a commitment, and
 * any observer can verify the data was available at that commitment.
 *
 * Use cases in this project:
 *   - Storing large batch inference results from 0G Compute
 *   - Publishing agent swarm coordination messages
 *   - High-throughput market data attestation
 *
 * DA RPC (Newton Testnet): https://da-client-testnet.0g.ai
 */

import { ZEROG_DA_RPC } from './config'

export interface DASubmitResult {
  /** DA commitment hash — use this to prove data availability */
  commitment: string
  /** DA blob index */
  blobIndex: number
  /** Block height at submission */
  blockHeight?: number
}

export interface DARetrieveResult {
  data: Uint8Array
  commitment: string
}

// ── Core DA operations ─────────────────────────────────────────────────────────

/**
 * Submit a data blob to 0G DA.
 * Returns a commitment that any observer can use to verify the data was posted.
 *
 * @example
 *   const { commitment } = await submitToDA(Buffer.from(largeInferenceResult))
 *   // Store `commitment` on-chain as proof of data availability
 */
export async function submitToDA(
  data: Uint8Array | string,
  daRpc = ZEROG_DA_RPC,
): Promise<DASubmitResult> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data

  const res = await fetch(`${daRpc}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: bytes as unknown as BodyInit,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`0G DA submit error ${res.status}: ${text}`)
  }

  const result = await res.json() as {
    commitment: string
    blob_index: number
    block_height?: number
  }

  return {
    commitment: result.commitment,
    blobIndex: result.blob_index,
    blockHeight: result.block_height,
  }
}

/**
 * Retrieve a blob from 0G DA by commitment.
 */
export async function retrieveFromDA(
  commitment: string,
  daRpc = ZEROG_DA_RPC,
): Promise<DARetrieveResult> {
  const res = await fetch(`${daRpc}/retrieve/${commitment}`)

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`0G DA retrieve error ${res.status}: ${text}`)
  }

  const data = new Uint8Array(await res.arrayBuffer())
  return { data, commitment }
}

/**
 * Verify that a blob commitment is available on the 0G DA layer.
 * Returns true if the data is provably available, false otherwise.
 */
export async function verifyDAAvailability(
  commitment: string,
  daRpc = ZEROG_DA_RPC,
): Promise<boolean> {
  try {
    const res = await fetch(`${daRpc}/availability/${commitment}`)
    if (!res.ok) return false
    const data = await res.json() as { available: boolean }
    return data.available
  } catch {
    return false
  }
}

// ── Agent-level helpers ────────────────────────────────────────────────────────

/**
 * Post a JSON-serializable agent swarm message to 0G DA.
 * High-frequency coordination messages (agent→agent) are better suited
 * to DA than Storage since they're ephemeral but need availability proofs.
 */
export async function postSwarmMessage(
  message: Record<string, unknown>,
  daRpc?: string,
): Promise<DASubmitResult> {
  const payload = JSON.stringify({ ...message, ts: Date.now() })
  return submitToDA(payload, daRpc)
}

/**
 * Post a large inference result batch to 0G DA and return the commitment.
 * Agents can reference this commitment in their on-chain receipts to prove
 * the inference output is available without storing it on-chain directly.
 */
export async function postInferenceResult(
  inferenceOutput: string,
  metadata: { agentId: string; model: string; requestId?: string },
  daRpc?: string,
): Promise<{ commitment: string; metadata: typeof metadata }> {
  const payload = JSON.stringify({
    output: inferenceOutput,
    ...metadata,
    postedAt: new Date().toISOString(),
  })
  const { commitment } = await submitToDA(payload, daRpc)
  return { commitment, metadata }
}
