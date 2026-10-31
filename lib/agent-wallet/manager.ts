/**
 * Agent Wallet Manager — server-managed burner EOA lifecycle.
 *
 * Provides a single entry point:
 *
 *   getOrCreateAgentWallet(userWallet, chainId?)
 *     → { address, account }
 *
 * On first call for a given user:
 *   1. generatePrivateKey() — cryptographically random burner key via viem
 *   2. encrypt(privateKey)  — AES-256-GCM with AGENT_WALLET_MASTER_KEY
 *   3. Upsert { user_wallet, agent_address, ciphertext, iv, auth_tag, chain_id }
 *      into Supabase public.agent_wallets
 *
 * On subsequent calls:
 *   1. Load { ciphertext, iv, auth_tag } from Supabase
 *   2. decrypt(…)           — recover the raw private key
 *   3. privateKeyToAccount(privateKey) — return a live viem LocalAccount
 *
 * The returned `account` can be used to construct a viem WalletClient:
 *
 *   const client = createWalletClient({
 *     account,
 *     chain: config.chain,
 *     transport: http(config.chain.rpcUrls.default.http[0]),
 *   })
 *
 * This module is server-only. Never import from client components.
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import type { PrivateKeyAccount } from 'viem/accounts'
import type { Hex } from 'viem'

import { encrypt, decrypt } from '@/lib/agent-wallet/crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { DEFAULT_CHAIN_ID } from '@/lib/chain-registry'

// ── Types ────────────────────────────────────────────────────────────────────

export interface AgentWallet {
  /** The burner EOA's EVM address (lowercase) */
  address: string
  /** Live viem LocalAccount ready for signing */
  account: PrivateKeyAccount
  /** Raw private key — server-only, never send to the client */
  privateKey: Hex
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalises an EVM address to lowercase for consistent Supabase comparisons. */
function normalise(addr: string): string {
  return addr.toLowerCase()
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the agent wallet for `userWallet`, creating it if it doesn't exist.
 *
 * @param userWallet — The authenticated user's EVM address.
 * @param chainId    — Chain to associate with this wallet (default: HashKey Chain, 177/133).
 */
export async function getOrCreateAgentWallet(
  userWallet: string,
  chainId: number = DEFAULT_CHAIN_ID,
): Promise<AgentWallet> {
  const normalised = normalise(userWallet)
  const supabase = createSupabaseAdminClient()

  // ── Try to load existing record ──────────────────────────
  const { data: existing, error: loadErr } = await supabase
    .from('agent_wallets')
    .select('agent_address, ciphertext, iv, auth_tag')
    .eq('user_wallet', normalised)
    .maybeSingle()

  if (loadErr) {
    throw new Error(`Failed to load agent wallet: ${loadErr.message}`)
  }

  if (existing) {
    const privateKey = decrypt({
      ct: existing.ciphertext,
      iv: existing.iv,
      tag: existing.auth_tag,
    }) as Hex

    const account = privateKeyToAccount(privateKey)
    return { address: normalise(account.address), account, privateKey }
  }

  // ── Create a new burner wallet ───────────────────────────
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  const agentAddress = normalise(account.address)

  const enc = encrypt(privateKey)

  const { error: upsertErr } = await supabase
    .from('agent_wallets')
    .upsert(
      {
        user_wallet:   normalised,
        agent_address: agentAddress,
        ciphertext:    enc.ct,
        iv:            enc.iv,
        auth_tag:      enc.tag,
        chain_id:      chainId,
      },
      { onConflict: 'user_wallet' },
    )

  if (upsertErr) {
    throw new Error(`Failed to persist agent wallet: ${upsertErr.message}`)
  }

  return { address: agentAddress, account, privateKey }
}

/**
 * Returns the stored agent wallet address for `userWallet` without decrypting
 * the private key — useful for balance checks and display.
 *
 * Returns `null` if no wallet has been initialised yet.
 */
export async function getAgentAddress(
  userWallet: string,
): Promise<string | null> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('agent_wallets')
    .select('agent_address')
    .eq('user_wallet', normalise(userWallet))
    .maybeSingle()

  if (error) throw new Error(`Failed to query agent wallet: ${error.message}`)
  return data ? normalise(data.agent_address) : null
}
