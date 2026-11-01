/**
 * /api/user-settings
 *
 * GET  — Returns the user's agent settings (model, mode) without exposing
 *         the encrypted API key.
 *
 * PUT  — Upserts the user's settings. If an `apiKey` string is provided in the
 *         body, it is encrypted server-side before storage.
 *
 * Request body for PUT (JSON, all fields optional):
 *   {
 *     apiKey?  : string   — OpenRouter API key (stored encrypted; never returned)
 *     model?   : string   — OpenRouter model slug
 *     mode?    : "autonomous" | "assisted" | "solo"
 *   }
 *
 * Auth: x-wallet-address header (requireWallet helper).
 */

import { type NextRequest, NextResponse } from 'next/server'

import { requireWallet } from '@/lib/marketplace/wallet-header'
import { encrypt } from '@/lib/agent-wallet/crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

const VALID_MODES = ['autonomous', 'assisted', 'solo'] as const
type Mode = (typeof VALID_MODES)[number]

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const userWallet = requireWallet(req)
  if (userWallet instanceof Response) return userWallet

  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('user_settings')
      .select('model, mode, updated_at, api_key_ct')
      .eq('user_wallet', userWallet.toLowerCase())
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ model: null, mode: null, hasApiKey: false })
    }

    return NextResponse.json({
      model: data.model,
      mode: data.mode,
      hasApiKey: !!data.api_key_ct,
      updatedAt: data.updated_at,
    })
  } catch (e) {
    return jsonError(e)
  }
}

// ── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const userWallet = requireWallet(req)
  if (userWallet instanceof Response) return userWallet

  let body: { apiKey?: string; model?: string; mode?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.mode && !VALID_MODES.includes(body.mode as Mode)) {
    return NextResponse.json(
      { error: `mode must be one of: ${VALID_MODES.join(', ')}` },
      { status: 400 },
    )
  }

  try {
    const supabase = createSupabaseAdminClient()

    // Build the upsert payload — only include fields that were provided
    const update: Record<string, unknown> = {
      user_wallet: userWallet.toLowerCase(),
    }

    if (body.model) update.model = body.model
    if (body.mode) update.mode = body.mode

    if (body.apiKey) {
      const enc = encrypt(body.apiKey)
      update.api_key_ct = enc.ct
      update.api_key_iv = enc.iv
      update.api_key_tag = enc.tag
    }

    const { error } = await supabase
      .from('user_settings')
      .upsert(update, { onConflict: 'user_wallet' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonError(e)
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function jsonError(e: unknown): NextResponse {
  const msg = e instanceof Error ? e.message : String(e)
  return NextResponse.json({ error: msg }, { status: 500 })
}
