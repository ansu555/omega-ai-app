/**
 * 0G Storage SDK wrapper
 *
 * 0G Storage provides two primitives for persistent agent memory:
 *   - KV Store  — real-time agent state (fast reads/writes, small values)
 *   - Log Store — conversation history & audit trail (append-only, large blobs)
 *
 * All data is content-addressed and stored on the decentralized 0G Storage
 * network — agents can access their memory across restarts and across devices.
 *
 * Endpoints (Newton Testnet):
 *   Storage Indexer: https://indexer-storage-testnet-standard.0g.ai
 *   Storage Node:    https://storage-testnet-standard.0g.ai
 *
 * Install the SDK:
 *   npm install @0glabs/0g-ts-sdk
 */

import { ZEROG_STORAGE_RPC } from './config'

export interface StorageUploadResult {
  /** Content-addressed root hash of the uploaded data */
  rootHash: string
  /** Transaction hash of the on-chain submission */
  txHash?: string
  /** Size in bytes */
  size: number
}

export interface StorageDownloadResult {
  data: Uint8Array
  rootHash: string
}

// ── Lazy SDK loader ────────────────────────────────────────────────────────────
// We dynamically import the SDK so the bundle does not break in environments
// where @0glabs/0g-ts-sdk is not installed.

let _sdk: any | null = null

async function getSDK() {
  if (!_sdk) {
    try {
      // Dynamic import — avoid TypeScript module resolution error for optional dep
      const moduleId = '@0glabs/0g-ts-sdk'
      _sdk = await import(/* webpackIgnore: true */ moduleId)
    } catch {
      throw new Error(
        '0G Storage SDK not installed. Run: npm install @0glabs/0g-ts-sdk'
      )
    }
  }
  return _sdk
}

// ── High-level helpers ─────────────────────────────────────────────────────────

/**
 * Upload arbitrary bytes to 0G Storage.
 * Returns the content-addressed root hash to use for later retrieval.
 *
 * @example
 *   const { rootHash } = await uploadToStorage(Buffer.from(JSON.stringify(agentState)))
 */
export async function uploadToStorage(
  data: Uint8Array | string,
  storageRpc = ZEROG_STORAGE_RPC,
  signer?: unknown,
): Promise<StorageUploadResult> {
  if (!signer) {
    throw new Error(
      '0G Storage upload requires an ethers Signer. Pass a server-side signer or use inline fallback storage.'
    )
  }

  const sdk = await getSDK()
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data

  const indexer = new sdk.Indexer(storageRpc)

  // SDK upload() requires: file (AbstractFile), blockchain_rpc, signer, opts
  // For raw bytes we need to wrap them in a MemoryFile if the SDK provides one,
  // otherwise callers must supply an AbstractFile.
  const [result, err] = await indexer.upload(
    bytes,
    ZEROG_STORAGE_RPC,
    signer,
  )
  if (err) throw new Error(`0G Storage upload error: ${err}`)

  return { rootHash: result.rootHash, txHash: result.txHash, size: bytes.length }
}

/**
 * Download data from 0G Storage by root hash.
 *
 * @example
 *   const { data } = await downloadFromStorage('0xabc…')
 *   const agentState = JSON.parse(new TextDecoder().decode(data))
 */
export async function downloadFromStorage(
  rootHash: string,
  storageRpc = ZEROG_STORAGE_RPC,
): Promise<StorageDownloadResult> {
  const sdk = await getSDK()
  const indexer = new sdk.Indexer(storageRpc)
  const [nodes] = await indexer.selectNodes(1)

  const client = new sdk.StorageClient(nodes[0])
  const data = await client.download(rootHash)

  return { data: data as Uint8Array, rootHash }
}

// ── Agent memory helpers ───────────────────────────────────────────────────────

/**
 * Persists a JSON-serializable agent state object to 0G Storage.
 * Returns the root hash — store it in your on-chain contract or DB for retrieval.
 */
export async function saveAgentMemory<T>(
  agentId: string,
  state: T,
  storageRpc?: string,
): Promise<{ rootHash: string; agentId: string; savedAt: string }> {
  const payload = JSON.stringify({ agentId, state, savedAt: new Date().toISOString() })
  const { rootHash } = await uploadToStorage(payload, storageRpc)
  return { rootHash, agentId, savedAt: new Date().toISOString() }
}

/**
 * Retrieves and parses a JSON agent state from 0G Storage by root hash.
 */
export async function loadAgentMemory<T>(
  rootHash: string,
  storageRpc?: string,
): Promise<{ agentId: string; state: T; savedAt: string }> {
  const { data } = await downloadFromStorage(rootHash, storageRpc)
  const raw = new TextDecoder().decode(data)
  return JSON.parse(raw) as { agentId: string; state: T; savedAt: string }
}

/**
 * Appends a log entry to 0G Storage — suitable for conversation history,
 * audit trails, or streaming inference results.
 *
 * Use this instead of saveAgentMemory when you need append semantics.
 * Each call uploads an independent blob; maintain the list of root hashes
 * in your application to reconstruct the full log.
 */
export async function appendLog(
  agentId: string,
  entry: Record<string, unknown>,
  storageRpc?: string,
): Promise<{ rootHash: string; timestamp: string }> {
  const record = { agentId, ...entry, timestamp: new Date().toISOString() }
  const { rootHash } = await uploadToStorage(JSON.stringify(record), storageRpc)
  return { rootHash, timestamp: record.timestamp }
}
