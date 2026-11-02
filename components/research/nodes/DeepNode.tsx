"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import {
  Brain,
  CheckCircle2,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import type {
  DeepPhase,
  DeepSubagentStatus,
} from "@/store/research";

// ── Node data ──────────────────────────────────────────────────────────────────
// One custom node type renders all four roles in the deep-research graph. The
// `kind` discriminates the layout; the rest are role-specific fields.

export interface DeepNodeData extends Record<string, unknown> {
  kind: "lead" | "subagent" | "synthesis" | "report";
  // lead
  phase?: DeepPhase;
  goal?: string | null;
  queryType?: string | null;
  objectiveCount?: number;
  // subagent
  name?: string;
  objective?: string;
  status?: DeepSubagentStatus;
  tools?: string[];
  toolCalls?: number;
  evidenceCount?: number;
  claims?: number;
  confidence?: number | null;
  lastMessage?: string;
  // synthesis
  corroborated?: number;
  contradicted?: number;
  unverified?: number;
  // report
  citationCoverage?: number | null;
  citations?: number;
  unsupported?: number;
  sealed?: boolean;
  proofReady?: boolean;
}

type DeepNodeProps = NodeProps & { data: DeepNodeData };

const STATUS_CONFIG: Record<
  DeepSubagentStatus,
  { border: string; glow: string; dot: string; pulse: boolean; badge: string; label: string }
> = {
  spawned: {
    border: "border-white/[0.10]",
    glow: "",
    dot: "#64748b",
    pulse: false,
    badge: "bg-white/[0.06] text-white/45 border border-white/[0.08]",
    label: "Queued",
  },
  working: {
    border: "border-violet-500/50",
    glow: "shadow-[0_0_30px_rgba(139,92,246,0.26)]",
    dot: "#a78bfa",
    pulse: true,
    badge: "bg-violet-500/20 text-violet-200 border border-violet-500/30",
    label: "Working",
  },
  done: {
    border: "border-emerald-500/45",
    glow: "shadow-[0_0_26px_rgba(52,211,153,0.20)]",
    dot: "#34d399",
    pulse: false,
    badge: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    label: "Done",
  },
  error: {
    border: "border-rose-500/45",
    glow: "shadow-[0_0_24px_rgba(248,113,113,0.20)]",
    dot: "#f87171",
    pulse: false,
    badge: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
    label: "Error",
  },
};

const CARD_BG =
  "linear-gradient(160deg, rgba(16,16,26,0.97) 0%, rgba(10,10,20,0.99) 100%)";

function leftHandle(color: string) {
  return (
    <Handle
      type="target"
      position={Position.Left}
      style={{ background: color, border: "2px solid rgba(255,255,255,0.12)", width: 9, height: 9 }}
    />
  );
}

function rightHandle(color: string) {
  return (
    <Handle
      type="source"
      position={Position.Right}
      style={{ background: color, border: "2px solid rgba(255,255,255,0.12)", width: 9, height: 9 }}
    />
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[9px] font-medium text-white/65"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {children}
    </span>
  );
}

export const DeepNode = memo(function DeepNode({ data }: DeepNodeProps) {
  if (data.kind === "lead") return <LeadCard data={data} />;
  if (data.kind === "synthesis") return <SynthesisCard data={data} />;
  if (data.kind === "report") return <ReportCard data={data} />;
  return <SubagentCard data={data} />;
});

function LeadCard({ data }: { data: DeepNodeData }) {
  const active = data.phase !== "done" && data.phase !== "error" && data.phase !== "idle";
  return (
    <div
      className={clsx(
        "relative w-[240px] rounded-2xl border transition-all duration-300",
        active ? "border-cyan-400/50 shadow-[0_0_30px_rgba(45,212,191,0.22)]" : "border-white/[0.10]",
      )}
      style={{ background: CARD_BG, backdropFilter: "blur(16px)" }}
    >
      {rightHandle("#22d3ee")}
      <div
        className="flex items-center gap-2 rounded-t-2xl px-3.5 py-2.5"
        style={{ background: "rgba(45,212,191,0.08)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <span
          className={clsx("flex h-7 w-7 items-center justify-center rounded-lg")}
          style={{ background: "rgba(45,212,191,0.14)", border: "1px solid rgba(45,212,191,0.24)" }}
        >
          <Brain className="h-4 w-4 text-teal-300" />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-white/45">
            Lead Researcher
          </p>
          <p className="truncate text-[12px] font-semibold text-white/90">Orchestrator</p>
        </div>
      </div>
      <div className="px-3.5 pb-3.5 pt-3">
        <p className="text-[8.5px] font-medium uppercase tracking-[0.2em] text-white/35">Goal</p>
        <p className="mt-1 text-[11px] leading-snug text-white/72 line-clamp-3">
          {data.goal || "Decomposing the query…"}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {data.queryType && <Chip>{String(data.queryType).replace(/_/g, " ")}</Chip>}
          <Chip>{data.objectiveCount ?? 0} specialists</Chip>
        </div>
      </div>
    </div>
  );
}

function SubagentCard({ data }: { data: DeepNodeData }) {
  const status = data.status ?? "spawned";
  const cfg = STATUS_CONFIG[status];
  return (
    <div
      className={clsx("relative w-[248px] rounded-2xl border transition-all duration-300", cfg.border, cfg.glow)}
      style={{ background: CARD_BG, backdropFilter: "blur(16px)" }}
    >
      {leftHandle(cfg.dot)}
      {rightHandle(cfg.dot)}
      <div
        className="flex items-center justify-between rounded-t-2xl px-3.5 py-2.5"
        style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={clsx("h-2 w-2 shrink-0 rounded-full", cfg.pulse && "animate-pulse")}
            style={{ background: cfg.dot }}
          />
          <p className="truncate text-[12px] font-semibold text-white/88">{data.name || "Specialist"}</p>
        </div>
        <span className={clsx("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold", cfg.badge)}>
          {cfg.label}
        </span>
      </div>
      <div className="px-3.5 pb-3.5 pt-2.5">
        <p className="text-[10px] leading-snug text-white/55 line-clamp-2">
          {data.lastMessage || data.objective || "Awaiting dispatch from the lead."}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Chip>
            <Wrench className="mr-1 inline h-2.5 w-2.5" />
            {data.toolCalls ?? 0} calls
          </Chip>
          <Chip>{data.evidenceCount ?? 0} evidence</Chip>
          {status === "done" && <Chip>{data.claims ?? 0} claims</Chip>}
          {data.confidence != null && <Chip>{Math.round(data.confidence * 100)}%</Chip>}
        </div>
      </div>
    </div>
  );
}

function SynthesisCard({ data }: { data: DeepNodeData }) {
  const active = data.phase === "synthesizing" || data.phase === "citing";
  const done = data.phase === "done";
  return (
    <div
      className={clsx(
        "relative w-[236px] rounded-2xl border transition-all duration-300",
        active
          ? "border-violet-500/50 shadow-[0_0_30px_rgba(139,92,246,0.24)]"
          : done
            ? "border-emerald-500/45 shadow-[0_0_24px_rgba(52,211,153,0.18)]"
            : "border-white/[0.10]",
      )}
      style={{ background: CARD_BG, backdropFilter: "blur(16px)" }}
    >
      {leftHandle(active ? "#7c3aed" : "#475569")}
      {rightHandle(active ? "#7c3aed" : "#475569")}
      <div
        className="flex items-center gap-2 rounded-t-2xl px-3.5 py-2.5"
        style={{ background: "rgba(139,92,246,0.08)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: "rgba(139,92,246,0.14)", border: "1px solid rgba(139,92,246,0.24)" }}
        >
          {active ? (
            <Loader2 className="h-4 w-4 animate-spin text-violet-200" />
          ) : (
            <Sparkles className="h-4 w-4 text-violet-200" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-white/45">Synthesis</p>
          <p className="truncate text-[12px] font-semibold text-white/90">Cross-verify &amp; compose</p>
        </div>
      </div>
      <div className="px-3.5 pb-3.5 pt-2.5">
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <Stat label="Corrob." value={data.corroborated ?? 0} tone="good" />
          <Stat label="Contra." value={data.contradicted ?? 0} tone="bad" />
          <Stat label="Unver." value={data.unverified ?? 0} tone="warn" />
        </div>
        {data.confidence != null && (
          <p className="mt-2.5 text-center text-[10px] text-white/55">
            Overall confidence{" "}
            <span className="font-semibold text-white/80">{Math.round(data.confidence * 100)}%</span>
          </p>
        )}
      </div>
    </div>
  );
}

function ReportCard({ data }: { data: DeepNodeData }) {
  const ready = Boolean(data.proofReady);
  return (
    <div
      className={clsx(
        "relative w-[236px] rounded-2xl border transition-all duration-300",
        ready ? "border-emerald-500/50 shadow-[0_0_30px_rgba(52,211,153,0.22)]" : "border-white/[0.10]",
      )}
      style={{ background: CARD_BG, backdropFilter: "blur(16px)" }}
    >
      {leftHandle(ready ? "#059669" : "#475569")}
      <div
        className="flex items-center gap-2 rounded-t-2xl px-3.5 py-2.5"
        style={{
          background: ready ? "rgba(52,211,153,0.07)" : "rgba(255,255,255,0.03)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.22)" }}
        >
          {ready ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          ) : (
            <FileText className="h-4 w-4 text-white/55" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-white/45">Document</p>
          <p className="truncate text-[12px] font-semibold text-white/90">Cited report</p>
        </div>
      </div>
      <div className="px-3.5 pb-3.5 pt-2.5">
        {data.citationCoverage != null ? (
          <div className="flex flex-wrap gap-1.5">
            <Chip>{Math.round((data.citationCoverage ?? 0) * 100)}% sourced</Chip>
            <Chip>{data.citations ?? 0} cites</Chip>
            {(data.unsupported ?? 0) > 0 && <Chip>{data.unsupported} unsupported</Chip>}
          </div>
        ) : (
          <p className="text-[10px] text-white/50">Awaiting synthesis…</p>
        )}
        {ready && (
          <div
            className="mt-2.5 flex items-center gap-1.5 rounded-lg px-2 py-1.5"
            style={{
              background: data.sealed ? "rgba(45,212,191,0.10)" : "rgba(255,255,255,0.04)",
              border: data.sealed ? "1px solid rgba(45,212,191,0.22)" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <ShieldCheck className={clsx("h-3.5 w-3.5", data.sealed ? "text-teal-300" : "text-white/45")} />
            <span className="text-[9.5px] font-medium text-white/70">
              {data.sealed ? "Sealed on 0G" : "Content-hash proof"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "#6ee7b7" : tone === "bad" ? "#fca5a5" : "#fcd34d";
  return (
    <div
      className="rounded-lg px-1.5 py-1.5"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <p className="text-[14px] font-semibold leading-none" style={{ color }}>
        {value}
      </p>
      <p className="mt-1 text-[8px] uppercase tracking-[0.12em] text-white/35">{label}</p>
    </div>
  );
}

export default DeepNode;
