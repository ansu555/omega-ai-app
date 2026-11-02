"use client";

/**
 * Agent Pipeline Dock — live view of the ATS six-agent stack, docked under the
 * terminal chart.
 *
 * Streams RunEvents from /api/research/run and renders the pipeline as it runs:
 *
 *   data → (regime ∥ signal ∥ graph) → risk → consensus → execution
 *
 * In `autonomous` mode the Execution Agent signs and submits a real HSKSwap
 * trade from the user's server-managed burner wallet, so the dock surfaces the
 * resulting tx hash with an explorer link. `assisted` stops at consensus and
 * defers to the approval banner in the swap panel; `solo` never executes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Ban,
  Bot,
  ChevronDown,
  ChevronUp,
  CircleDot,
  ExternalLink,
  Loader2,
  Play,
  Square,
} from "lucide-react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import type { AgentName, Decision, Mode, RunEvent } from "@/lib/ats/types";
import { getDexMarketConfig } from "@/lib/dex/markets";
import { getDefaultChainId, getExplorerLink } from "@/lib/chain-registry";
import { startAgentRun } from "@/lib/terminal/agents/run-stream";

// ── Pipeline model ────────────────────────────────────────────────────────────

type StageId = AgentName | "consensus";
type StageState = "idle" | "running" | "done" | "vetoed" | "failed";

const STAGES: { id: StageId; label: string; hint: string }[] = [
  { id: "data", label: "Data", hint: "Prices + news" },
  { id: "regime", label: "Regime", hint: "Market state" },
  { id: "signal", label: "Signal", hint: "Entry edge" },
  { id: "graph", label: "Graph", hint: "Causal chains" },
  { id: "risk", label: "Risk", hint: "Kelly sizing" },
  { id: "consensus", label: "Consensus", hint: "Voting matrix" },
  { id: "execution", label: "Execution", hint: "On-chain swap" },
];

type StageMap = Record<StageId, StageState>;

function freshStages(): StageMap {
  return STAGES.reduce((acc, s) => {
    acc[s.id] = "idle";
    return acc;
  }, {} as StageMap);
}

interface LogLine {
  key: string;
  ts: string;
  agent: string;
  message: string;
  tone: "info" | "good" | "warn" | "bad";
}

interface ExecResult {
  txHash: string | null;
  tokenIn?: string;
  tokenOut?: string;
  amountUsd?: number;
  status?: string;
  error?: string;
}

const MODES: { id: Mode; label: string; blurb: string }[] = [
  { id: "solo", label: "Solo", blurb: "Research only — never executes." },
  { id: "assisted", label: "Assisted", blurb: "Proposes a trade; you approve it in the swap panel." },
  { id: "autonomous", label: "Autonomous", blurb: "Agent signs and submits a real on-chain trade." },
];

function toneFor(type: RunEvent["type"]): LogLine["tone"] {
  if (type === "run.error") return "bad";
  if (type === "agent.vetoed") return "warn";
  if (type === "execution.done" || type === "run.done" || type === "consensus.reached") return "good";
  return "info";
}

function decisionClasses(decision: Decision): string {
  switch (decision) {
    case "BUY":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
    case "SELL":
      return "border-red-500/40 bg-red-500/10 text-red-400";
    case "VETO":
      return "border-amber-500/40 bg-amber-500/10 text-amber-400";
    default:
      return "border-border bg-panel text-muted-foreground";
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AgentPipelineDock({
  marketId,
  collapsed,
  onToggle,
}: {
  marketId: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const market = useMemo(() => getDexMarketConfig(marketId), [marketId]);
  const chainId = market.chainId ?? getDefaultChainId();
  const ticker = market.baseToken.symbol;

  const [mode, setMode] = useState<Mode>("assisted");
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<StageMap>(freshStages);
  const [log, setLog] = useState<LogLine[]>([]);
  const [decision, setDecision] = useState<{ decision: Decision; confidence: number; rationale: string } | null>(null);
  const [exec, setExec] = useState<ExecResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const seqRef = useRef(0);

  // Abort any in-flight run when the dock unmounts.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Keep the newest log line in view.
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [log]);

  const pushLog = useCallback((evt: RunEvent) => {
    if (!evt.message) return;
    seqRef.current += 1;
    const line: LogLine = {
      key: `${evt.run_id}:${seqRef.current}`,
      ts: evt.ts,
      agent: evt.agent ?? "orchestrator",
      message: evt.message,
      tone: toneFor(evt.type),
    };
    setLog((prev) => {
      const next = [...prev, line];
      // Bound memory on long runs; the receipt is the durable record.
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
  }, []);

  const applyEvent = useCallback(
    (evt: RunEvent) => {
      pushLog(evt);

      const markStage = (id: StageId, state: StageState) =>
        setStages((prev) => (prev[id] === state ? prev : { ...prev, [id]: state }));

      switch (evt.type) {
        case "agent.thinking":
          if (evt.agent) markStage(evt.agent, "running");
          break;
        case "agent.data":
          markStage("data", "done");
          break;
        case "regime.classified":
          markStage("regime", "done");
          break;
        case "signal.update":
          markStage("signal", "done");
          break;
        case "graph.update":
          markStage("graph", "done");
          break;
        case "risk.sizing":
          markStage("risk", "done");
          break;
        case "agent.done":
          if (evt.agent) markStage(evt.agent, "done");
          break;
        case "agent.vetoed":
          if (evt.agent) markStage(evt.agent, "vetoed");
          break;
        case "consensus.reached": {
          markStage("consensus", "done");
          const p = evt.payload as
            | { decision?: Decision; confidence?: number; rationale?: string }
            | undefined;
          if (p?.decision) {
            setDecision({
              decision: p.decision,
              confidence: typeof p.confidence === "number" ? p.confidence : 0,
              rationale: p.rationale ?? "",
            });
          }
          break;
        }
        case "execution.pending":
          markStage("execution", "running");
          break;
        case "execution.done": {
          const p = evt.payload as
            | {
                tx_hash?: string | null;
                token_in?: string;
                token_out?: string;
                amount_in_usd?: number;
                status?: string;
                error?: string;
              }
            | undefined;
          markStage("execution", p?.status === "submitted" ? "done" : "failed");
          setExec({
            txHash: p?.tx_hash ?? null,
            tokenIn: p?.token_in,
            tokenOut: p?.token_out,
            amountUsd: p?.amount_in_usd,
            status: p?.status,
            error: p?.error,
          });
          break;
        }
        case "run.error":
          setError(evt.message ?? "Run failed.");
          break;
        default:
          break;
      }
    },
    [pushLog],
  );

  const handleRun = useCallback(async () => {
    if (!isConnected || !address) {
      openConnectModal?.();
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunning(true);
    setStages(freshStages());
    setLog([]);
    setDecision(null);
    setExec(null);
    setError(null);
    seqRef.current = 0;

    try {
      const stream = await startAgentRun({
        address,
        ticker,
        query: `Should I trade ${ticker} right now on HashKey Chain? Market: ${market.pairLabel}.`,
        mode,
        chainId,
        signal: controller.signal,
      });

      for await (const evt of stream) {
        if (controller.signal.aborted) break;
        applyEvent(evt);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setRunning(false);
    }
  }, [address, applyEvent, chainId, isConnected, market.pairLabel, mode, openConnectModal, ticker]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  }, []);

  const activeMode = MODES.find((m) => m.id === mode);

  // ── Collapsed rail ──────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label="Expand agent pipeline"
        aria-controls="terminal-agent-dock"
        aria-expanded={false}
        className="flex h-7 shrink-0 items-center gap-2 border-t border-border bg-background/85 px-3 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-panel hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Bot className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium uppercase tracking-wide">Agent Pipeline</span>
        {running ? <Loader2 className="h-3 w-3 animate-spin text-sky-400" /> : null}
        {decision ? (
          <span className={`rounded border px-1.5 py-px text-[10px] font-semibold ${decisionClasses(decision.decision)}`}>
            {decision.decision}
          </span>
        ) : null}
        <ChevronUp className="ml-auto h-3.5 w-3.5" />
      </button>
    );
  }

  // ── Expanded dock ───────────────────────────────────────────────────────────
  return (
    <div
      id="terminal-agent-dock"
      className="flex h-[260px] shrink-0 flex-col border-t border-border bg-background"
    >
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
        <Bot className="h-3.5 w-3.5 text-sky-400" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Agent Pipeline
        </span>
        <span className="rounded border border-border bg-panel px-1.5 py-px text-[10px] font-medium text-foreground">
          {market.pairLabel}
        </span>

        {/* Mode switch */}
        <div className="ml-2 flex items-center rounded border border-border bg-panel p-px">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={running}
              onClick={() => setMode(m.id)}
              title={m.blurb}
              className={`rounded px-2 py-px text-[10px] font-medium transition-colors disabled:opacity-50 ${
                mode === m.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "autonomous" ? (
          <span className="flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-px text-[10px] font-medium text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            Real funds
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-1.5">
          {running ? (
            <button
              type="button"
              onClick={handleStop}
              className="flex items-center gap-1 rounded border border-border bg-panel px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Square className="h-3 w-3" />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRun}
              className="flex items-center gap-1 rounded border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold text-sky-400 transition-colors hover:bg-sky-500/20"
            >
              <Play className="h-3 w-3" />
              {isConnected ? "Run agents" : "Connect wallet"}
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse agent pipeline"
            aria-controls="terminal-agent-dock"
            aria-expanded={true}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Stage rail */}
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-3 py-2">
        {STAGES.map((stage, i) => (
          <div key={stage.id} className="flex shrink-0 items-center gap-1">
            <StageChip label={stage.label} hint={stage.hint} state={stages[stage.id]} />
            {i < STAGES.length - 1 ? (
              <span className="text-muted-foreground/40" aria-hidden>
                ›
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {/* Body: log + verdict */}
      <div className="flex min-h-0 flex-1">
        {/* Event log */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
          {log.length === 0 && !error ? (
            <p className="text-muted-foreground">
              {activeMode?.blurb} Press <span className="text-foreground">Run agents</span> to stream the
              six-agent stack for {market.pairLabel}.
            </p>
          ) : null}

          {log.map((line) => (
            <div key={line.key} className="flex gap-2">
              <span className="shrink-0 text-muted-foreground/60">
                {new Date(line.ts).toLocaleTimeString([], { hour12: false })}
              </span>
              <span className="shrink-0 w-[72px] truncate text-muted-foreground">{line.agent}</span>
              <span
                className={
                  line.tone === "good"
                    ? "text-emerald-400"
                    : line.tone === "warn"
                      ? "text-amber-400"
                      : line.tone === "bad"
                        ? "text-red-400"
                        : "text-foreground/90"
                }
              >
                {line.message}
              </span>
            </div>
          ))}

          {error ? (
            <div className="mt-1 flex items-start gap-2 text-red-400">
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div ref={logEndRef} />
        </div>

        {/* Verdict column */}
        <aside className="w-[220px] shrink-0 overflow-y-auto border-l border-border px-3 py-2">
          <h3 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Verdict
          </h3>

          {decision ? (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded border px-2 py-px text-[11px] font-bold ${decisionClasses(decision.decision)}`}
                >
                  {decision.decision}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {(decision.confidence * 100).toFixed(0)}% conf
                </span>
              </div>
              {decision.rationale ? (
                <p className="text-[10px] leading-snug text-muted-foreground">{decision.rationale}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-[10px] text-muted-foreground">No decision yet.</p>
          )}

          {exec ? (
            <div className="mt-3 space-y-1 border-t border-border pt-2">
              <h4 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Execution
              </h4>
              {exec.tokenIn && exec.tokenOut ? (
                <p className="text-[10px] text-foreground">
                  {exec.tokenIn} → {exec.tokenOut}
                  {typeof exec.amountUsd === "number" ? (
                    <span className="text-muted-foreground"> · ${exec.amountUsd.toFixed(2)}</span>
                  ) : null}
                </p>
              ) : null}

              {exec.txHash ? (
                <a
                  href={getExplorerLink(chainId, "tx", exec.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-mono text-[10px] text-sky-400 hover:underline"
                >
                  {exec.txHash.slice(0, 10)}…{exec.txHash.slice(-6)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <p className="text-[10px] text-amber-400">{exec.error ?? "No transaction submitted."}</p>
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

// ── Stage chip ────────────────────────────────────────────────────────────────

function StageChip({
  label,
  hint,
  state,
}: {
  label: string;
  hint: string;
  state: StageState;
}) {
  const base =
    "flex shrink-0 items-center gap-1 rounded border px-1.5 py-1 text-[10px] font-medium transition-colors";

  const byState: Record<StageState, string> = {
    idle: "border-border bg-panel text-muted-foreground",
    running: "border-sky-500/40 bg-sky-500/10 text-sky-400",
    done: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    vetoed: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    failed: "border-red-500/40 bg-red-500/10 text-red-400",
  };

  const icon =
    state === "running" ? (
      <Loader2 className="h-3 w-3 animate-spin" />
    ) : state === "done" ? (
      <Activity className="h-3 w-3" />
    ) : state === "vetoed" ? (
      <Ban className="h-3 w-3" />
    ) : state === "failed" ? (
      <AlertTriangle className="h-3 w-3" />
    ) : (
      <CircleDot className="h-3 w-3" />
    );

  return (
    <span className={`${base} ${byState[state]}`} title={hint}>
      {icon}
      {label}
    </span>
  );
}
