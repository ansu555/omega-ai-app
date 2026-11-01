"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

export type AlphaMetrics = {
  total_trades: number
  win_rate_pct: number | null
  avg_alpha: number | null
  max_drawdown_pct: number | null
  avg_profit_pct?: number | null
}

export type StrategyCardV2Data = {
  id: string
  name: string
  slug?: string | null
  description?: string | null
  tags?: unknown
  asset_pairs?: unknown
  risk_level?: string | null
  status: string
  creator_wallet: string
  creator_handle?: string | null
  is_free?: boolean | null
  price_amount?: number | null
  price_token?: string | null
  activation_count?: number
  alpha?: AlphaMetrics | null
  /** Set to true for the Platform Pick section in the Marketplace home. */
  is_platform_pick?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(a: string) {
  if (!a || a.length < 10) return a
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function fmtPct(v: number | null | undefined, signed = false) {
  if (v == null) return "—"
  const s = signed && v > 0 ? "+" : ""
  return `${s}${v.toFixed(1)}%`
}

function fmtCount(n: number | null | undefined) {
  if (n == null) return "—"
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

/** Returns number of filled dots (0–5) from an avg_alpha score (0–10 scale). */
function alphaDots(avg_alpha: number | null | undefined): number {
  if (avg_alpha == null) return 0
  return Math.min(5, Math.max(0, Math.round((avg_alpha / 10) * 5)))
}

function statusBadge(status: string) {
  if (status === "published" || status === "live_eligible") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
        Verified
      </Badge>
    )
  }
  if (status === "watch") {
    return (
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
        Watch
      </Badge>
    )
  }
  if (status === "paper_only") {
    return (
      <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30 hover:bg-sky-500/20">
        Paper
      </Badge>
    )
  }
  return null
}

function priceBadge(is_free: boolean | null | undefined, price_amount: number | null | undefined, price_token: string | null | undefined) {
  if (is_free !== false) {
    return (
      <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/30 hover:bg-violet-500/20">
        Free
      </Badge>
    )
  }
  const token = price_token && price_token !== "free" ? price_token : "OG"
  const amount = price_amount ?? 0
  return (
    <Badge className="bg-orange-500/15 text-orange-300 border-orange-500/30 hover:bg-orange-500/20">
      {amount} {token}
    </Badge>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums text-zinc-200", valueClass)}>
        {value}
      </span>
    </div>
  )
}

// ── Alpha dot row ─────────────────────────────────────────────────────────────

function AlphaDotRow({ score }: { score: number | null | undefined }) {
  const filled = alphaDots(score)
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 w-2 rounded-full",
            i < filled ? "bg-violet-400" : "bg-zinc-700",
          )}
        />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function StrategyCardV2({ s }: { s: StrategyCardV2Data }) {
  const pairs = (s.asset_pairs as string[] | null) ?? []
  const tags = (s.tags as string[] | null) ?? []
  const creatorLabel = s.creator_handle ?? shortAddr(s.creator_wallet)
  const href = `/marketplace/strategies/${s.id}`

  const winRate = fmtPct(s.alpha?.win_rate_pct)
  const drawdown = fmtPct(s.alpha?.max_drawdown_pct, false)
  const alphaScore =
    s.alpha?.avg_alpha != null ? s.alpha.avg_alpha.toFixed(1) : "—"
  const trades = fmtCount(s.alpha?.total_trades)
  const avgProfit =
    s.alpha?.avg_profit_pct != null
      ? fmtPct(s.alpha.avg_profit_pct, true)
      : null

  const extraPairs = pairs.length > 2 ? pairs.length - 2 : 0

  const regimeTags = tags.filter((t) =>
    ["bull", "bear", "sideways", "volatile", "ranging"].includes(
      t.toLowerCase(),
    ),
  )

  const isFree = s.is_free !== false

  return (
    <Card className="group flex flex-col border-zinc-800 bg-zinc-950/80 backdrop-blur transition-colors hover:border-zinc-700">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <CardHeader className="pb-2 pt-4">
        {/* Badge row */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {s.is_platform_pick && (
            <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/20">
              Platform Pick
            </Badge>
          )}
          {statusBadge(s.status)}
          {priceBadge(s.is_free, s.price_amount, s.price_token)}
        </div>

        {/* Title */}
        <Link
          href={href}
          className="line-clamp-1 text-base font-semibold text-zinc-100 transition-colors hover:text-white"
        >
          {s.name}
        </Link>

        {/* Creator */}
        <p className="mt-0.5 text-xs text-zinc-500">
          by{" "}
          <span className="text-zinc-400">{creatorLabel}</span>
        </p>
      </CardHeader>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <CardContent className="flex flex-1 flex-col gap-3 pb-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <StatTile
            label="Win Rate"
            value={winRate}
            valueClass={
              s.alpha?.win_rate_pct != null
                ? s.alpha.win_rate_pct >= 50
                  ? "text-emerald-400"
                  : "text-red-400"
                : undefined
            }
          />
          <StatTile label="Trades" value={trades} />
          {avgProfit !== null ? (
            <StatTile
              label="Avg Profit"
              value={avgProfit}
              valueClass={
                (s.alpha?.avg_profit_pct ?? 0) >= 0
                  ? "text-emerald-400"
                  : "text-red-400"
              }
            />
          ) : (
            <StatTile
              label="Drawdown"
              value={drawdown}
              valueClass={
                s.alpha?.max_drawdown_pct != null
                  ? "text-red-400"
                  : undefined
              }
            />
          )}
          {/* Alpha score + dots */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Alpha</span>
            <span className="text-sm font-semibold tabular-nums text-zinc-200">
              {alphaScore}
            </span>
            <AlphaDotRow score={s.alpha?.avg_alpha} />
          </div>
        </div>

        {/* Show drawdown in a second row when avg_profit is present */}
        {avgProfit !== null && (
          <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
            <StatTile
              label="Drawdown"
              value={drawdown}
              valueClass={
                s.alpha?.max_drawdown_pct != null ? "text-red-400" : undefined
              }
            />
            <StatTile
              label="Activations"
              value={fmtCount(s.activation_count)}
            />
          </div>
        )}

        {/* Asset pairs */}
        {pairs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {pairs.slice(0, 2).map((p) => (
              <Badge
                key={p}
                variant="outline"
                className="border-zinc-700 text-xs text-zinc-300"
              >
                {p}
              </Badge>
            ))}
            {extraPairs > 0 && (
              <span className="text-xs text-zinc-500">+{extraPairs}</span>
            )}
          </div>
        )}

        {/* Risk + regime tags */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
          {s.risk_level && (
            <span className="capitalize">
              Risk:{" "}
              <span
                className={cn(
                  "font-medium",
                  s.risk_level === "low" && "text-emerald-400",
                  s.risk_level === "medium" && "text-amber-400",
                  s.risk_level === "high" && "text-red-400",
                )}
              >
                {s.risk_level.charAt(0).toUpperCase() + s.risk_level.slice(1)}
              </span>
            </span>
          )}
          {regimeTags.map((t) => (
            <span key={t} className="capitalize text-zinc-400">
              · {t.charAt(0).toUpperCase() + t.slice(1)}
            </span>
          ))}
        </div>
      </CardContent>

      {/* ── Actions ────────────────────────────────────────────────── */}
      <CardFooter className="gap-2 pb-4">
        <Button asChild size="sm" variant="secondary" className="h-8">
          <Link href={href}>View</Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant={isFree ? "outline" : "default"}
          className={cn(
            "h-8",
            isFree
              ? "border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
              : "bg-violet-600 text-white hover:bg-violet-500",
          )}
        >
          <Link href={isFree ? `${href}#activate` : `${href}#buy`}>
            {isFree
              ? "Use Free"
              : `Buy ${s.price_amount ?? ""} ${s.price_token && s.price_token !== "free" ? s.price_token : "OG"}`.trim()}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
