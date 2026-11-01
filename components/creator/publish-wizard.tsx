"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ChevronRight,
  ChevronLeft,
  Lock,
  Info,
  Zap,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useStore } from "@/store/agent-builder"
import { useWallet } from "@/hooks/use-wallet"
import { normalizeWalletAddress } from "@/lib/onboarding"
import type { StrategyDraftPayload } from "@/lib/marketplace/validate-strategy"

// ── Constants ─────────────────────────────────────────────────────────────────

const ASSET_PAIR_PRESETS = [
  "WHSK/USDT",
  "WETH/USDC",
  "WBTC/USDC",
  "WETH/USDT",
  "WBTC/USDT",
]

const REGIME_OPTIONS = ["bull", "bear", "sideways", "volatile", "ranging"]

const STRAT_KEY = "omeswap_draft_strategy_id"

// ── Types ─────────────────────────────────────────────────────────────────────

type PricingToken = "free" | "HSK" | "USDC"

type WizardState = {
  // Step 1 — Details
  name: string
  description: string
  tags: string[]
  tagInput: string
  assetPairs: string[]
  regimeGates: string[]
  // Step 2 — Risk
  stopLoss: string
  maxPositionPct: string
  maxTradesPerDay: string
  maxDailyLossPct: string
  slippageBps: string
  // Step 3 — Pricing
  isFree: boolean
  priceAmount: string
  priceToken: PricingToken
  payoutWallet: string
}

export type PublishWizardProps = {
  /** Called when the user dismisses or finishes the wizard */
  onClose: () => void
}

// ── Risk meter ────────────────────────────────────────────────────────────────

function riskScore(s: WizardState): number {
  const sl = parseFloat(s.stopLoss) || 0
  const mp = parseFloat(s.maxPositionPct) || 0
  const td = parseFloat(s.maxTradesPerDay) || 0
  const dl = parseFloat(s.maxDailyLossPct) || 0
  // Higher values = higher risk (normalised to 0-100)
  const slScore = Math.min(sl / 10, 1) * 25 // 0-10% → 0-25
  const mpScore = Math.min(mp / 20, 1) * 25 // 0-20% → 0-25
  const tdScore = Math.min(td / 20, 1) * 25 // 0-20 → 0-25
  const dlScore = Math.min(dl / 10, 1) * 25 // 0-10% → 0-25
  return Math.round(slScore + mpScore + tdScore + dlScore)
}

function RiskMeter({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score))
  const label =
    pct < 33 ? "Low" : pct < 66 ? "Medium" : "High"
  const color =
    pct < 33
      ? "bg-emerald-500"
      : pct < 66
        ? "bg-amber-500"
        : "bg-red-500"
  const textColor =
    pct < 33
      ? "text-emerald-400"
      : pct < 66
        ? "text-amber-400"
        : "text-red-400"

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-500">Risk level</span>
        <span className={cn("font-medium", textColor)}>{label}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800">
        <div
          className={cn("h-full rounded-full transition-all duration-300", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-zinc-600">
        Computed from stop-loss, position size, trade frequency, and daily loss limits.
      </p>
    </div>
  )
}

// ── Step indicators ───────────────────────────────────────────────────────────

const STEP_LABELS = ["Details", "Risk", "Privacy & Pricing", "Preview"]

function StepIndicator({
  step,
  current,
}: {
  step: number
  current: number
}) {
  const done = step < current
  const active = step === current
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
          done
            ? "border-violet-500 bg-violet-600 text-white"
            : active
              ? "border-violet-500 bg-violet-600/20 text-violet-300"
              : "border-zinc-700 bg-zinc-900 text-zinc-500",
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : step + 1}
      </div>
      <span
        className={cn(
          "hidden text-[10px] sm:block",
          active ? "text-zinc-300" : "text-zinc-600",
        )}
      >
        {STEP_LABELS[step]}
      </span>
    </div>
  )
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-zinc-300">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-zinc-600">{hint}</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PublishWizard({ onClose }: PublishWizardProps) {
  const { address } = useWallet()
  const wallet = address ? normalizeWalletAddress(address) : null

  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const nodeInstances = useStore((s) => s.nodeInstances)

  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [published, setPublished] = useState(false)

  const [form, setForm] = useState<WizardState>({
    name: "",
    description: "",
    tags: [],
    tagInput: "",
    assetPairs: [],
    regimeGates: [],
    stopLoss: "0.8",
    maxPositionPct: "2",
    maxTradesPerDay: "3",
    maxDailyLossPct: "3",
    slippageBps: "75",
    isFree: true,
    priceAmount: "",
    priceToken: "HSK",
    payoutWallet: wallet ?? "",
  })

  // Sync payout wallet when wallet connects
  useEffect(() => {
    if (wallet && !form.payoutWallet) {
      setForm((f) => ({ ...f, payoutWallet: wallet }))
    }
  }, [wallet, form.payoutWallet])

  function set<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setMsg(null)
  }

  // ── Build payloads ──────────────────────────────────────────────────────

  const buildConfigs = useCallback(() => {
    const configs: Record<string, Record<string, unknown>> = {}
    nodeInstances.forEach((inst, id) => {
      configs[id] = { ...inst.config }
    })
    return configs
  }, [nodeInstances])

  const buildDraftPayload = useCallback((): StrategyDraftPayload => {
    return {
      nodes: nodes as StrategyDraftPayload["nodes"],
      edges: edges as StrategyDraftPayload["edges"],
      configs: buildConfigs(),
      assetPairs: form.assetPairs,
      regimeGates: form.regimeGates,
      risk: {
        stopLossPercent: parseFloat(form.stopLoss) || 0,
        maxPositionPct: parseFloat(form.maxPositionPct) || 2,
        maxTradesPerDay: parseInt(form.maxTradesPerDay, 10) || 3,
        maxDailyLossPct: parseFloat(form.maxDailyLossPct) || 3,
        slippageBps: parseInt(form.slippageBps, 10) || 75,
      },
    }
  }, [nodes, edges, buildConfigs, form])

  // ── Strategy ID management ──────────────────────────────────────────────

  async function ensureStrategyId(): Promise<string | null> {
    if (typeof window === "undefined" || !wallet) return null
    const sid = sessionStorage.getItem(STRAT_KEY)
    if (sid) return sid
    if (!form.name.trim()) {
      setMsg("Enter a strategy name to continue")
      return null
    }
    const res = await fetch("/api/creator/strategies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-wallet-address": wallet,
      },
      body: JSON.stringify({ name: form.name.trim(), description: form.description }),
    })
    if (!res.ok) {
      setMsg(await res.text())
      return null
    }
    const { id } = (await res.json()) as { id: string }
    sessionStorage.setItem(STRAT_KEY, id)
    return id
  }

  async function patchStrategy(sid: string) {
    const res = await fetch(`/api/creator/strategies/${sid}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-wallet-address": wallet!,
      },
      body: JSON.stringify({
        name: form.name.trim() || undefined,
        description: form.description,
        asset_pairs: form.assetPairs,
        regime_gates: form.regimeGates,
        tags: form.tags,
        is_free: form.isFree,
        price_amount: form.isFree ? null : parseFloat(form.priceAmount) || null,
        price_token: form.isFree ? "free" : form.priceToken,
        payout_wallet: form.isFree ? null : form.payoutWallet || null,
        draft_payload: buildDraftPayload(),
      }),
    })
    if (!res.ok) throw new Error(await res.text())
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  async function handleSaveDraft() {
    if (!wallet) { setMsg("Connect wallet"); return }
    setBusy(true)
    setMsg(null)
    try {
      const sid = await ensureStrategyId()
      if (!sid) return
      await patchStrategy(sid)
      setMsg("Draft saved")
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed")
    } finally {
      setBusy(false)
    }
  }

  async function handlePublish() {
    if (!wallet) { setMsg("Connect wallet"); return }
    setBusy(true)
    setMsg(null)
    try {
      const sid = await ensureStrategyId()
      if (!sid) return
      await patchStrategy(sid)
      const res = await fetch(`/api/creator/strategies/${sid}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": wallet,
        },
        body: JSON.stringify({ draft_payload: buildDraftPayload() }),
      })
      if (!res.ok) {
        const j = await res.json().catch(async () => ({ error: await res.text() }))
        throw new Error(typeof j.error === "string" ? j.error : JSON.stringify(j))
      }
      sessionStorage.removeItem(STRAT_KEY)
      setPublished(true)
      setMsg("Strategy published to Marketplace!")
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Publish failed")
    } finally {
      setBusy(false)
    }
  }

  // ── Validation per step ─────────────────────────────────────────────────

  function validateStep(): boolean {
    if (step === 0) {
      if (!form.name.trim()) { setMsg("Strategy name is required"); return false }
      if (form.assetPairs.length === 0) { setMsg("Add at least one asset pair"); return false }
      if (form.regimeGates.length === 0) { setMsg("Select at least one market regime"); return false }
    }
    if (step === 1) {
      if (!parseFloat(form.stopLoss) || parseFloat(form.stopLoss) <= 0) {
        setMsg("Stop-loss must be greater than 0"); return false
      }
    }
    if (step === 2) {
      if (!form.isFree && (!form.priceAmount || parseFloat(form.priceAmount) <= 0)) {
        setMsg("Enter a valid price for paid strategies"); return false
      }
    }
    return true
  }

  function nextStep() {
    if (!validateStep()) return
    setMsg(null)
    setStep((s) => Math.min(3, s + 1))
  }

  function prevStep() {
    setMsg(null)
    setStep((s) => Math.max(0, s - 1))
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (published) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-600/20">
          <Zap className="h-6 w-6 text-violet-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-zinc-100">
            Strategy published!
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            {form.name} is now live on the Marketplace. It may take a moment to appear while the AI summary is generated.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            size="sm"
            className="bg-violet-600 hover:bg-violet-500"
            onClick={() => {
              window.location.href = "/marketplace"
            }}
          >
            View Marketplace
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Step indicators */}
      <div className="flex items-center justify-between gap-2 px-1">
        {STEP_LABELS.map((_, i) => (
          <div key={i} className="flex flex-1 items-center">
            <StepIndicator step={i} current={step} />
            {i < STEP_LABELS.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-px flex-1 transition-colors",
                  i < step ? "bg-violet-600" : "bg-zinc-800",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 0: Details ──────────────────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-4">
          <Field label="Strategy name *">
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. RSI Momentum Swing"
              className="border-zinc-700 bg-zinc-900"
            />
          </Field>

          <Field label="Description">
            <Input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What does this strategy do?"
              className="border-zinc-700 bg-zinc-900"
            />
          </Field>

          <Field label="Tags" hint="Press Enter or comma to add">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {form.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="cursor-pointer border-zinc-600 text-zinc-300 hover:border-red-500 hover:text-red-400"
                    onClick={() =>
                      set("tags", form.tags.filter((t) => t !== tag))
                    }
                  >
                    {tag} ×
                  </Badge>
                ))}
              </div>
              <Input
                value={form.tagInput}
                onChange={(e) => set("tagInput", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault()
                    const t = form.tagInput.trim().replace(/,$/, "")
                    if (t && !form.tags.includes(t)) {
                      set("tags", [...form.tags, t])
                    }
                    set("tagInput", "")
                  }
                }}
                placeholder="Add a tag…"
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
          </Field>

          <Field label="Asset pairs *" hint="Click to toggle">
            <div className="flex flex-wrap gap-1.5">
              {ASSET_PAIR_PRESETS.map((pair) => {
                const active = form.assetPairs.includes(pair)
                return (
                  <button
                    key={pair}
                    type="button"
                    onClick={() =>
                      set(
                        "assetPairs",
                        active
                          ? form.assetPairs.filter((p) => p !== pair)
                          : [...form.assetPairs, pair],
                      )
                    }
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-violet-500 bg-violet-600/20 text-violet-300"
                        : "border-zinc-700 bg-zinc-900 text-zinc-500 hover:border-zinc-600",
                    )}
                  >
                    {pair}
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label="Market regimes *" hint="When does this strategy work best?">
            <div className="flex flex-wrap gap-1.5">
              {REGIME_OPTIONS.map((r) => {
                const active = form.regimeGates.includes(r)
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() =>
                      set(
                        "regimeGates",
                        active
                          ? form.regimeGates.filter((g) => g !== r)
                          : [...form.regimeGates, r],
                      )
                    }
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                      active
                        ? "border-sky-500 bg-sky-600/20 text-sky-300"
                        : "border-zinc-700 bg-zinc-900 text-zinc-500 hover:border-zinc-600",
                    )}
                  >
                    {r}
                  </button>
                )
              })}
            </div>
          </Field>
        </div>
      )}

      {/* ── Step 1: Risk ────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <RiskMeter score={riskScore(form)} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Stop-loss %" hint="Required (e.g. 0.8)">
              <Input
                value={form.stopLoss}
                onChange={(e) => set("stopLoss", e.target.value)}
                type="number"
                min="0"
                step="0.1"
                className="border-zinc-700 bg-zinc-900"
              />
            </Field>
            <Field label="Max position %" hint="% of portfolio per trade">
              <Input
                value={form.maxPositionPct}
                onChange={(e) => set("maxPositionPct", e.target.value)}
                type="number"
                min="0"
                className="border-zinc-700 bg-zinc-900"
              />
            </Field>
            <Field label="Max trades / day">
              <Input
                value={form.maxTradesPerDay}
                onChange={(e) => set("maxTradesPerDay", e.target.value)}
                type="number"
                min="0"
                className="border-zinc-700 bg-zinc-900"
              />
            </Field>
            <Field label="Max daily loss %">
              <Input
                value={form.maxDailyLossPct}
                onChange={(e) => set("maxDailyLossPct", e.target.value)}
                type="number"
                min="0"
                className="border-zinc-700 bg-zinc-900"
              />
            </Field>
            <Field label="Slippage (bps)" hint="e.g. 75 = 0.75%">
              <Input
                value={form.slippageBps}
                onChange={(e) => set("slippageBps", e.target.value)}
                type="number"
                min="0"
                className="border-zinc-700 bg-zinc-900"
              />
            </Field>
          </div>
        </div>
      )}

      {/* ── Step 2: Privacy & Pricing ────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Encryption info banner */}
          <div className="flex items-start gap-3 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3">
            <Lock className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-violet-300">
                Strategy logic is encrypted
              </p>
              <p className="mt-0.5 text-[11px] text-violet-400/70">
                The compiled graph and execution logic will be AES-256-GCM encrypted
                and stored on 0G Storage. Only the public summary and performance
                metrics are visible to other users.
              </p>
            </div>
          </div>

          {/* Free / Paid toggle */}
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-300">Pricing</Label>
            <div className="flex rounded-lg border border-zinc-700 p-1 gap-1">
              {(["free", "paid"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => set("isFree", opt === "free")}
                  className={cn(
                    "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
                    (opt === "free") === form.isFree
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  {opt === "free" ? "Free" : "Paid"}
                </button>
              ))}
            </div>
          </div>

          {!form.isFree && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price amount">
                  <Input
                    value={form.priceAmount}
                    onChange={(e) => set("priceAmount", e.target.value)}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 2"
                    className="border-zinc-700 bg-zinc-900"
                  />
                </Field>
                <Field label="Token">
                  <div className="flex rounded-lg border border-zinc-700 p-1 gap-1">
                    {(["HSK", "USDC"] as PricingToken[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => set("priceToken", t)}
                        className={cn(
                          "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
                          form.priceToken === t
                            ? "bg-zinc-700 text-zinc-100"
                            : "text-zinc-500 hover:text-zinc-300",
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              <Field
                label="Payout wallet"
                hint="Earnings from purchases will be sent here"
              >
                <Input
                  value={form.payoutWallet}
                  onChange={(e) => set("payoutWallet", e.target.value)}
                  placeholder="0x…"
                  className="border-zinc-700 bg-zinc-900 font-mono text-xs"
                />
              </Field>

              {form.priceAmount && (
                <div className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900/50 p-2.5 text-xs text-zinc-400">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Buyers will pay{" "}
                    <strong className="text-zinc-200">
                      {form.priceAmount} {form.priceToken}
                    </strong>{" "}
                    to unlock this strategy.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Preview ─────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(form.isFree === false) ? (
                <Badge className="bg-orange-500/15 text-orange-300 border-orange-500/30">
                  {form.priceAmount} {form.priceToken}
                </Badge>
              ) : (
                <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/30">
                  Free
                </Badge>
              )}
              {form.assetPairs.slice(0, 2).map((p) => (
                <Badge key={p} variant="outline" className="border-zinc-700 text-zinc-300 text-xs">
                  {p}
                </Badge>
              ))}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                {form.name || "Untitled Strategy"}
              </h3>
              <p className="mt-0.5 text-xs text-zinc-400">{form.description || "No description"}</p>
            </div>
            {form.regimeGates.length > 0 && (
              <div className="flex flex-wrap gap-1 text-xs text-zinc-500">
                Regime:{" "}
                {form.regimeGates.map((r) => (
                  <span key={r} className="capitalize text-zinc-400">
                    {r}
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-zinc-500">Stop-loss</span>{" "}
                <span className="text-zinc-300">{form.stopLoss}%</span>
              </div>
              <div>
                <span className="text-zinc-500">Max position</span>{" "}
                <span className="text-zinc-300">{form.maxPositionPct}%</span>
              </div>
              <div>
                <span className="text-zinc-500">Slippage</span>{" "}
                <span className="text-zinc-300">{form.slippageBps} bps</span>
              </div>
              <div>
                <span className="text-zinc-500">Max trades/day</span>{" "}
                <span className="text-zinc-300">{form.maxTradesPerDay}</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-zinc-700 bg-zinc-900/40 p-3 text-xs text-zinc-400">
            <Lock className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
            <span>
              The strategy graph will be encrypted with AES-256-GCM and uploaded
              to 0G Storage. An AI-generated public summary will be created from
              your strategy without exposing the logic.
            </span>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={busy || !wallet}
              className="flex-1"
              onClick={() => void handleSaveDraft()}
            >
              Save Draft
            </Button>
            <Button
              type="button"
              disabled={busy || !wallet}
              className="flex-1 bg-violet-600 hover:bg-violet-500"
              onClick={() => void handlePublish()}
            >
              {busy ? "Publishing…" : "Publish"}
            </Button>
          </div>

          {!wallet && (
            <p className="text-xs text-zinc-500 text-center">
              Connect a wallet to publish.
            </p>
          )}
        </div>
      )}

      {/* Message */}
      {msg && (
        <p
          className={cn(
            "text-xs",
            msg.toLowerCase().includes("error") ||
              msg.toLowerCase().includes("fail") ||
              msg.toLowerCase().includes("required")
              ? "text-red-400"
              : "text-amber-200/90",
          )}
        >
          {msg}
        </p>
      )}

      {/* Navigation */}
      {step < 3 && (
        <div className="flex justify-between pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={step === 0}
            onClick={prevStep}
            className="gap-1 text-zinc-400"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={nextStep}
            className="gap-1 bg-violet-600 hover:bg-violet-500"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      {step === 3 && (
        <div className="flex justify-start pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={prevStep}
            className="gap-1 text-zinc-400"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      )}
    </div>
  )
}
