"use client"

import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"
import {
  ArrowLeft,
  Bookmark,
  Flag,
  TrendingUp,
  BarChart2,
  ShieldCheck,
  Layers,
  Calendar,
  ExternalLink,
} from "lucide-react"
import { useWallet } from "@/hooks/use-wallet"
import { normalizeWalletAddress } from "@/lib/onboarding"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BuyPanel } from "@/components/marketplace/buy-panel"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

type StrategyDetail = {
  strategy: {
    id: string
    name: string
    description?: string | null
    status: string
    creator_wallet: string
    creator_handle?: string | null
    is_free?: boolean | null
    price_amount?: number | null
    price_token?: string | null
    risk_level?: string | null
    tags?: unknown
    asset_pairs?: unknown
    created_at: string
  }
  currentVersion: {
    id: string
    version_number: number
    human_summary?: string | null
    created_at: string
    zerog_root_hash?: string | null
  } | null
  versions: {
    id: string
    version_number: number
    created_at: string
  }[]
  indicatorRefs: { id: string; name: string; version_number: number }[]
  sampleReceipts: { id: string; tx_hash?: string }[]
  activationCount: number
  backtestRuns: { id: string; summary: unknown; created_at: string }[]
  alphaMetrics?: {
    win_rate_pct: number | null
    total_trades: number
    avg_alpha: number | null
    max_drawdown_pct: number | null
    avg_profit_pct?: number | null
  } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(a: string) {
  if (!a || a.length < 10) return a
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function fmtPct(v: number | null | undefined, signed = false): string {
  if (v == null) return "—"
  return `${signed && v > 0 ? "+" : ""}${v.toFixed(1)}%`
}

function fmtCount(n: number | null | undefined): string {
  if (n == null) return "—"
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    published: {
      label: "Verified",
      className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    },
    live_eligible: {
      label: "Live Eligible",
      className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    },
    watch: {
      label: "Watch",
      className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    },
    paper_only: {
      label: "Paper",
      className: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    },
  }
  const entry = map[status]
  if (!entry) return null
  return (
    <Badge className={cn("hover:bg-transparent", entry.className)}>
      {entry.label}
    </Badge>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  valueClass?: string
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex items-center gap-1.5 text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <span
        className={cn(
          "text-2xl font-bold tabular-nums tracking-tight",
          valueClass ?? "text-zinc-100",
        )}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-zinc-500">{sub}</span>}
    </div>
  )
}

// ── Alpha dot row ─────────────────────────────────────────────────────────────

function AlphaDots({ score }: { score: number | null | undefined }) {
  const filled = score == null ? 0 : Math.min(5, Math.round((score / 10) * 5))
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            i < filled ? "bg-violet-400" : "bg-zinc-700",
          )}
        />
      ))}
      <span className="ml-1 text-xs text-zinc-400">
        {score != null ? score.toFixed(1) : "—"} / 10
      </span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StrategyDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { address } = useWallet()
  const wallet = address ? normalizeWalletAddress(address) : null
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ["strategy-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/strategies/${id}`)
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<StrategyDetail>
    },
  })

  const { data: accessData } = useQuery({
    queryKey: ["strategy-access", id, wallet],
    queryFn: async () => {
      if (!wallet) return null
      const res = await fetch(`/api/marketplace/strategies/${id}/access`, {
        headers: { "x-wallet-address": wallet },
      })
      if (!res.ok) return null
      return res.json() as Promise<{
        hasAccess: boolean
        isPaid: boolean
        price?: number | null
        priceToken?: string | null
      }>
    },
    enabled: !!wallet,
  })

  const [activateOpen, setActivateOpen] = useState(false)
  const [mode, setMode] = useState("research")
  const [reportReason, setReportReason] = useState("")
  const [reportOpen, setReportOpen] = useState(false)
  const [bookmarkDone, setBookmarkDone] = useState(false)

  const activateMut = useMutation({
    mutationFn: async () => {
      if (!wallet || !data?.currentVersion?.id) throw new Error("Missing")
      const res = await fetch("/api/activations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": wallet,
        },
        body: JSON.stringify({
          strategy_id: id,
          strategy_version_id: data.currentVersion.id,
          mode,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{ id: string }>
    },
    onSuccess: (r) => {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("omeswap_activation_id", r.id)
        sessionStorage.setItem(
          "omeswap_strategy_version_id",
          String(data?.currentVersion?.id ?? ""),
        )
      }
      setActivateOpen(false)
      qc.invalidateQueries({ queryKey: ["library-activations"] })
    },
  })

  const bookmarkMut = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("Connect wallet")
      const res = await fetch("/api/marketplace/bookmarks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": wallet,
        },
        body: JSON.stringify({ strategy_id: id }),
      })
      if (!res.ok) throw new Error(await res.text())
    },
    onSuccess: () => setBookmarkDone(true),
  })

  const reportMut = useMutation({
    mutationFn: async () => {
      if (!wallet || !reportReason.trim()) throw new Error("Reason required")
      const res = await fetch("/api/marketplace/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": wallet,
        },
        body: JSON.stringify({
          target_type: "strategy",
          target_id: id,
          reason: reportReason.trim(),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
    },
    onSuccess: () => setReportOpen(false),
  })

  if (isLoading) {
    return (
      <div className="container max-w-5xl mx-auto px-4 pt-24 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40"
          />
        ))}
      </div>
    )
  }

  if (error || !data?.strategy) {
    return (
      <div className="container max-w-5xl mx-auto px-4 pt-24 text-red-400 text-sm">
        {(error as Error)?.message ?? "Strategy not found"}
      </div>
    )
  }

  const s = data.strategy
  const st = s.status
  const alpha = data.alphaMetrics
  const isFree = s.is_free !== false
  const hasAccess = isFree || accessData?.hasAccess === true
  const isNew =
    Date.now() - new Date(s.created_at).getTime() < 14 * 24 * 60 * 60 * 1000
  const creatorLabel = s.creator_handle ?? shortAddr(s.creator_wallet)
  const pairs = (s.asset_pairs as string[] | null) ?? []
  const tags = (s.tags as string[] | null) ?? []
  const regimeTags = tags.filter((t) =>
    ["bull", "bear", "sideways", "volatile", "ranging"].includes(t.toLowerCase()),
  )

  return (
    <div className="container max-w-5xl mx-auto px-4 pt-24 pb-16">
      {/* Back link */}
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Marketplace
      </Link>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="space-y-2">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            {statusBadge(st)}
            {isNew && (
              <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/30">
                New
              </Badge>
            )}
            {isFree ? (
              <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/30">
                Free
              </Badge>
            ) : (
              <Badge className="bg-orange-500/15 text-orange-300 border-orange-500/30">
                {s.price_amount ?? ""}{" "}
                {s.price_token && s.price_token !== "free"
                  ? s.price_token
                  : "OG"}
              </Badge>
            )}
            {data.activationCount > 0 && (
              <Badge
                variant="outline"
                className="border-zinc-700 text-zinc-400"
              >
                {data.activationCount} active
              </Badge>
            )}
          </div>

          <h1 className="text-2xl font-semibold text-zinc-100 leading-tight">
            {s.name}
          </h1>

          {/* Creator */}
          <p className="text-sm text-zinc-500">
            by <span className="text-zinc-300 font-medium">{creatorLabel}</span>
          </p>

          {/* Asset pairs */}
          {pairs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pairs.map((p) => (
                <Badge
                  key={p}
                  variant="outline"
                  className="border-zinc-700 text-xs text-zinc-300"
                >
                  {p}
                </Badge>
              ))}
            </div>
          )}

          {/* Regimes */}
          {regimeTags.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <span>Regime:</span>
              {regimeTags.map((r) => (
                <span key={r} className="capitalize text-zinc-400">
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2" id="activate">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5 border-zinc-700 h-9",
              bookmarkDone && "border-amber-500 text-amber-400",
            )}
            disabled={!wallet || bookmarkMut.isPending}
            onClick={() => void bookmarkMut.mutate()}
          >
            <Bookmark className="h-4 w-4" />
            {bookmarkDone ? "Bookmarked" : "Bookmark"}
          </Button>
          {hasAccess && (
            <Button
              size="sm"
              className="h-9 bg-violet-600 hover:bg-violet-500 text-white"
              onClick={() => setActivateOpen(true)}
              disabled={!wallet}
            >
              Activate
            </Button>
          )}
        </div>
      </div>

      {/* ── Performance stat tiles ───────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
        <StatTile
          icon={TrendingUp}
          label="Win Rate"
          value={fmtPct(alpha?.win_rate_pct)}
          valueClass={
            alpha?.win_rate_pct != null
              ? alpha.win_rate_pct >= 50
                ? "text-emerald-400"
                : "text-red-400"
              : "text-zinc-100"
          }
        />
        <StatTile
          icon={BarChart2}
          label="Total Trades"
          value={fmtCount(alpha?.total_trades)}
        />
        <StatTile
          icon={TrendingUp}
          label="Avg Profit"
          value={fmtPct(alpha?.avg_profit_pct, true)}
          valueClass={
            (alpha?.avg_profit_pct ?? 0) >= 0
              ? "text-emerald-400"
              : "text-red-400"
          }
        />
        <StatTile
          icon={ShieldCheck}
          label="Max Drawdown"
          value={fmtPct(alpha?.max_drawdown_pct)}
          valueClass={alpha?.max_drawdown_pct != null ? "text-red-400" : "text-zinc-100"}
        />
      </div>

      {/* Alpha score row */}
      {alpha?.avg_alpha != null && (
        <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Alpha Score
              </p>
              <p className="text-lg font-bold text-zinc-100">
                {alpha.avg_alpha.toFixed(1)}
              </p>
              <AlphaDots score={alpha.avg_alpha} />
            </div>
            {s.risk_level && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Risk Level
                </p>
                <p
                  className={cn(
                    "text-lg font-bold capitalize",
                    s.risk_level === "low" && "text-emerald-400",
                    s.risk_level === "medium" && "text-amber-400",
                    s.risk_level === "high" && "text-red-400",
                  )}
                >
                  {s.risk_level}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Two-column layout ────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Left column ──────────────────────────────────────────── */}
        <div className="space-y-8 min-w-0">
          {/* Human summary */}
          {data.currentVersion?.human_summary && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-200">
                Strategy Summary
              </h2>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {data.currentVersion.human_summary}
              </div>
              <p className="text-[10px] text-zinc-600">
                AI-generated summary. Strategy logic is encrypted and not
                publicly accessible.
              </p>
            </section>
          )}

          {/* Description */}
          {s.description && !data.currentVersion?.human_summary && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-zinc-200">
                Description
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {s.description}
              </p>
            </section>
          )}

          {/* Performance tabs */}
          <section>
            <Tabs defaultValue="backtest">
              <TabsList className="bg-zinc-900 border border-zinc-800">
                <TabsTrigger value="backtest">Backtest</TabsTrigger>
                <TabsTrigger value="paper" disabled className="opacity-50">
                  Paper
                </TabsTrigger>
                <TabsTrigger value="live">Live</TabsTrigger>
              </TabsList>
              <TabsContent value="backtest" className="mt-4">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <p className="text-xs text-zinc-500 mb-3">
                    Backtest results — historical simulation. Past performance
                    does not guarantee future results.
                  </p>
                  {data.backtestRuns.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No backtest runs recorded yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {data.backtestRuns.map((b) => {
                        const summary = b.summary as Record<string, unknown>
                        return (
                          <li
                            key={b.id}
                            className="rounded-lg border border-zinc-800 p-3 text-xs font-mono text-zinc-400"
                          >
                            <div className="flex justify-between text-zinc-500 mb-2">
                              <span>Run</span>
                              <span>
                                {new Date(b.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            {typeof summary === "object" && summary ? (
                              <div className="grid grid-cols-2 gap-1">
                                {Object.entries(summary)
                                  .slice(0, 6)
                                  .map(([k, v]) => (
                                    <div key={k}>
                                      <span className="text-zinc-600">
                                        {k}:{" "}
                                      </span>
                                      <span className="text-zinc-300">
                                        {String(v)}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <span>{JSON.stringify(b.summary)}</span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="live" className="mt-4">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <p className="text-xs text-zinc-500">
                    Live metrics aggregate from decision receipts across all
                    activations. Open My Library after activating to view
                    individual receipts.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </section>

          {/* Indicator dependencies */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-zinc-500" />
              Indicator Dependencies
            </h2>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
              {data.indicatorRefs.length === 0 ? (
                <p className="text-sm text-zinc-500">None listed</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.indicatorRefs.map((r) => (
                    <li
                      key={`${r.id}-${r.version_number}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <Link
                        href={`/marketplace/indicators/${r.id}`}
                        className="flex items-center gap-1 text-cyan-400 hover:underline"
                      >
                        {r.name}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                      <span className="text-xs text-zinc-600">
                        v{r.version_number}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Sample receipts */}
          {data.sampleReceipts.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-200">
                Sample Receipts
              </h2>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                <ul className="space-y-1.5 text-xs font-mono text-zinc-500">
                  {data.sampleReceipts.map((r) => (
                    <li key={r.id} className="truncate">
                      {r.tx_hash ?? r.id}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] text-zinc-600">
                  Outcome hashes only — no signal internals are exposed.
                </p>
              </div>
            </section>
          )}

          {/* Version history */}
          {data.versions.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-zinc-500" />
                Version History
              </h2>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 divide-y divide-zinc-800">
                {data.versions.map((v) => (
                  <div
                    key={v.id}
                    className={cn(
                      "flex items-center justify-between p-3 text-sm",
                      v.id === data.currentVersion?.id && "bg-zinc-900/40",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-300 font-medium">
                        v{v.version_number}
                      </span>
                      {v.id === data.currentVersion?.id && (
                        <Badge
                          variant="outline"
                          className="border-violet-500 text-violet-300 text-xs"
                        >
                          current
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-zinc-500">
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Report */}
          <section className="space-y-3">
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <Flag className="h-3.5 w-3.5" />
              Report this listing
            </button>
          </section>
        </div>

        {/* ── Right column: BuyPanel / Activate panel ──────────────── */}
        <div className="space-y-4">
          <BuyPanel
            strategyId={id}
            strategyName={s.name}
            isFree={isFree}
            priceAmount={s.price_amount}
            priceToken={s.price_token}
            currentVersionId={data.currentVersion?.id}
            onPurchaseVerified={() =>
              qc.invalidateQueries({ queryKey: ["strategy-access", id, wallet] })
            }
          />

          {/* Quick info */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-2 text-xs text-zinc-400">
            <div className="flex justify-between">
              <span className="text-zinc-500">Activations</span>
              <span className="text-zinc-200 font-medium">
                {data.activationCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Versions</span>
              <span className="text-zinc-200 font-medium">
                {data.versions.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Published</span>
              <span className="text-zinc-200">
                {new Date(s.created_at).toLocaleDateString()}
              </span>
            </div>
            {data.currentVersion?.zerog_root_hash && (
              <div className="flex justify-between items-start gap-2">
                <span className="text-zinc-500 shrink-0">0G Hash</span>
                <span className="font-mono text-[10px] text-zinc-500 truncate">
                  {data.currentVersion.zerog_root_hash.slice(0, 20)}…
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Activate dialog ──────────────────────────────────────────── */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent className="border-zinc-700 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Activate strategy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Activating <strong className="text-zinc-200">{s.name}</strong>{" "}
              will create an activation you can run in the Agent Builder.
            </p>
            <div>
              <Label className="text-xs text-zinc-400">Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="border-zinc-700 bg-zinc-900 mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="research">Research</SelectItem>
                  <SelectItem
                    value="live"
                    disabled={st !== "live_eligible"}
                  >
                    Live{st !== "live_eligible" && " (requires live eligible)"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {activateMut.error && (
              <p className="text-xs text-red-400">
                {(activateMut.error as Error).message}
              </p>
            )}
            {activateMut.isSuccess && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
                Activated! Open Agent Builder to run this strategy.
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setActivateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={
                  activateMut.isPending ||
                  !data.currentVersion ||
                  activateMut.isSuccess
                }
                onClick={() => void activateMut.mutate()}
                className="bg-violet-600 hover:bg-violet-500"
              >
                {activateMut.isPending ? "Activating…" : "Confirm"}
              </Button>
            </div>
            <p className="text-[10px] text-zinc-600">
              After activation, open Agent Builder to run with this strategy.
              Session stores the activation ID for receipts.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Report dialog ────────────────────────────────────────────── */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="border-zinc-700 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-red-400" />
              Report listing
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              className="w-full min-h-[100px] rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              placeholder="Describe the issue…"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setReportOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={
                  !wallet || reportMut.isPending || !reportReason.trim()
                }
                onClick={() => void reportMut.mutate()}
              >
                Submit report
              </Button>
            </div>
            {reportMut.error && (
              <p className="text-xs text-red-400">
                {(reportMut.error as Error).message}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
