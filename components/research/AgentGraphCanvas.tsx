"use client";

import { useMemo, type ReactNode } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  type NodeTypes,
} from "@xyflow/react";
import { Activity, CheckCircle2, Radar, ShieldAlert } from "lucide-react";
import "@xyflow/react/dist/style.css";
import { useResearchStore } from "@/store/research";
import { AgentNode } from "@/components/research/nodes/AgentNode";
import DeepResearchGraph from "@/components/research/DeepResearchGraph";

// ── Node type registry ────────────────────────────────────────────────────────

// Cast needed: xyflow NodeTypes expects NodeProps without data generic
const nodeTypes: NodeTypes = {
  agentNode: AgentNode as any,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AgentGraphCanvas() {
  const nodes = useResearchStore((s) => s.nodes);
  const edges = useResearchStore((s) => s.edges);
  const isRunning = useResearchStore((s) => s.isRunning);
  const currentRun = useResearchStore((s) => s.currentRun);
  const currentTicker = useResearchStore((s) => s.currentTicker);
  const deepActive = useResearchStore((s) => s.deepRun.active);

  // Always call hooks before any conditional return (Rules of Hooks).
  const graphStatus = useMemo(() => {
    const active = nodes.find((node) => node.data.state === "thinking");
    const complete = nodes.filter((node) => node.data.state === "done").length;
    const vetoed = nodes.filter((node) => node.data.state === "vetoed").length;

    return {
      activeLabel: active?.data.label ?? (isRunning ? "ATS stack" : "Idle"),
      complete,
      vetoed,
    };
  }, [isRunning, nodes]);

  // Deep Research runs render a dynamic graph; fixed ATS graph is for single-asset runs.
  if (deepActive) return <DeepResearchGraph />;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -left-32 top-0 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-300/[0.08] blur-3xl" />
      </div>

      <div className="pointer-events-none absolute left-4 right-4 top-4 z-20">
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 backdrop-blur-xl"
          style={{
            background: "linear-gradient(180deg, rgba(9,10,18,0.88), rgba(9,10,18,0.70))",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                background: "rgba(45,212,191,0.12)",
                border: "1px solid rgba(45,212,191,0.22)",
              }}
            >
              <Radar className="h-4.5 w-4.5 text-teal-300" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-medium uppercase tracking-[0.26em] text-white/40">
                Agent Graph
              </p>
              <h1 className="truncate text-[15px] font-semibold text-white/90">
                {currentTicker ? `${currentTicker} research desk` : "ATS research desk"}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              icon={<Activity className="h-3.5 w-3.5" />}
              label={isRunning ? "Running" : currentRun ? "Ready" : "Waiting"}
              value={graphStatus.activeLabel}
              active={isRunning}
            />
            <StatusPill
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              label="Complete"
              value={`${graphStatus.complete}/7`}
              accent="emerald"
            />
            <StatusPill
              icon={<ShieldAlert className="h-3.5 w-3.5" />}
              label="Veto"
              value={String(graphStatus.vetoed)}
              accent={graphStatus.vetoed > 0 ? "rose" : undefined}
            />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div
        className="absolute bottom-4 left-4 z-20 flex items-center gap-3 rounded-2xl px-3 py-2 text-[10px] backdrop-blur-xl"
        style={{
          background: "rgba(3,6,12,0.62)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {(
          [
            ["#4b5563", "Idle"],
            ["#8b5cf6", "Active"],
            ["#34d399", "Complete"],
            ["#f87171", "Veto"],
          ] as const
        ).map(([color, label]) => (
          <div key={label} className="flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: color }}
            />
            <span className="text-white/50">{label}</span>
          </div>
        ))}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        minZoom={0.62}
        maxZoom={1.35}
        proOptions={{ hideAttribution: true }}
        style={{ background: "transparent" }}
        fitViewOptions={{
          padding: 0.2,
          minZoom: 0.72,
          maxZoom: 1.06,
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1}
          color="rgba(255,255,255,0.04)"
        />
        <Controls
          position="bottom-right"
          style={{
            background: "rgba(8,9,16,0.82)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 14,
            overflow: "hidden",
          }}
          showInteractive={false}
        />
      </ReactFlow>

      <style>{`
        .react-flow__edge-path {
          transition: stroke 0.35s ease, stroke-width 0.25s ease, opacity 0.25s ease;
        }

        .react-flow__edge.animated path {
          stroke-dasharray: 7 7;
        }

        .react-flow__pane {
          cursor: grab;
        }

        .react-flow__pane:active {
          cursor: grabbing;
        }
      `}</style>
    </div>
  );
}

const ACCENT_STYLES: Record<string, { bg: string; border: string; icon: string; value: string }> = {
  emerald: {
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.20)",
    icon: "#34d399",
    value: "#6ee7b7",
  },
  rose: {
    bg: "rgba(248,113,113,0.08)",
    border: "rgba(248,113,113,0.20)",
    icon: "#f87171",
    value: "#fca5a5",
  },
  violet: {
    bg: "rgba(139,92,246,0.10)",
    border: "rgba(139,92,246,0.22)",
    icon: "#a78bfa",
    value: "#c4b5fd",
  },
};

function StatusPill({
  icon,
  label,
  value,
  active,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  active?: boolean;
  accent?: string;
}) {
  const a = (active ? ACCENT_STYLES.violet : accent ? ACCENT_STYLES[accent] : null);
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2"
      style={{
        background: a ? a.bg : "rgba(255,255,255,0.04)",
        border: `1px solid ${a ? a.border : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <span style={{ color: a ? a.icon : "rgba(255,255,255,0.45)" }}>{icon}</span>
      <span className="text-[9.5px] font-medium uppercase tracking-[0.18em] text-white/35">
        {label}
      </span>
      <span
        className="max-w-[120px] truncate text-[11px] font-semibold"
        style={{ color: a ? a.value : "rgba(255,255,255,0.82)" }}
      >
        {value}
      </span>
    </div>
  );
}
