import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Ensure a row exists in creators for this wallet (required FK for strategies/indicators).
 */
export async function ensureCreator(
  supabase: SupabaseClient,
  wallet: string,
  handle?: string | null,
): Promise<void> {
  await supabase.from('creators').upsert(
    {
      wallet_address: wallet,
      handle: handle ?? null,
    },
    { onConflict: 'wallet_address' },
  )
}
