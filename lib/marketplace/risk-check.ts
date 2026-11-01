import type { SupabaseClient } from '@supabase/supabase-js'

export type ActivationRow = {
  id: string
  user_wallet: string
  max_trades_per_day: number
  max_daily_loss_pct: number
  strategy_version_id: string
}

function startOfUtcDay(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export async function evaluateActivationRisk(
  supabase: SupabaseClient,
  activation: ActivationRow,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const start = startOfUtcDay().toISOString()

  const { data: receipts, error } = await supabase
    .from('decision_receipts')
    .select('status, pnl_native')
    .eq('activation_id', activation.id)
    .gte('opened_at', start)

  if (error) {
    return { ok: false, reason: error.message }
  }

  const rows = receipts ?? []
  const tradeLike = rows.filter((r) =>
    ['confirmed', 'filled', 'success', 'simulated'].includes(
      String(r.status ?? ''),
    ),
  )
  if (tradeLike.length >= activation.max_trades_per_day) {
    return { ok: false, reason: 'Daily max trades exceeded' }
  }

  let pnlSum = 0
  for (const r of rows) {
    const p = parseFloat(String(r.pnl_native ?? '0'))
    if (!Number.isNaN(p)) pnlSum += p
  }
  if (pnlSum < -Math.abs(activation.max_daily_loss_pct)) {
    return { ok: false, reason: 'Daily loss limit breached' }
  }

  return { ok: true }
}
