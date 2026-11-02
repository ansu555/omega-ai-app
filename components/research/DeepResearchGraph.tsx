"use client";

import { useMemo, type ReactNode } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Activity,
  Database,
  FileCheck2,
  Network,
  Search,
  Wrench,
} from "lucide-react";
import { useResearchStore, type DeepPhase, type DeepRunState } from "@/store/research";
import { DeepNode, type DeepNodeData } from "@/components/research/nodes/DeepNode";

// ── Layout constants ───────────────────────────────────────────────────────────

const COL_LEAD = 40;
const COL_SUB = 360;
const COL_SYNTH = 760;
const COL_REPORT = 1100;
const CENTER_Y = 320;
const ROW_GAP = 158;

const nodeTypes: NodeTypes = {
  // xyflow's NodeTypes wants NodeProps without the data generic.
  deepNode: DeepNode as unknown as NodeTypes[string],
};

// Ordered phases for the stepper.
const PHASE_STEPS: { id: DeepPhase; label: string }[] = [
  { id: "planning", label: "Plan" },
  { id: "researching", label: "Research" },
  { id: "evaluating", label: "Evaluate" },
  { id: "synthesizing", label: "Synthesize" },
  { id: "citing", label: "Cite" },
  { id: "done", label: "Attest" },
];

function phaseIndex(phase: DeepPhase): number {
  const idx = PHASE_STEPS.findIndex((p) => p.id === phase);
  return idx === -1 ? 0 : idx;
}

// ── Graph derivation ───────────────────────────────────────────────────────────

function buildGraph(deep: DeepRunState): { nodes: Node<DeepNodeData>[]; edges: Edge[] } {
  const nodes: Node<DeepNodeData>[] = [];
  const edges: Edge[] = [];

  const subs = deep.subagents;
  const n = Math.max(subs.length, 1);
  const startY = CENTER_Y - ((n - 1) * ROW_GAP) / 2;

  // Lead
  nodes.push({
    id: "lead",
    type: "deepNode",
    position: { x: COL_LEAD, y: CENTER_Y - 40 },
    data: {
      kind: "lead",
      phase: deep.phase,
      goal: deep.goal,
      queryType: deep.queryType,
      objectiveCount: deep.objectives.length || subs.length,
    },
    draggable: false,
  });

  // Subagents
  subs.forEach((s, i) => {
    const y = startY + i * ROW_GAP;
    nodes.push({
      id: `sub-${s.id}`,
      type: "deepNode",
      position: { x: COL_SUB, y },
      data: {
        kind: "subagent",
        name: s.name,
        objective: s.objective,
        status: s.status,
        tools: s.tools,
        toolCalls: s.toolCalls,
        evidenceCount: s.evidenceCount,
        claims: s.claims,
        confidence: s.confidence,
        lastMessage: s.lastMessage,
      },
      draggable: false,
    });

    edges.push(edge(`lead-sub-${s.id}`, "lead", `sub-${s.id}`, edgeState(s.status)));
    edges.push(
      edge(
        `sub-${s.id}-synth`,
        `sub-${s.id}`,
        "synthesis",
        s.status === "done" ? "complete" : s.status === "error" ? "veto" : "idle",
      ),
    );
  });

  // Synthesis
  const synthActive = deep.phase === "synthesizing" || deep.phase === "citing";
  nodes.push({
    id: "synthesis",
    type: "deepNode",
    position: { x: COL_SYNTH, y: CENTER_Y - 40 },
    data: {
      kind: "synthesis",
      phase: deep.phase,
      confidence: deep.confidence,
      corroborated: deep.crossVerification?.corroborated ?? 0,
      contradicted: deep.crossVerification?.contradicted ?? 0,
      unverified: deep.crossVerification?.unverified ?? 0,
    },
    draggable: false,
  });

  // Report
  const proofReady = deep.phase === "done" && Boolean(deep.attestation);
  nodes.push({
    id: "report",
    type: "deepNode",
    position: { x: COL_REPORT, y: CENTER_Y - 40 },
    data: {
      kind: "report",
      phase: deep.phase,
      citationCoverage: deep.citation?.coverage ?? null,
      citations: deep.citation?.citations ?? 0,
      unsupported: deep.citation?.unsupported ?? 0,
      sealed: deep.attestation?.sealed ?? false,
      proofReady,
    },
    draggable: false,
  });

  edges.push(
    edge(
      "synth-report",
      "synthesis",
      "report",
      proofReady ? "complete" : synthActive ? "active" : "idle",
    ),
  );

  return { nodes, edges };
}

type EdgeState = "idle" | "active" | "complete" | "veto";

function edgeState(status: DeepRunState["subagents"][number]["status"]): EdgeState {
  if (status === "working") return "active";
  if (status === "done") return "complete";
  if (status === "error") return "veto";
  return "idle";
}

function edge(id: string, source: string, target: string, state: EdgeState): Edge {
  const color =
    state === "active" ? "#8b5cf6" : state === "complete" ? "#34d399" : state === "veto" ? "#f87171" : "#475569";
  return {
    id,
    source,
    target,
    type: "smoothstep",
    animated: state === "active",
    style: { stroke: color, strokeWidth: state === "idle" ? 1.4 : 2.2, opacity: state === "idle" ? 0.55 : 1 },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
  };
}

// ── Activity feed ──────────────────────────────────────────────────────────────

const ACTIVITY_ICON: Record<string, ReactNode> = {
  tool: <Wrench className="h-3 w-3 text-violet-300" />,
  evidence: <Database className="h-3 w-3 text-teal-300" />,
  subagent: <Network className="h-3 w-3 text-sky-300" />,
  plan: <Search className="h-3 w-3 text-amber-300" />,
  citation: <FileCheck2 className="h-3 w-3 text-emerald-300" />,
};

function activityIcon(kind: string): ReactNode {
  return ACTIVITY_ICON[kind] ?? <Activity className="h-3 w-3 text-white/45" />;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function DeepResearchGraph() {
  const deep = useResearchStore((s) => s.deepRun);

  const { nodes, edges } = useMemo(() => buildGraph(deep), [deep]);
  const recent = useMemo(() => deep.activity.slice(-7).reverse(), [deep.activity]);

  const activeIdx = phaseIndex(deep.phase);
  const working = deep.subagents.filter((s) => s.status === "working").length;
  const done = deep.subagents.filter((s) => s.status === "done").length;
  const evidenceTotal = deep.subagents.reduce((sum, s) => sum + s.evidenceCount, 0);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -left-32 top-0 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-300/[0.07] blur-3xl" />
      </div>

      {/* Header — phase stepper + live counters */}
      <div className="pointer-events-none absolute left-4 right-4 top-4 z-20">
        <div
          className="rounded-2xl px-4 py-3 backdrop-blur-xl"
          style={{
            background: "linear-gradient(180deg, rgba(9,10,18,0.9), rgba(9,10,18,0.72))",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.22)" }}
              >
                <Network className="h-4.5 w-4.5 text-violet-200" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-medium uppercase tracking-[0.26em] text-white/40">
                  Deep Research
                </p>
                <h1 className="truncate text-[15px] font-semibold text-white/90">
                  {deep.goal || "Multi-agent research desk"}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Counter label="Working" value={working} accent="violet" />
              <Counter label="Done" value={`${done}/${deep.subagents.length || 0}`} accent="emerald" />
              <Counter label="Evidence" value={evidenceTotal} />
            </div>
          </div>

          {/* Phase stepper */}
          <div className="mt-3 flex items-center gap-1.5">
            {PHASE_STEPS.map((step, i) => {
              const isDone = i < activeIdx || deep.phase === "done";
              const isActive = i === activeIdx && deep.phase !== "done";
              const isError = deep.phase === "error" && i === activeIdx;
              return (
                <div key={step.id} className="flex flex-1 items-center gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="flex h-1.5 w-1.5 rounded-full"
                      style={{
                        background: isError
                          ? "#f87171"
                          : isDone
                            ? "#34d399"
                            : isActive
                              ? "#a78bfa"
                              : "rgba(255,255,255,0.18)",
                        boxShadow: isActive ? "0 0 8px rgba(167,139,250,0.7)" : "none",
                      }}
                    />
                    <span
                      className="text-[9px] font-medium uppercase tracking-[0.14em]"
                      style={{
                        color: isActive
                          ? "rgba(196,181,253,0.95)"
                          : isDone
                            ? "rgba(110,231,183,0.8)"
                            : "rgba(255,255,255,0.32)",
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < PHASE_STEPS.length - 1 && (
                    <span
                      className="h-px flex-1"
                      style={{ background: isDone ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.08)" }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Activity feed */}
      {recent.length > 0 && (
        <div
          className="absolute bottom-4 left-4 z-20 w-[290px] rounded-2xl px-3 py-2.5 backdrop-blur-xl"
          style={{ background: "rgba(3,6,12,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="mb-1.5 flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.2em] text-white/40">
            <Activity className="h-3 w-3" /> Live activity
          </p>
          <div className="space-y-1.5">
            {recent.map((a) => (
              <div key={a.id} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">{activityIcon(a.kind)}</span>
                <p className="text-[10px] leading-snug text-white/60 line-clamp-2">{a.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

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
        minZoom={0.45}
        maxZoom={1.35}
        proOptions={{ hideAttribution: true }}
        style={{ background: "transparent" }}
        fitViewOptions={{ padding: 0.22, minZoom: 0.5, maxZoom: 1.0 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(255,255,255,0.04)" />
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
        .react-flow__edge-path { transition: stroke 0.35s ease, stroke-width 0.25s ease, opacity 0.25s ease; }
        .react-flow__edge.animated path { stroke-dasharray: 7 7; }
        .react-flow__pane { cursor: grab; }
        .react-flow__pane:active { cursor: grabbing; }
      `}</style>
    </div>
  );
}

const COUNTER_ACCENT: Record<string, { bg: string; border: string; value: string }> = {
  violet: { bg: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.22)", value: "#c4b5fd" },
  emerald: { bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.20)", value: "#6ee7b7" },
};

function Counter({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  const a = accent ? COUNTER_ACCENT[accent] : null;
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-1.5"
      style={{
        background: a ? a.bg : "rgba(255,255,255,0.04)",
        border: `1px solid ${a ? a.border : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-white/35">{label}</span>
      <span className="text-[12px] font-semibold" style={{ color: a ? a.value : "rgba(255,255,255,0.82)" }}>
        {value}
      </span>
    </div>
  );
}
