import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const adminClientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
} as const

/** Use for optional reads (e.g. marketplace lists) when DB may be unset in local dev. */
export function tryCreateSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null
  return createClient(url, serviceRoleKey, adminClientOptions)
}

export function createSupabaseAdminClient(): SupabaseClient {
  const client = tryCreateSupabaseAdminClient()
  if (!client) {
    throw new Error(
      'Missing Supabase env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    )
  }
  return client
}
