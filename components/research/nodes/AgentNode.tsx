"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { AgentNodeData, NodeState } from "@/store/research";
import clsx from "clsx";

type AgentNodeProps = NodeProps & { data: AgentNodeData };

const STATE_CONFIG: Record<
  NodeState,
  {
    border: string;
    glow: string;
    headerBg: string;
    dot: string;
    dotPulse: boolean;
    badge: string;
    badgeText: string;
    processLabel: string;
    handleColor: string;
  }
> = {
  idle: {
    border: "border-white/[0.08]",
    glow: "",
    headerBg: "rgba(255,255,255,0.025)",
    dot: "#4b5563",
    dotPulse: false,
    badge: "bg-white/[0.06] text-white/40 border border-white/[0.08]",
    badgeText: "Standby",
    processLabel: "Scope",
    handleColor: "#374151",
  },
  thinking: {
    border: "border-violet-500/50",
    glow: "shadow-[0_0_32px_rgba(139,92,246,0.28),0_0_8px_rgba(139,92,246,0.12)]",
    headerBg: "rgba(139,92,246,0.08)",
    dot: "#a78bfa",
    dotPulse: true,
    badge: "bg-violet-500/20 text-violet-200 border border-violet-500/30",
    badgeText: "Thinking",
    processLabel: "Running",
    handleColor: "#7c3aed",
  },
  done: {
    border: "border-emerald-500/45",
    glow: "shadow-[0_0_28px_rgba(52,211,153,0.22),0_0_6px_rgba(52,211,153,0.10)]",
    headerBg: "rgba(52,211,153,0.07)",
    dot: "#34d399",
    dotPulse: false,
    badge: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    badgeText: "Done",
    processLabel: "Completed",
    handleColor: "#059669",
  },
  vetoed: {
    border: "border-rose-500/45",
    glow: "shadow-[0_0_28px_rgba(248,113,113,0.22),0_0_6px_rgba(248,113,113,0.10)]",
    headerBg: "rgba(248,113,113,0.07)",
    dot: "#f87171",
    dotPulse: false,
    badge: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
    badgeText: "Blocked",
    processLabel: "Halted",
    handleColor: "#be123c",
  },
};

export const AgentNode = memo(function AgentNode({ data }: AgentNodeProps) {
  const cfg = STATE_CONFIG[data.state];
  const doneSubTasks = data.subTasks.filter((t) => t.done).length;
  const isIdle = data.state === "idle";
  const isThinking = data.state === "thinking";

  return (
    <div
      className={clsx(
        "relative w-[260px] rounded-2xl border transition-all duration-300",
        cfg.border,
        cfg.glow,
        isIdle && "opacity-70",
      )}
      style={{
        background:
          "linear-gradient(160deg, rgba(16,16,26,0.97) 0%, rgba(10,10,20,0.99) 100%)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: cfg.handleColor,
          border: "2px solid rgba(255,255,255,0.12)",
          width: 9,
          height: 9,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: cfg.handleColor,
          border: "2px solid rgba(255,255,255,0.12)",
          width: 9,
          height: 9,
        }}
      />

      {/* Header strip */}
      <div
        className="flex items-center justify-between rounded-t-2xl px-3.5 py-2.5"
        style={{ background: cfg.headerBg, borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={clsx("h-2 w-2 shrink-0 rounded-full", cfg.dotPulse && "animate-pulse")}
            style={{ background: cfg.dot }}
          />
          <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-white/45 truncate">
            {data.roleLabel}
          </p>
        </div>
        <span
          className={clsx(
            "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wide",
            cfg.badge,
          )}
        >
          {cfg.badgeText}
        </span>
      </div>

      {/* Body */}
      <div className="px-3.5 pb-3.5 pt-3">
        <h3 className="text-[15px] font-semibold leading-tight text-white/90">
          {data.label}
        </h3>

        {/* Process row */}
        <div className="mt-3 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[8.5px] font-medium uppercase tracking-[0.2em] text-white/35">
            {cfg.processLabel}
          </p>
          <p className="mt-1 text-[11.5px] leading-snug text-white/72">
            {data.processLabel}
          </p>
        </div>

        {/* Thinking progress bar */}
        {isThinking && (
          <div className="mt-2.5 h-[3px] overflow-hidden rounded-full" style={{ background: "rgba(139,92,246,0.18)" }}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-sky-400"
              style={{ animation: "agentnode-sweep 1.6s ease-in-out infinite" }}
            />
          </div>
        )}

        {/* Latest output */}
        <div
          className="mt-2.5 rounded-xl px-3 py-2.5"
          style={{ background: "rgba(255,255,255,0.026)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <p className="text-[8.5px] font-medium uppercase tracking-[0.2em] text-white/35">
            {isIdle ? "Awaiting" : "Output"}
          </p>
          <p
            className={clsx(
              "mt-1 text-[11px] leading-snug line-clamp-3",
              isIdle ? "text-white/35 italic" : "text-white/65",
            )}
          >
            {data.lastOutput || "Waiting for handoff from upstream agents."}
          </p>
        </div>

        {/* Confidence + subtask count */}
        {(data.confidence !== null || data.subTasks.length > 0) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {data.confidence !== null && (
              <span
                className="rounded-full px-2.5 py-1 text-[9px] font-medium text-white/65"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {Math.round(data.confidence * 100)}% confidence
              </span>
            )}
            {data.subTasks.length > 0 && (
              <span
                className="rounded-full px-2.5 py-1 text-[9px] font-medium text-white/65"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {doneSubTasks}/{data.subTasks.length} modules
              </span>
            )}
          </div>
        )}

        {/* Subtask chips */}
        {data.subTasks.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {data.subTasks.map((task) => (
              <div
                key={task.label}
                className={clsx(
                  "rounded-lg px-2 py-1.5 text-[9px] text-center font-medium transition-all duration-200",
                  task.done ? "text-emerald-300" : "text-white/38",
                )}
                style={{
                  background: task.done ? "rgba(16,185,129,0.14)" : "rgba(255,255,255,0.03)",
                  border: task.done ? "1px solid rgba(16,185,129,0.24)" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {task.done && <span className="mr-1 opacity-80">✓</span>}
                {task.label}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes agentnode-sweep {
          0%   { width: 0%;   margin-left: 0%;    }
          50%  { width: 55%;  margin-left: 22%;   }
          100% { width: 0%;   margin-left: 100%;  }
        }
      `}</style>
    </div>
  );
});

export default AgentNode;
