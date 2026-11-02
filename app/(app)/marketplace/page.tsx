"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { Search, SlidersHorizontal, ChevronRight, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import {
  StrategyCardV2,
  type StrategyCardV2Data,
} from "@/components/marketplace/strategy-card-v2"
import {
  IndicatorCard,
  type MarketplaceIndicatorRow,
} from "@/components/marketplace/indicator-card"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

type FeaturedResponse = {
  platformPicks: StrategyCardV2Data[]
  trending: StrategyCardV2Data[]
  newArrivals: StrategyCardV2Data[]
}

type StrategiesResponse = {
  strategies: StrategyCardV2Data[]
}

type IndicatorsResponse = {
  indicators: MarketplaceIndicatorRow[]
}

type FilterState = {
  pricing: "all" | "free" | "paid"
  risk: "all" | "low" | "medium" | "high"
  winRateFloor: number
  asset: string
  regime: string
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchFeatured(): Promise<FeaturedResponse> {
  const res = await fetch("/api/marketplace/featured")
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function fetchStrategies(params: URLSearchParams): Promise<StrategiesResponse> {
  const res = await fetch(`/api/marketplace/strategies?${params}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function fetchIndicators(params: URLSearchParams): Promise<IndicatorsResponse> {
  const res = await fetch(`/api/marketplace/indicators?${params}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyClientFilters(
  strategies: StrategyCardV2Data[],
  filters: FilterState,
): StrategyCardV2Data[] {
  return strategies.filter((s) => {
    if (filters.pricing === "free" && s.is_free === false) return false
    if (filters.pricing === "paid" && s.is_free !== false) return false
    if (filters.risk !== "all" && s.risk_level?.toLowerCase() !== filters.risk) return false
    if (filters.winRateFloor > 0) {
      const wr = s.alpha?.win_rate_pct ?? 0
      if (wr < filters.winRateFloor) return false
    }
    if (filters.asset) {
      const pairs = (s.asset_pairs as string[] | null) ?? []
      if (!pairs.some((p) => p.toLowerCase().includes(filters.asset.toLowerCase()))) {
        return false
      }
    }
    if (filters.regime) {
      const tags = (s.tags as string[] | null) ?? []
      if (!tags.some((t) => t.toLowerCase() === filters.regime.toLowerCase())) {
        return false
      }
    }
    return true
  })
}

const DEFAULT_FILTERS: FilterState = {
  pricing: "all",
  risk: "all",
  winRateFloor: 0,
  asset: "",
  regime: "",
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
  href,
}: {
  title: string
  count?: number
  href?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        {count != null && (
          <Badge
            variant="outline"
            className="border-zinc-700 text-zinc-500 text-xs"
          >
            {count}
          </Badge>
        )}
      </div>
      {href && (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <a href={href}>
            See all <ChevronRight className="h-3 w-3" />
          </a>
        </Button>
      )}
    </div>
  )
}

// ── Filter sidebar content ────────────────────────────────────────────────────

function FilterContent({
  filters,
  onChange,
  onReset,
}: {
  filters: FilterState
  onChange: (f: Partial<FilterState>) => void
  onReset: () => void
}) {
  const hasActive =
    filters.pricing !== "all" ||
    filters.risk !== "all" ||
    filters.winRateFloor > 0 ||
    filters.asset ||
    filters.regime

  return (
    <div className="space-y-5 py-1">
      {/* Pricing */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-400">Pricing</p>
        <div className="flex gap-1.5">
          {(["all", "free", "paid"] as FilterState["pricing"][]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange({ pricing: v })}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors capitalize",
                filters.pricing === v
                  ? "border-violet-500 bg-violet-600/20 text-violet-300"
                  : "border-zinc-700 bg-zinc-900 text-zinc-500 hover:border-zinc-600",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Risk */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-400">Risk level</p>
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "low", "medium", "high"] as FilterState["risk"][]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange({ risk: v })}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                filters.risk === v
                  ? "border-sky-500 bg-sky-600/20 text-sky-300"
                  : "border-zinc-700 bg-zinc-900 text-zinc-500 hover:border-zinc-600",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Win rate floor */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <p className="font-medium text-zinc-400">Min win rate</p>
          <span className="text-zinc-300">{filters.winRateFloor}%</span>
        </div>
        <Slider
          min={0}
          max={90}
          step={5}
          value={[filters.winRateFloor]}
          onValueChange={([v]) => onChange({ winRateFloor: v })}
          className="w-full"
        />
      </div>

      {/* Asset */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-400">Asset</p>
        <Input
          value={filters.asset}
          onChange={(e) => onChange({ asset: e.target.value })}
          placeholder="e.g. WHSK"
          className="border-zinc-700 bg-zinc-900 h-8 text-xs"
        />
      </div>

      {/* Regime */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-400">Regime</p>
        <Select
          value={filters.regime || "all"}
          onValueChange={(v) => onChange({ regime: v === "all" ? "" : v })}
        >
          <SelectTrigger className="border-zinc-700 bg-zinc-900 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regimes</SelectItem>
            {["bull", "bear", "sideways", "volatile", "ranging"].map((r) => (
              <SelectItem key={r} value={r} className="capitalize">
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasActive && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="w-full gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <X className="h-3.5 w-3.5" />
          Reset filters
        </Button>
      )}
    </div>
  )
}

// ── Strategy grid ─────────────────────────────────────────────────────────────

function StrategyGrid({
  items,
  loading,
  error,
  emptyMsg = "No strategies found.",
  platformPickIds,
}: {
  items: StrategyCardV2Data[]
  loading?: boolean
  error?: Error | null
  emptyMsg?: string
  platformPickIds?: Set<string>
}) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-52 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40"
          />
        ))}
      </div>
    )
  }
  if (error) {
    return (
      <p className="text-sm text-red-400">{(error as Error).message}</p>
    )
  }
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyMsg}</p>
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => (
        <StrategyCardV2
          key={s.id}
          s={{ ...s, is_platform_pick: platformPickIds?.has(s.id) }}
        />
      ))}
    </div>
  )
}

// ── Horizontal scroll row for Featured ───────────────────────────────────────

function FeaturedRow({ items }: { items: StrategyCardV2Data[] }) {
  if (items.length === 0) return null
  return (
    <div className="-mx-4 px-4 sm:-mx-0 sm:px-0">
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
        {items.map((s) => (
          <div
            key={s.id}
            className="w-72 shrink-0 snap-start sm:w-80"
          >
            <StrategyCardV2 s={{ ...s, is_platform_pick: true }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [tab, setTab] = useState<"strategies" | "indicators">("strategies")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState("newest")
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)

  function updateFilter(partial: Partial<FilterState>) {
    setFilters((f) => ({ ...f, ...partial }))
  }

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: featured, isLoading: featuredLoading } = useQuery({
    queryKey: ["marketplace-featured"],
    queryFn: fetchFeatured,
    staleTime: 60_000,
  })

  const strategyParams = useMemo(() => {
    const p = new URLSearchParams()
    if (search) p.set("search", search)
    p.set("sort", sort)
    return p
  }, [search, sort])

  const indicatorParams = useMemo(() => {
    const p = new URLSearchParams()
    if (search) p.set("search", search)
    return p
  }, [search])

  const {
    data: stratData,
    isLoading: stratLoading,
    error: stratErr,
  } = useQuery({
    queryKey: ["marketplace-strategies", strategyParams.toString()],
    queryFn: () => fetchStrategies(strategyParams),
  })

  const {
    data: indData,
    isLoading: indLoading,
    error: indErr,
  } = useQuery({
    queryKey: ["marketplace-indicators", indicatorParams.toString()],
    queryFn: () => fetchIndicators(indicatorParams),
  })

  // ── Derived data ─────────────────────────────────────────────────────────
  const platformPicks = (featured?.platformPicks ?? []) as StrategyCardV2Data[]
  const trending = (featured?.trending ?? []) as StrategyCardV2Data[]
  const newArrivals = (featured?.newArrivals ?? []) as StrategyCardV2Data[]
  const platformPickIds = useMemo(
    () => new Set(platformPicks.map((s) => s.id)),
    [platformPicks],
  )

  const allStrategies = (stratData?.strategies ?? []) as StrategyCardV2Data[]
  const filteredStrategies = useMemo(
    () => applyClientFilters(allStrategies, filters),
    [allStrategies, filters],
  )
  const freeStrategies = filteredStrategies.filter((s) => s.is_free !== false)
  const paidStrategies = filteredStrategies.filter((s) => s.is_free === false)

  const activeFilterCount = [
    filters.pricing !== "all",
    filters.risk !== "all",
    filters.winRateFloor > 0,
    !!filters.asset,
    !!filters.regime,
  ].filter(Boolean).length

  const isSearching = !!search

  return (
    <div className="container max-w-7xl mx-auto px-4 pt-24 pb-16">
      {/* ── Hero ───────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
          Marketplace
        </h1>
        <p className="mt-2 text-zinc-400">
          Discover, activate, and build on community-published trading strategies
          and indicators — all logic encrypted on 0G Storage.
        </p>
      </div>

      {/* ── Search + controls ──────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <Input
            placeholder="Search strategies and indicators…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 border-zinc-700 bg-zinc-900/50"
          />
        </div>

        <div className="flex items-center gap-2">
          {tab === "strategies" && (
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[170px] border-zinc-700 bg-zinc-900/50 h-9 text-sm">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="activated">Most activated</SelectItem>
                <SelectItem value="live_pnl">Live PnL</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Filter button (mobile: sheet; desktop: inline toggle) */}
          {tab === "strategies" && (
            <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "gap-1.5 border-zinc-700 h-9",
                    activeFilterCount > 0 &&
                      "border-violet-500 text-violet-300",
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge className="h-4 w-4 rounded-full bg-violet-600 p-0 text-[10px] text-white flex items-center justify-center">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
                <SheetHeader>
                  <SheetTitle className="text-zinc-100">Filters</SheetTitle>
                </SheetHeader>
                <FilterContent
                  filters={filters}
                  onChange={updateFilter}
                  onReset={() => setFilters(DEFAULT_FILTERS)}
                />
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
      >
        <TabsList className="bg-zinc-900 border border-zinc-800 mb-8">
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
          <TabsTrigger value="indicators">Indicators</TabsTrigger>
        </TabsList>

        {/* ── Strategies tab ───────────────────────────────────────── */}
        <TabsContent value="strategies" className="space-y-10">
          {/* Platform picks / featured — only when not searching or filtering */}
          {!isSearching && !activeFilterCount && (
            <>
              {(featuredLoading || platformPicks.length > 0) && (
                <section className="space-y-4">
                  <SectionHeader title="Platform Picks" count={platformPicks.length} />
                  {featuredLoading ? (
                    <div className="flex gap-4 overflow-x-auto pb-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-72 h-52 shrink-0 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40"
                        />
                      ))}
                    </div>
                  ) : (
                    <FeaturedRow items={platformPicks} />
                  )}
                </section>
              )}

              {(featuredLoading || newArrivals.length > 0) && (
                <section className="space-y-4">
                  <SectionHeader
                    title="New This Week"
                    count={newArrivals.length}
                  />
                  <StrategyGrid
                    items={newArrivals}
                    loading={featuredLoading}
                    platformPickIds={platformPickIds}
                  />
                </section>
              )}

              {(featuredLoading || trending.length > 0) && (
                <section className="space-y-4">
                  <SectionHeader
                    title="Trending"
                    count={trending.length}
                  />
                  <StrategyGrid
                    items={trending}
                    loading={featuredLoading}
                    platformPickIds={platformPickIds}
                  />
                </section>
              )}
            </>
          )}

          {/* Free strategies */}
          {(!isSearching && !activeFilterCount) && (
            <section className="space-y-4">
              <SectionHeader
                title="Free Strategies"
                count={freeStrategies.length}
              />
              <StrategyGrid
                items={freeStrategies}
                loading={stratLoading}
                error={stratErr as Error | null}
                emptyMsg="No free strategies published yet."
                platformPickIds={platformPickIds}
              />
            </section>
          )}

          {/* Searched / filtered view */}
          {(isSearching || activeFilterCount > 0) && (
            <section className="space-y-4">
              <SectionHeader
                title={
                  isSearching
                    ? `Results for "${search}"`
                    : "Filtered strategies"
                }
                count={filteredStrategies.length}
              />
              <StrategyGrid
                items={filteredStrategies}
                loading={stratLoading}
                error={stratErr as Error | null}
                emptyMsg="No strategies match your filters."
                platformPickIds={platformPickIds}
              />
            </section>
          )}

          {/* Paid strategies — only in default view */}
          {!isSearching && !activeFilterCount && paidStrategies.length > 0 && (
            <section className="space-y-4">
              <SectionHeader
                title="Premium Strategies"
                count={paidStrategies.length}
              />
              <StrategyGrid
                items={paidStrategies}
                loading={stratLoading}
                error={stratErr as Error | null}
                emptyMsg="No premium strategies available."
                platformPickIds={platformPickIds}
              />
            </section>
          )}
        </TabsContent>

        {/* ── Indicators tab ───────────────────────────────────────── */}
        <TabsContent value="indicators" className="space-y-4">
          {indLoading && (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40"
                />
              ))}
            </div>
          )}
          {indErr && (
            <p className="text-sm text-red-400">
              {(indErr as Error).message}
            </p>
          )}
          {!indLoading && (
            <div className="grid gap-4 sm:grid-cols-2">
              {(indData?.indicators ?? []).map((i) => (
                <IndicatorCard key={i.id} i={i} />
              ))}
            </div>
          )}
          {!indLoading && (indData?.indicators?.length ?? 0) === 0 && (
            <p className="text-sm text-zinc-500">
              No published indicators yet. Create from the Agent Builder.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
