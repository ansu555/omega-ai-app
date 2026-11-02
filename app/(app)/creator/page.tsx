"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import {
  Zap,
  ShoppingBag,
  Coins,
  PenLine,
  Eye,
  BarChart2,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCode2,
  ArrowRight,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useWallet } from "@/hooks/use-wallet"
import { normalizeWalletAddress } from "@/lib/onboarding"

// ── Types ─────────────────────────────────────────────────────────────────────

type StrategyRow = {
  id: string
  name: string
  status: string
  created_at: string
  updated_at: string
  current_version_id: string | null
  // enriched below
  win_rate_pct?: number | null
  activation_count?: number
  purchase_count?: number
  earnings?: number | null
  is_free?: boolean | null
  price_token?: string | null
}

type IndicatorRow = {
  id: string
  name: string
  status: string
  created_at: string
  updated_at: string
  current_version_id: string | null
  used_by_count?: number
}

type DashboardData = {
  strategies: StrategyRow[]
  indicators: IndicatorRow[]
  activationCount: number
  purchaseCount?: number
  totalEarnings?: number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    published: {
      label: "Published",
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
    draft: {
      label: "Draft",
      className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    },
    pending: {
      label: "Pending",
      className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    },
  }
  const entry = map[status] ?? {
    label: status.replace("_", " "),
    className: "border-zinc-700 text-zinc-500",
  }
  return (
    <Badge className={cn("text-xs hover:bg-transparent capitalize", entry.className)}>
      {entry.label}
    </Badge>
  )
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—"
  return `${v.toFixed(1)}%`
}

function fmtCount(n: number | null | undefined): string {
  if (n == null || n === 0) return "0"
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  iconClass,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
  iconClass?: string
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 space-y-2">
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg",
          iconClass ?? "bg-zinc-800",
        )}
      >
        <Icon className="h-4 w-4 text-zinc-300" />
      </div>
      <div>
        <p className="text-2xl font-bold text-zinc-100 tabular-nums">
          {value}
        </p>
        <p className="text-xs text-zinc-500">{label}</p>
        {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Table skeleton ────────────────────────────────────────────────────────────

function TableSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "grid gap-4 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 animate-pulse",
            cols === 5 ? "grid-cols-5" : "grid-cols-4",
          )}
        >
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-4 rounded bg-zinc-800" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CreatorDashboardPage() {
  const { address } = useWallet()
  const wallet = address ? normalizeWalletAddress(address) : null

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["creator-dashboard", wallet],
    queryFn: async () => {
      if (!wallet) throw new Error("Wallet not connected")
      const res = await fetch("/api/creator/dashboard", {
        headers: { "x-wallet-address": wallet },
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    enabled: !!wallet,
  })

  if (!wallet) {
    return (
      <div className="container max-w-5xl mx-auto px-4 pt-24 pb-16 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800">
            <FileCode2 className="h-6 w-6 text-zinc-400" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-100">Creator Dashboard</h1>
          <p className="text-sm text-zinc-400 max-w-sm">
            Connect your wallet to view your strategies, indicators, and earnings.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-5xl mx-auto px-4 pt-24 pb-16">
        <p className="text-sm text-red-400">{(error as Error).message}</p>
      </div>
    )
  }

  const strategies = data?.strategies ?? []
  const indicators = data?.indicators ?? []
  const activationCount = data?.activationCount ?? 0
  const purchaseCount = data?.purchaseCount ?? 0
  const totalEarnings = data?.totalEarnings ?? null

  // Separate drafts from published
  const published = strategies.filter((s) =>
    ["published", "live_eligible", "paper_only", "watch"].includes(s.status),
  )
  const drafts = strategies.filter(
    (s) => !["published", "live_eligible", "paper_only", "watch"].includes(s.status),
  )

  return (
    <div className="container max-w-5xl mx-auto px-4 pt-24 pb-16 space-y-8">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">
            Creator Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage your strategies and indicators
          </p>
        </div>
        <Button
          asChild
          className="gap-1.5 bg-violet-600 hover:bg-violet-500 text-white"
        >
          <Link href="/agent-builder">
            <PenLine className="h-4 w-4" />
            Open Builder
          </Link>
        </Button>
      </div>

      {/* ── Metrics bar ──────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={BarChart2}
            label="Published strategies"
            value={published.length}
            iconClass="bg-violet-600/20"
          />
          <MetricCard
            icon={Zap}
            label="Total activations"
            value={fmtCount(activationCount)}
            sub="Across all strategies"
            iconClass="bg-sky-600/20"
          />
          <MetricCard
            icon={ShoppingBag}
            label="Total purchases"
            value={fmtCount(purchaseCount)}
            iconClass="bg-emerald-600/20"
          />
          <MetricCard
            icon={Coins}
            label="Total earnings"
            value={totalEarnings != null ? `${totalEarnings}` : "—"}
            sub={totalEarnings != null ? "across paid strategies" : "No paid strategies yet"}
            iconClass="bg-amber-600/20"
          />
        </div>
      )}

      {/* ── Tabs: Strategies | Indicators ────────────────────────────── */}
      <Tabs defaultValue="strategies">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="strategies">
            Strategies
            {strategies.length > 0 && (
              <Badge
                variant="outline"
                className="ml-1.5 border-zinc-700 text-zinc-500 text-[10px] h-4 px-1"
              >
                {strategies.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="indicators">
            Indicators
            {indicators.length > 0 && (
              <Badge
                variant="outline"
                className="ml-1.5 border-zinc-700 text-zinc-500 text-[10px] h-4 px-1"
              >
                {indicators.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Strategies tab ───────────────────────────────────────── */}
        <TabsContent value="strategies" className="space-y-6 mt-4">
          {/* Published strategies */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">
                Published
              </h2>
              {published.length > 0 && (
                <span className="text-xs text-zinc-500">
                  {published.length} strateg{published.length === 1 ? "y" : "ies"}
                </span>
              )}
            </div>

            {isLoading ? (
              <TableSkeleton cols={6} />
            ) : published.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center">
                <p className="text-sm text-zinc-500">
                  No published strategies yet.
                </p>
                <Button
                  asChild
                  variant="link"
                  className="mt-2 text-violet-400 hover:text-violet-300"
                >
                  <Link href="/agent-builder">Build your first strategy →</Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      {[
                        "Name",
                        "Status",
                        "Win Rate",
                        "Activations",
                        "Purchases",
                        "Actions",
                      ].map((h) => (
                        <th
                          key={h}
                          className="pb-2 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-600 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {published.map((s) => (
                      <tr
                        key={s.id}
                        className="group hover:bg-zinc-900/30 transition-colors"
                      >
                        <td className="py-3 pr-4 font-medium text-zinc-200 min-w-[140px]">
                          <Link
                            href={`/marketplace/strategies/${s.id}`}
                            className="hover:text-white hover:underline"
                          >
                            {s.name}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {statusBadge(s.status)}
                        </td>
                        <td className="py-3 pr-4 text-zinc-400 tabular-nums whitespace-nowrap">
                          {fmtPct(s.win_rate_pct)}
                        </td>
                        <td className="py-3 pr-4 text-zinc-400 tabular-nums">
                          {fmtCount(s.activation_count)}
                        </td>
                        <td className="py-3 pr-4 text-zinc-400 tabular-nums">
                          {s.is_free === false
                            ? fmtCount(s.purchase_count)
                            : <span className="text-zinc-600 text-xs">free</span>}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs text-zinc-400 hover:text-zinc-200"
                            >
                              <Link href={`/marketplace/strategies/${s.id}`}>
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Link>
                            </Button>
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs text-zinc-400 hover:text-zinc-200"
                            >
                              <Link href={`/agent-builder?strategy=${s.id}`}>
                                <PenLine className="h-3.5 w-3.5" />
                                Edit
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Drafts */}
          {(isLoading || drafts.length > 0) && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-zinc-500" />
                Drafts
              </h2>

              {isLoading ? (
                <TableSkeleton cols={3} />
              ) : (
                <div className="space-y-2">
                  {drafts.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-3 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                          <FileCode2 className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-200 truncate">
                            {s.name}
                          </p>
                          <p className="text-xs text-zinc-600">
                            Last edited {relativeDate(s.updated_at)}
                          </p>
                        </div>
                      </div>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-zinc-700 text-zinc-300 shrink-0"
                      >
                        <Link href={`/agent-builder?strategy=${s.id}`}>
                          Continue editing
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </TabsContent>

        {/* ── Indicators tab ───────────────────────────────────────── */}
        <TabsContent value="indicators" className="space-y-4 mt-4">
          {isLoading ? (
            <TableSkeleton cols={4} />
          ) : indicators.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center">
              <p className="text-sm text-zinc-500">
                No indicators published yet.
              </p>
              <Button
                asChild
                variant="link"
                className="mt-2 text-violet-400 hover:text-violet-300"
              >
                <Link href="/agent-builder">
                  Create your first indicator →
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {["Name", "Status", "Used by", "Updated", "Actions"].map(
                      (h) => (
                        <th
                          key={h}
                          className="pb-2 pr-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-600 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {indicators.map((ind) => (
                    <tr
                      key={ind.id}
                      className="group hover:bg-zinc-900/30 transition-colors"
                    >
                      <td className="py-3 pr-4 font-medium text-zinc-200 min-w-[140px]">
                        <Link
                          href={`/marketplace/indicators/${ind.id}`}
                          className="hover:text-white hover:underline"
                        >
                          {ind.name}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {statusBadge(ind.status)}
                      </td>
                      <td className="py-3 pr-4 text-zinc-400">
                        {ind.used_by_count != null ? (
                          <span className="flex items-center gap-1">
                            {ind.used_by_count > 0 ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <AlertCircle className="h-3.5 w-3.5 text-zinc-600" />
                            )}
                            {ind.used_by_count} strateg
                            {ind.used_by_count === 1 ? "y" : "ies"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs text-zinc-500 whitespace-nowrap">
                        {relativeDate(ind.updated_at)}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-zinc-400 hover:text-zinc-200"
                          >
                            <Link href={`/marketplace/indicators/${ind.id}`}>
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Link>
                          </Button>
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-zinc-400 hover:text-zinc-200"
                          >
                            <Link href={`/agent-builder?indicator=${ind.id}`}>
                              <PenLine className="h-3.5 w-3.5" />
                              Edit
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
