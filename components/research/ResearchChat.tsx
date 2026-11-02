"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ComponentType,
  type KeyboardEvent,
} from "react";
import {
  ArrowUpRight,
  AlertCircle,
  ExternalLink,
  FileText,
  Loader2,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Square,
  Target,
  TrendingUp,
} from "lucide-react";
import clsx from "clsx";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import DecisionReceiptDrawer from "@/components/research/DecisionReceiptDrawer";
import ResearchReportDrawer from "@/components/research/ResearchReportDrawer";
import { useResearchStore, type ChatMessage, type PendingApproval } from "@/store/research";
import type { RunEvent } from "@/lib/ats/types";

async function* parseSSE(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") return;
      try {
        yield JSON.parse(raw) as RunEvent;
      } catch {
        // Ignore malformed stream payloads.
      }
    }
  }
}

// ── Durable deep-run reconnect (P5) ───────────────────────────────────────────
// Deep Research runs continue in the background even if the tab closes. We track
// the active run's id + last sequence seen in localStorage so a reload can
// reconnect via `GET /api/research/run?runId=&afterSeq=` and replay/resume.

const ACTIVE_RUN_KEY = "omeswap_research_active_run";

interface ActiveRun {
  runId: string;
  seq: number;
  wallet: string;
}

function readActiveRun(): ActiveRun | null {
  try {
    const raw = localStorage.getItem(ACTIVE_RUN_KEY);
    return raw ? (JSON.parse(raw) as ActiveRun) : null;
  } catch {
    return null;
  }
}

function writeActiveRun(active: ActiveRun): void {
  try {
    localStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify(active));
  } catch {
    // ignore quota / unavailable storage
  }
}

function clearActiveRun(): void {
  try {
    localStorage.removeItem(ACTIVE_RUN_KEY);
  } catch {
    // ignore
  }
}

const QUICK_PROMPTS = [
  {
    icon: TrendingUp,
    label: "Worth It Check",
    description: "Fast go/no-go thesis",
    prompt: "Is WHSK worth buying on HashKey Chain right now? Give me the full picture.",
  },
  {
    icon: Target,
    label: "Sizing Plan",
    description: "Entry size and max loss",
    prompt: "Analyse BTC and tell me how much I should allocate if the setup is worth it.",
  },
  {
    icon: ShieldAlert,
    label: "Risk Review",
    description: "Downside-first briefing",
    prompt: "Research ETH and focus on the main downside risks before I enter.",
  },
  {
    icon: Sparkles,
    label: "Token Thesis",
    description: "Full evidence-backed brief",
    prompt: "Build me an investment thesis for SOL with the agent-backed evidence.",
  },
];

function PromptChip({
  label,
  description,
  prompt,
  onSelect,
  icon: Icon,
}: {
  label: string;
  description: string;
  prompt: string;
  onSelect: (prompt: string) => void;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(prompt)}
      className="group flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-300/50"
      style={{
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.075)",
      }}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: "rgba(139,92,246,0.12)",
            border: "1px solid rgba(139,92,246,0.16)",
          }}
        >
          <Icon className="h-4 w-4 text-violet-200" />
        </span>
        <span className="min-w-0">
          <span className="block text-[12px] font-medium text-white/[0.88]">
            {label}
          </span>
          <span className="mt-0.5 block text-[10px] text-white/[0.38]">
            {description}
          </span>
        </span>
      </span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-white/[0.24] transition-colors group-hover:text-white/[0.64]" />
    </button>
  );
}

function AssistantMessage({
  message,
  onOpenBrief,
}: {
  message: ChatMessage;
  onOpenBrief: () => void;
}) {
  if (message.pending) {
    return (
      <div
        className="rounded-[24px] p-4"
        style={{
          background: "linear-gradient(180deg, rgba(34,20,52,0.78), rgba(17,17,31,0.78))",
          border: "1px solid rgba(139,92,246,0.18)",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{
              background: "rgba(139,92,246,0.16)",
              border: "1px solid rgba(139,92,246,0.22)",
            }}
          >
            <Sparkles className="h-4.5 w-4.5 text-violet-200" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/28">
              ATS Research
            </p>
            <p className="text-[13px] font-medium text-white/88">
              Agents are building your brief
            </p>
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-white/60">
          {message.content}
        </p>

        <div className="mt-3 flex items-center gap-2 text-[10px] text-violet-200/80">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Six ATS agents are scoring the setup on HashKey Chain.
        </div>
      </div>
    );
  }

  const brief = message.brief;

  return (
    <div
      className="rounded-[24px] p-4"
      style={{
        background: "linear-gradient(180deg, rgba(23,23,36,0.92), rgba(13,13,24,0.92))",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/28">
            Final Brief
          </p>
          <h3 className="mt-1 text-[14px] font-medium text-white/92">
            {brief?.headline ?? "Research complete"}
          </h3>
        </div>
        {brief && (
          <span
            className={clsx(
              "rounded-full px-2 py-1 text-[9px] font-medium capitalize",
              brief.worth_it === "yes"
                ? "bg-emerald-500/15 text-emerald-200"
                : brief.worth_it === "no"
                  ? "bg-rose-500/15 text-rose-200"
                  : "bg-amber-500/15 text-amber-100",
            )}
          >
            {brief.worth_it === "yes"
              ? "Worth it"
              : brief.worth_it === "no"
                ? "Avoid"
                : "Watch"}
          </span>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-white/62">
        {message.content}
      </p>

      {brief && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div
              className="rounded-2xl px-3 py-2"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/24">
                Conviction
              </p>
              <p className="mt-1 text-[12px] font-medium capitalize text-white/88">
                {brief.conviction_label} · {Math.round(brief.confidence * 100)}%
              </p>
            </div>
            <div
              className="rounded-2xl px-3 py-2"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/24">
                Suggested Size
              </p>
              <p className="mt-1 text-[12px] font-medium text-white/88">
                ${brief.suggested_allocation_usd.toFixed(2)}
              </p>
            </div>
            <div
              className="rounded-2xl px-3 py-2"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/24">
                Max Loss
              </p>
              <p className="mt-1 text-[12px] font-medium text-white/88">
                ${brief.max_loss_usd.toFixed(2)}
              </p>
            </div>
            <div
              className="rounded-2xl px-3 py-2"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/24">
                HashKey Execution
              </p>
              <p className="mt-1 text-[12px] font-medium text-white/88">
                {brief.execution.status.replace(/_/g, " ")}
              </p>
            </div>
          </div>

          {brief.risk_flags.length > 0 && (
            <div className="mt-4 rounded-2xl bg-white/[0.03] px-3 py-3">
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/24">
                Key Risks
              </p>
              <ul className="mt-2 space-y-1.5 text-[10px] leading-snug text-white/56">
                {brief.risk_flags.slice(0, 3).map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={onOpenBrief}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-medium text-violet-100 transition-colors hover:text-white"
            style={{
              background: "rgba(139,92,246,0.15)",
              border: "1px solid rgba(139,92,246,0.22)",
            }}
          >
            <FileText className="h-3.5 w-3.5" />
            View Brief
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  onOpenBrief,
}: {
  message: ChatMessage;
  onOpenBrief: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[88%] rounded-[22px] rounded-tr-sm px-4 py-3 text-[11px] leading-relaxed text-white/92"
          style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.24), rgba(59,130,246,0.18))",
            border: "1px solid rgba(139,92,246,0.20)",
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === "error") {
    return (
      <div
        className="rounded-[22px] px-4 py-3"
        style={{
          background: "rgba(127,29,29,0.20)",
          border: "1px solid rgba(248,113,113,0.24)",
        }}
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
          <p className="text-[11px] leading-relaxed text-rose-100/90">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return <AssistantMessage message={message} onOpenBrief={onOpenBrief} />;
}

function ApprovalBanner({
  approval,
  onApprove,
  onDismiss,
  ticker,
  query,
}: {
  approval: PendingApproval;
  onApprove: () => void;
  onDismiss: () => void;
  ticker: string;
  query: string;
}) {
  const router = useRouter();
  const isRunning = useResearchStore((state) => state.isRunning);
  const isBuy = approval.decision === "BUY";

  const openInTerminal = () => {
    const params = new URLSearchParams({
      from: "research",
      runId: approval.run_id,
      decision: approval.decision,
      sizeUsd: String(approval.size_usd),
      ticker,
      query,
    });
    router.push(`/terminal?${params.toString()}`);
  };

  return (
    <div
      className="mx-5 mb-4 rounded-[22px] p-4"
      style={{
        background: isBuy
          ? "linear-gradient(180deg, rgba(16,185,129,0.12), rgba(17,24,39,0.82))"
          : "linear-gradient(180deg, rgba(248,113,113,0.12), rgba(17,24,39,0.82))",
        border: isBuy
          ? "1px solid rgba(16,185,129,0.22)"
          : "1px solid rgba(248,113,113,0.22)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/28">
            Approval Required
          </p>
          <p className="mt-1 text-[13px] font-medium text-white/90">
            {approval.decision} {ticker} for about ${approval.size_usd.toFixed(2)}
          </p>
        </div>
        <span
          className={clsx(
            "rounded-full px-2 py-1 text-[9px] font-medium",
            isBuy ? "bg-emerald-500/15 text-emerald-100" : "bg-rose-500/15 text-rose-100",
          )}
        >
          Assisted mode
        </span>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-white/58">
        The agents found an executable thesis on HashKey Chain. Approve to continue into the
        execution path, or review it in Terminal first.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onApprove}
          disabled={isRunning}
          className="flex-1 rounded-xl px-3 py-2 text-[10px] font-medium text-white transition-colors disabled:opacity-40"
          style={{
            background: isBuy ? "rgba(16,185,129,0.24)" : "rgba(248,113,113,0.24)",
            border: isBuy
              ? "1px solid rgba(16,185,129,0.28)"
              : "1px solid rgba(248,113,113,0.28)",
          }}
        >
          {isRunning ? "Processing..." : "Approve & Execute"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={isRunning}
          className="rounded-xl px-3 py-2 text-[10px] font-medium text-white/56 transition-colors hover:text-white/80 disabled:opacity-40"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          Dismiss
        </button>
      </div>

      <button
        type="button"
        onClick={openInTerminal}
        disabled={isRunning}
        className="mt-3 inline-flex items-center gap-1.5 text-[10px] text-white/42 transition-colors hover:text-white/72 disabled:opacity-40"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Execute in Terminal
      </button>
    </div>
  );
}

export default function ResearchChat() {
  const { address } = useAccount();
  const [input, setInput] = useState("");

  const messages = useResearchStore((state) => state.messages);
  const isRunning = useResearchStore((state) => state.isRunning);
  const mode = useResearchStore((state) => state.mode);
  const currentTicker = useResearchStore((state) => state.currentTicker);
  const currentReceipt = useResearchStore((state) => state.currentReceipt);
  const currentReport = useResearchStore((state) => state.currentReport);
  const pendingApproval = useResearchStore((state) => state.pendingApproval);
  const addUserMessage = useResearchStore((state) => state.addUserMessage);
  const startAssistantDraft = useResearchStore((state) => state.startAssistantDraft);
  const applyEvent = useResearchStore((state) => state.applyEvent);
  const setReceiptOpen = useResearchStore((state) => state.setReceiptOpen);
  const setReportOpen = useResearchStore((state) => state.setReportOpen);
  const clearPendingApproval = useResearchStore((state) => state.clearPendingApproval);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastQueryRef = useRef<string>("");
  const activeRunRef = useRef<{ runId: string; seq: number } | null>(null);
  const didResumeRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingApproval]);

  // Apply an SSE event stream, tracking durable deep runs for reconnect (P5).
  const consumeStream = useCallback(
    async (body: ReadableStream<Uint8Array>) => {
      for await (const evt of parseSSE(body)) {
        applyEvent(evt);

        if (evt.type === "run.start" && evt.payload?.deep === true) {
          const seq = typeof evt.seq === "number" ? evt.seq : 0;
          activeRunRef.current = { runId: evt.run_id, seq };
          writeActiveRun({ runId: evt.run_id, seq, wallet: address ?? "" });
        } else if (activeRunRef.current && typeof evt.seq === "number") {
          activeRunRef.current = { runId: activeRunRef.current.runId, seq: evt.seq };
          writeActiveRun({
            runId: activeRunRef.current.runId,
            seq: evt.seq,
            wallet: address ?? "",
          });
        }

        if (evt.type === "run.done" || evt.type === "run.error") {
          activeRunRef.current = null;
          clearActiveRun();
          break;
        }
      }
    },
    [applyEvent, address],
  );

  // Reconnect to an in-progress deep run after a reload / tab switch.
  const resumeRun = useCallback(
    async (runId: string, fromSeq: number) => {
      if (!address) return;
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      activeRunRef.current = { runId, seq: fromSeq };
      startAssistantDraft("Reconnecting to your in-progress research run…");

      try {
        const res = await fetch(
          `/api/research/run?runId=${encodeURIComponent(runId)}&afterSeq=${fromSeq}`,
          {
            signal: abortRef.current.signal,
            headers: { "x-wallet-address": address },
          },
        );

        if (!res.ok || !res.body) {
          clearActiveRun();
          activeRunRef.current = null;
          applyEvent({
            type: "run.error",
            run_id: runId,
            ts: new Date().toISOString(),
            agent: "orchestrator",
            message: "Could not reconnect to the previous research run.",
          });
          return;
        }

        await consumeStream(res.body);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        // Leave the active marker so a later mount can retry the reconnect.
      }
    },
    [address, applyEvent, consumeStream, startAssistantDraft],
  );

  // On load, resume a durable deep run that belongs to this wallet (once).
  useEffect(() => {
    if (!address || didResumeRef.current || isRunning) return;
    const active = readActiveRun();
    if (!active || !active.runId) return;
    if (active.wallet?.toLowerCase() !== address.toLowerCase()) {
      clearActiveRun();
      return;
    }
    didResumeRef.current = true;
    resumeRun(active.runId, active.seq ?? 0);
  }, [address, isRunning, resumeRun]);

  const sendQuery = useCallback(
    async (query: string, executionApproved = false) => {
      const trimmed = query.trim();
      if (!trimmed || isRunning || !address) return;

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      lastQueryRef.current = trimmed;

      addUserMessage(
        executionApproved
          ? "Approve and execute the current HashKey Chain thesis."
          : trimmed,
      );
      startAssistantDraft(
        executionApproved
          ? "Re-running the ATS stack with execution approval enabled."
          : undefined,
      );
      if (!executionApproved) setInput("");

      try {
        const res = await fetch("/api/research/run", {
          method: "POST",
          signal: abortRef.current.signal,
          headers: {
            "Content-Type": "application/json",
            "x-wallet-address": address,
          },
          body: JSON.stringify({
            query: trimmed,
            mode,
            ...(executionApproved ? { executionApproved: true } : {}),
          }),
        });

        if (!res.ok) {
          let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
          try {
            const data = (await res.json()) as { error?: string };
            if (data.error) errorMessage = data.error;
          } catch {
            // Ignore JSON parse errors for non-stream responses.
          }

          applyEvent({
            type: "run.error",
            run_id: `err_${Date.now()}`,
            ts: new Date().toISOString(),
            agent: "orchestrator",
            message: errorMessage,
          });
          return;
        }

        if (!res.body) {
          applyEvent({
            type: "run.error",
            run_id: `err_${Date.now()}`,
            ts: new Date().toISOString(),
            agent: "orchestrator",
            message: "Research stream closed before any data arrived.",
          });
          return;
        }

        await consumeStream(res.body);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        applyEvent({
          type: "run.error",
          run_id: `err_${Date.now()}`,
          ts: new Date().toISOString(),
          agent: "orchestrator",
          message: (error as Error).message ?? "Unknown error",
        });
      }
    },
    [address, addUserMessage, applyEvent, consumeStream, isRunning, mode, startAssistantDraft],
  );

  const handleApprove = useCallback(() => {
    const query = lastQueryRef.current;
    if (!query) return;
    sendQuery(query, true);
  }, [sendQuery]);

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
    applyEvent({
      type: "run.error",
      run_id: `abort_${Date.now()}`,
      ts: new Date().toISOString(),
      agent: "orchestrator",
      message: "Research stopped by user.",
    });
  }, [applyEvent]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendQuery(input);
      }
    },
    [input, sendQuery],
  );

  const handlePromptSelect = useCallback((prompt: string) => {
    setInput(prompt);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  return (
    <aside
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      style={{
        background: "linear-gradient(180deg, rgba(17,17,27,0.98) 0%, rgba(8,9,16,0.99) 100%)",
      }}
    >
      <div
        className="flex items-center justify-between gap-3 px-5 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{
              background: "rgba(139,92,246,0.14)",
              border: "1px solid rgba(139,92,246,0.18)",
            }}
          >
            <Sparkles className="h-4.5 w-4.5 text-violet-100" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white/92">
              ATS Research
            </p>
            <p className="truncate text-[10px] text-white/34">
              Six-agent report desk for HashKey Chain research runs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "rounded-full px-2 py-1 text-[9px] font-medium uppercase tracking-[0.18em]",
              mode === "autonomous"
                ? "bg-emerald-500/12 text-emerald-100"
                : mode === "assisted"
                  ? "bg-sky-500/12 text-sky-100"
                  : "bg-white/6 text-white/50",
            )}
          >
            {mode}
          </span>
          {currentReceipt && !isRunning && (
            <button
              type="button"
              onClick={() => setReceiptOpen(true)}
              className="rounded-xl px-2.5 py-2 text-[10px] text-white/70 transition-colors hover:text-white"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              Brief
            </button>
          )}
          {currentReport && !isRunning && (
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[10px] font-medium text-violet-100 transition-colors hover:text-white"
              style={{
                background: "rgba(139,92,246,0.15)",
                border: "1px solid rgba(139,92,246,0.22)",
              }}
            >
              <FileText className="h-3.5 w-3.5" />
              Report
            </button>
          )}
          {isRunning && (
            <button
              type="button"
              onClick={handleAbort}
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[10px] text-rose-100"
              style={{
                background: "rgba(248,113,113,0.12)",
                border: "1px solid rgba(248,113,113,0.18)",
              }}
            >
              <Square className="h-3 w-3 fill-current" />
              Stop
            </button>
          )}
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto px-5 py-5"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.08) transparent",
        }}
      >
        {messages.length === 0 ? (
          <div className="mx-auto flex min-h-full w-full max-w-[420px] flex-col justify-center gap-5 py-2">
            <div
              className="rounded-[26px] p-5"
              style={{
                background: "linear-gradient(180deg, rgba(139,92,246,0.11), rgba(255,255,255,0.025))",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{
                  background: "rgba(139,92,246,0.14)",
                  border: "1px solid rgba(139,92,246,0.18)",
                }}
              >
                <Sparkles className="h-5 w-5 text-violet-100" />
              </div>

              <h2 className="mt-5 text-[26px] font-semibold leading-tight text-white/[0.94]">
                Deep research before you size the trade.
              </h2>
              <p className="mt-3 text-[13px] leading-relaxed text-white/[0.48]">
                Ask about any token, basket, or market theme. Multi-agent deep
                research decomposes your query, gathers cross-verified evidence,
                and returns a cited report with allocation guidance you can act
                on — attested on 0G.
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/30">
                  Start Fast
                </p>
                <span className="text-[10px] text-white/[0.28]">4 presets</span>
              </div>
              <div className="grid gap-2">
                {QUICK_PROMPTS.map((item) => (
                  <PromptChip
                    key={item.label}
                    label={item.label}
                    description={item.description}
                    prompt={item.prompt}
                    icon={item.icon}
                    onSelect={handlePromptSelect}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                ["Multi-asset", "Baskets & themes ok"],
                ["Risk first", "Max loss included"],
                ["0G attested", "Proof on every report"],
              ].map(([title, body]) => (
                <div
                  key={title}
                  className="rounded-2xl px-3 py-3"
                  style={{
                    background: "rgba(255,255,255,0.035)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <p className="text-[11px] font-medium text-white/[0.76]">
                    {title}
                  </p>
                  <p className="mt-1 text-[9px] leading-snug text-white/[0.34]">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onOpenBrief={() => setReceiptOpen(true)}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {pendingApproval && (
        <ApprovalBanner
          approval={pendingApproval}
          onApprove={handleApprove}
          onDismiss={clearPendingApproval}
          ticker={currentTicker ?? currentReceipt?.ticker ?? "TOKEN"}
          query={lastQueryRef.current}
        />
      )}

      <div
        className="px-5 pb-4 pt-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {!address && (
          <p className="mb-3 text-center text-[11px] text-amber-300/85">
            Connect your wallet to run ATS research.
          </p>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendQuery(input);
          }}
          className="overflow-hidden rounded-[24px] shadow-lg shadow-black/20"
          style={{
            background: "rgba(11,12,20,0.98)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isRunning || !address}
              placeholder="Ask anything — e.g. Is WHSK worth entering this week? or I have 50 USDC, where should I invest?"
              rows={3}
              className="min-h-[104px] w-full resize-none bg-transparent px-11 py-4 pr-12 text-[13px] leading-relaxed text-white placeholder:text-white/[0.28] focus:outline-none disabled:opacity-45"
            />
            <div className="pointer-events-none absolute left-4 top-4 text-white/[0.28]">
              <Search className="h-4 w-4" />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isRunning || !address}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:scale-[1.03] disabled:opacity-30 disabled:hover:scale-100"
              style={{
                background:
                  input.trim() && !isRunning && address
                    ? "linear-gradient(135deg, rgba(139,92,246,0.95), rgba(59,130,246,0.95))"
                    : "rgba(255,255,255,0.06)",
              }}
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <Send className="h-4 w-4 text-white" />
              )}
            </button>
          </div>

          <div
            className="flex items-center justify-between px-4 py-3 text-[10px] text-white/[0.34]"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <span>Ask anything · single-token prompts get a full agent brief.</span>
            <span>Enter to send · Shift+Enter newline</span>
          </div>
        </form>

        <p className="pt-3 text-center text-[10px] text-white/[0.28]">
          AI research can be wrong. Verify important positions before acting.
        </p>
      </div>

      <DecisionReceiptDrawer />
      <ResearchReportDrawer />
    </aside>
  );
}
