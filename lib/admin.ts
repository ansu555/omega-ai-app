/**
 * Comma-separated list of lowercase wallet addresses allowed to call admin APIs.
 */
export function parseAdminWallets(): Set<string> {
  const raw = process.env.ADMIN_WALLETS ?? ''
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function isAdminWallet(wallet: string | null | undefined): boolean {
  if (!wallet) return false
  return parseAdminWallets().has(wallet.toLowerCase())
}
