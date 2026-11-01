/** True when PostgREST reports a missing relation / schema cache (migration not applied). */
export function isSupabaseSchemaUnavailableError(error: {
  code?: string | null
  message?: string | null
} | null): boolean {
  if (!error) return false
  const code = error.code ?? ''
  const msg = (error.message ?? '').toLowerCase()
  if (code === 'PGRST205' || code === '42P01') return true
  if (msg.includes('schema cache')) return true
  if (
    msg.includes('does not exist') &&
    (msg.includes('relation') || msg.includes('table'))
  ) {
    return true
  }
  return false
}
