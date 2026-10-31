/**
 * Agent Wallet Crypto — AES-256-GCM helpers for server-side key storage.
 *
 * Encrypts and decrypts agent burner-wallet private keys (and other secrets
 * such as user API keys) before they are persisted to Supabase.
 *
 * Encryption key:
 *   process.env.AGENT_WALLET_MASTER_KEY — 64 hex characters (32 bytes).
 *   Generate with:  openssl rand -hex 32
 *
 * Wire format (all values stored as lowercase hex strings, NOT binary):
 *   ct  — ciphertext hex
 *   iv  — 12-byte GCM IV hex
 *   tag — 16-byte GCM auth tag hex
 *
 * This module uses Node.js `crypto` via dynamic require so it is never
 * bundled into the browser. Import only from server-side code (API routes,
 * server components, lib utilities called from API routes).
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface EncryptedSecret {
  /** Hex-encoded AES-256-GCM ciphertext */
  ct: string
  /** Hex-encoded 12-byte initialisation vector */
  iv: string
  /** Hex-encoded 16-byte GCM authentication tag */
  tag: string
}

// ── Internals ─────────────────────────────────────────────────────────────────

const IV_BYTES = 12   // 96-bit IV — recommended for AES-256-GCM
const TAG_BYTES = 16  // 128-bit authentication tag

function getMasterKey(): Buffer {
  const hex = process.env.AGENT_WALLET_MASTER_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'AGENT_WALLET_MASTER_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: openssl rand -hex 32',
    )
  }
  return Buffer.from(hex, 'hex')
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string with AES-256-GCM.
 *
 * @returns An {@link EncryptedSecret} with hex-encoded `ct`, `iv`, and `tag`.
 *
 * @example
 *   const enc = encrypt(privateKey)
 *   // store enc.ct, enc.iv, enc.tag in Supabase
 */
export function encrypt(plaintext: string): EncryptedSecret {
  const crypto = require('crypto') as typeof import('crypto')

  const key = getMasterKey()
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return {
    ct: ciphertext.toString('hex'),
    iv: iv.toString('hex'),
    tag: authTag.toString('hex'),
  }
}

/**
 * Decrypts an {@link EncryptedSecret} produced by {@link encrypt}.
 *
 * Throws if the auth tag is invalid (tampered ciphertext or wrong master key).
 *
 * @example
 *   const privateKey = decrypt({ ct, iv, tag })
 */
export function decrypt({ ct, iv, tag }: EncryptedSecret): string {
  const crypto = require('crypto') as typeof import('crypto')

  const key = getMasterKey()
  const ivBuf = Buffer.from(iv, 'hex')
  const tagBuf = Buffer.from(tag, 'hex')
  const ctBuf = Buffer.from(ct, 'hex')

  if (ivBuf.length !== IV_BYTES) {
    throw new Error(`IV must be ${IV_BYTES} bytes; got ${ivBuf.length}.`)
  }
  if (tagBuf.length !== TAG_BYTES) {
    throw new Error(`Auth tag must be ${TAG_BYTES} bytes; got ${tagBuf.length}.`)
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuf)
  decipher.setAuthTag(tagBuf)

  const plaintext = Buffer.concat([
    decipher.update(ctBuf),
    decipher.final(),
  ])

  return plaintext.toString('utf8')
}
