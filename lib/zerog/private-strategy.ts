/**
 * Strategy Privacy Layer — 0G Storage + AES-256-GCM
 *
 * Handles the full lifecycle of a private strategy payload:
 *
 *   1. sealStrategyPayload(payload)
 *      — AES-256-GCM encrypt the compiled nodes/edges graph
 *      — Upload ciphertext blob to 0G Storage
 *      — Returns { rootHash, markerPayload } — rootHash stored in DB,
 *        markerPayload ({ encrypted: true, rootHash }) replaces the raw payload
 *        column so no plain-text logic ever touches Supabase.
 *
 *   2. unsealStrategyPayload(rootHash)
 *      — Download ciphertext from 0G Storage by rootHash
 *      — AES-256-GCM decrypt → original payload JSON
 *      — Server-only; never exported to the client bundle
 *
 *   3. generateHumanSummary(payload)
 *      — Describes the strategy graph in plain English via sealed 0G Compute
 *        (qwen3.6-plus, sealed: true — ZK-verified so the summary is
 *        trustworthy enough to display to buyers without exposing internals)
 *      — Returns the summary string for storage in strategy_versions.human_summary
 *
 * Encryption key:
 *   process.env.STRATEGY_ENCRYPTION_KEY — 64 hex characters (= 32 bytes).
 *   Generate with:  openssl rand -hex 32
 *
 * Binary envelope format stored on 0G Storage:
 *   [ 12 bytes IV ][ 16 bytes GCM authTag ][ N bytes ciphertext ]
 *
 * This module must only be imported from server-side code (API routes,
 * server components). It uses Node.js `crypto` which is not available
 * in the browser bundle.
 */

import { uploadToStorage, downloadFromStorage } from '@/lib/zerog/storage'
import { computeInference } from '@/lib/zerog/compute'

// ── Types ───────────────────────────────────────────────────────────────────

/** The compiled agent-builder graph: nodes, edges, and any extra metadata. */
export interface StrategyDraftPayload {
  nodes: unknown[]
  edges: unknown[]
  [key: string]: unknown
}

/**
 * Marker written to the Supabase `payload` column instead of the real graph.
 * Consumers that see this object know they must call unsealStrategyPayload()
 * to retrieve the actual execution logic from 0G Storage.
 */
export interface EncryptedPayloadMarker {
  encrypted: true
  rootHash: string
}

export interface SealResult {
  /** Content-addressed root hash of the ciphertext blob on 0G Storage */
  rootHash: string
  /** On-chain tx hash from the 0G Storage upload */
  txHash?: string
  /** Marker object that replaces the raw payload in Supabase */
  markerPayload: EncryptedPayloadMarker
  /** Encrypted blob size in bytes */
  encryptedSize: number
}

// ── Key helpers ─────────────────────────────────────────────────────────────

const IV_BYTES = 12    // 96-bit IV — recommended for AES-256-GCM
const TAG_BYTES = 16   // 128-bit authentication tag

function getEncryptionKey(): Buffer {
  const hex = process.env.STRATEGY_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'STRATEGY_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: openssl rand -hex 32'
    )
  }
  return Buffer.from(hex, 'hex')
}

// ── Encrypt / Decrypt ────────────────────────────────────────────────────────

/**
 * Encrypts arbitrary JSON data with AES-256-GCM.
 *
 * Returns a binary Buffer with the layout:
 *   [ 12-byte IV ][ 16-byte authTag ][ N-byte ciphertext ]
 */
function encrypt(plaintext: string): Buffer {
  // Dynamic require so this module can be imported without the browser
  // receiving a crypto-node shim in the bundle.
  const crypto = require('crypto') as typeof import('crypto')

  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  // Pack: IV | authTag | ciphertext
  return Buffer.concat([iv, authTag, ciphertext])
}

/**
 * Decrypts a buffer produced by encrypt().
 * Throws if the authTag is invalid (tampered or wrong key).
 */
function decrypt(blob: Uint8Array): string {
  const crypto = require('crypto') as typeof import('crypto')

  const key = getEncryptionKey()
  const buf = Buffer.from(blob)

  if (buf.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error('Encrypted blob is too short — data may be corrupted.')
  }

  const iv = buf.subarray(0, IV_BYTES)
  const authTag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES)

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return plaintext.toString('utf8')
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Seals a strategy payload: encrypts it and uploads the ciphertext to 0G Storage.
 *
 * Call this from the publish API route after validation/backtest.
 *
 * @example
 *   const { rootHash, markerPayload } = await sealStrategyPayload(draftPayload)
 *   // Store rootHash in strategy_versions.zerog_root_hash
 *   // Store markerPayload in strategy_versions.payload
 */
export async function sealStrategyPayload(
  payload: StrategyDraftPayload,
): Promise<SealResult> {
  const plaintext = JSON.stringify(payload)
  const encryptedBlob = encrypt(plaintext)

  let rootHash: string
  let txHash: string | undefined

  try {
    const result = await uploadToStorage(encryptedBlob)
    rootHash = result.rootHash
    txHash = result.txHash
  } catch {
    // 0G Storage unavailable (no signer, network down, etc.)
    // Fall back to inline storage: encode the encrypted blob in the rootHash itself.
    // unsealStrategyPayload detects the "inline:" prefix and skips the 0G download.
    rootHash = `inline:${Buffer.from(encryptedBlob).toString('base64')}`
  }

  const markerPayload: EncryptedPayloadMarker = { encrypted: true, rootHash }

  return {
    rootHash,
    txHash,
    markerPayload,
    encryptedSize: encryptedBlob.length,
  }
}

/**
 * Unseals a strategy payload: downloads the ciphertext from 0G Storage and decrypts it.
 *
 * Call this from the execution path (server-side only) when a bot needs to run.
 *
 * @example
 *   const payload = await unsealStrategyPayload(version.zerog_root_hash)
 *   // payload.nodes and payload.edges are now available for execution
 */
export async function unsealStrategyPayload(
  rootHash: string,
): Promise<StrategyDraftPayload> {
  if (rootHash.startsWith('inline:')) {
    const blob = Buffer.from(rootHash.slice(7), 'base64')
    return JSON.parse(decrypt(blob)) as StrategyDraftPayload
  }
  const { data } = await downloadFromStorage(rootHash)
  const plaintext = decrypt(data)
  return JSON.parse(plaintext) as StrategyDraftPayload
}

// ── Human Summary ────────────────────────────────────────────────────────────

const SUMMARY_SYSTEM_PROMPT = `You are a trading strategy analyst. Given a JSON description of an algorithmic trading bot's node graph, produce a clear, concise human-readable summary (3–5 sentences) that explains:
1. What market signals or indicators the strategy uses.
2. The conditions that trigger a trade entry.
3. The risk controls in place (stop-loss, position sizing, etc.).
4. The expected market regime or conditions where this strategy performs best.

Do NOT reveal implementation details, parameter values, or internal node IDs. Write for a trader who wants to evaluate whether to use this strategy, not an engineer who wants to replicate it.`

/**
 * Generates a human-readable description of a strategy using sealed 0G Compute
 * (qwen3.6-plus with ZK-verified inference).
 *
 * The summary is safe to display publicly — it describes *what* the strategy
 * does without exposing *how* it does it.
 *
 * @example
 *   const summary = await generateHumanSummary(draftPayload)
 *   // Store in strategy_versions.human_summary
 */
export async function generateHumanSummary(
  payload: StrategyDraftPayload,
): Promise<string> {
  // Build a sanitised description of the graph without parameter values
  const nodeTypes = (payload.nodes as Array<{ type?: string; data?: { label?: string; nodeType?: string } }>)
    .map(n => {
      const label = (n.data?.label ?? n.data?.nodeType ?? n.type ?? 'node') as string
      return label
    })
    .filter(Boolean)

  const edgeCount = (payload.edges as unknown[]).length

  const graphDescription = JSON.stringify({
    nodeLabels: nodeTypes,
    connectionCount: edgeCount,
    // Include any top-level metadata the creator set, but not raw node params
    ...(payload.name ? { name: payload.name } : {}),
    ...(payload.description ? { description: payload.description } : {}),
    ...(payload.tags ? { tags: payload.tags } : {}),
    ...(payload.assetPairs ? { assetPairs: payload.assetPairs } : {}),
    ...(payload.regime ? { regime: payload.regime } : {}),
  })

  const response = await computeInference({
    model: 'qwen3.6-plus',
    sealed: true,
    maxTokens: 512,
    temperature: 0.4,
    messages: [
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Describe this trading strategy based on its node graph:\n\n${graphDescription}`,
      },
    ],
  })

  return response.content.trim()
}
