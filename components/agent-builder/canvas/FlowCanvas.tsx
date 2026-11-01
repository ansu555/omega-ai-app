"use client";

import { useCallback, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useStore } from "@/store/agent-builder";
import BaseNodeComponent from "@/components/agent-builder/nodes/BaseNodeComponent";
import {
  LayoutTemplate,
  Bot,
  Play,
  Circle,
  Workflow,
  ArrowUpRight,
} from "lucide-react";
import clsx from "clsx";

const nodeTypes: NodeTypes = {
  avaxNode: BaseNodeComponent,
};

export default function FlowCanvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNodeToCanvas,
    selectNode,
    setWorkflowsOpen,
    setAgentOpen,
    botRunning,
    logs,
  } = useStore();

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/avax-node-type");
      if (!type) return;

      const bounds = e.currentTarget.getBoundingClientRect();
      const position = {
        x: e.clientX - bounds.left - 80,
        y: e.clientY - bounds.top - 30,
      };

      addNodeToCanvas(type, position);
    },
    [addNodeToCanvas],
  );

  // Last run timestamp from most recent log entry
  const lastRunTime = useMemo(() => {
    if (logs.length === 0) return null;
    const last = logs[logs.length - 1];
    return last.timestamp.toLocaleTimeString();
  }, [logs]);

  // HashKey Chain exposure: sum amountIn from all swap nodes
  const chainExposure = useMemo(() => {
    let total = 0;
    for (const node of nodes) {
      const nodeType = (node.data as Record<string, unknown>)
        ?.nodeType as string;
      if (nodeType === "swap" || nodeType === "limit_order") {
        // read from nodeInstances via store — accessed indirectly through node.data config
        const config = (node.data as Record<string, unknown>)?.config as
          | Record<string, unknown>
          | undefined;
        if (config?.amountIn) total += parseFloat(String(config.amountIn)) || 0;
      }
    }
    return total;
  }, [nodes]);

  // Complexity label
  const complexity = useMemo(() => {
    const n = nodes.length;
    if (n === 0) return null;
    if (n <= 5) return { label: "Simple", color: "text-green-400" };
    if (n <= 12) return { label: "Moderate", color: "text-yellow-400" };
    return { label: "Complex", color: "text-orange-400" };
  }, [nodes.length]);

  const reduceMotion = useReducedMotion();

  // Empty-state quick-start actions — handlers unchanged, only presentation refined
  const startActions = useMemo(
    () => [
      {
        icon: LayoutTemplate,
        label: "Browse Templates",
        description: "Open a pre-built strategy",
        onClick: () => setWorkflowsOpen(true),
      },
      {
        icon: Bot,
        label: "AI Build",
        description: "Describe your strategy in words",
        onClick: () => setAgentOpen(true),
      },
      {
        icon: Play,
        label: "Quick Start",
        description: "Drop a Start node and build",
        onClick: () => addNodeToCanvas("start", { x: 200, y: 200 }),
      },
    ],
    [setWorkflowsOpen, setAgentOpen, addNodeToCanvas],
  );

  return (
    <div
      className="flex-1 relative bg-[#06070e] flex flex-col"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex-1 relative">
        {/* Ambient depth — subtle gradient blobs (matches Research canvas) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-12 h-96 w-96 rounded-full bg-violet-500/[0.07] blur-3xl" />
          <div className="absolute -right-24 top-16 h-80 w-80 rounded-full bg-cyan-400/[0.06] blur-3xl" />
          <div className="absolute -bottom-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-amber-300/[0.05] blur-3xl" />
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onPaneClick={() => selectNode(null)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: "rgba(139,92,246,0.35)", strokeWidth: 1.5 },
          }}
          proOptions={{ hideAttribution: true }}
          style={{ background: "transparent" }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            color={botRunning ? "rgba(139,92,246,0.30)" : "rgba(255,255,255,0.05)"}
            gap={24}
            size={1}
            className={botRunning ? "canvas-pulse" : ""}
          />
          <Controls
            className="!bg-[#08091a]/85 !backdrop-blur-xl !border !border-white/10 !rounded-2xl !shadow-lg !shadow-black/30"
            showInteractive={false}
          />
          <MiniMap
            className="!bg-[#08091a]/85 !backdrop-blur-xl !border !border-white/10 !rounded-2xl"
            nodeColor={(n) => {
              const cat = (n.data as Record<string, unknown>)
                ?.category as string;
              return cat === "data"
                ? "#3b82f6"
                : cat === "logic"
                  ? "#eab308"
                  : cat === "action"
                    ? "#22c55e"
                    : "#a855f7";
            }}
            maskColor="rgba(3,4,10,0.6)"
          />
        </ReactFlow>

        {/* Empty state quick-start */}
        <AnimatePresence>
          {nodes.length === 0 && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
              className="absolute inset-0 z-10 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="w-[440px] max-w-full pointer-events-auto">
                {/* Hero card */}
                <div
                  className="rounded-[26px] p-6"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(139,92,246,0.11), rgba(255,255,255,0.025))",
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
                    <Workflow className="h-5 w-5 text-violet-100" />
                  </div>
                  <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.24em] text-white/30">
                    Agent Builder
                  </p>
                  <h2 className="mt-2 text-[22px] font-semibold leading-tight text-white/[0.94]">
                    Design your trading strategy.
                  </h2>
                  <p className="mt-3 text-[13px] leading-relaxed text-white/[0.48]">
                    Compose a bot from blocks — data feeds, logic, and on-chain
                    actions wired into an automated flow you can backtest and run
                    live.
                  </p>
                </div>

                {/* Start fast */}
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/30">
                      Start Fast
                    </p>
                    <span className="text-[10px] text-white/[0.28]">3 ways</span>
                  </div>
                  <div className="grid gap-2">
                    {startActions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={action.label}
                          onClick={action.onClick}
                          className="group flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-300/50"
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
                                {action.label}
                              </span>
                              <span className="mt-0.5 block text-[10px] text-white/[0.38]">
                                {action.description}
                              </span>
                            </span>
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-white/[0.24] transition-colors group-hover:text-white/[0.64]" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <p className="mt-4 text-center text-[10px] text-white/[0.3]">
                  or drag a block from the left panel onto the canvas
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom status bar */}
      <div className="h-7 shrink-0 border-t border-white/[0.06] bg-[#07080f]/70 flex items-center px-4 gap-4 text-xs font-mono text-white/45">
        {/* Node + edge count */}
        <div className="flex items-center gap-1.5">
          <Circle
            size={6}
            className={clsx(
              botRunning ? "text-green-400 animate-pulse" : "text-white/20",
            )}
          />
          <span>{nodes.length} nodes</span>
          <span className="text-white/15">·</span>
          <span>{edges.length} edges</span>
        </div>

        {lastRunTime && (
          <>
            <span className="text-white/10">|</span>
            <span>Last run: {lastRunTime}</span>
          </>
        )}

        {chainExposure > 0 && (
          <>
            <span className="text-white/10">|</span>
            <span
              className={
                chainExposure > 5 ? "text-amber-400/70" : "text-white/25"
              }
            >
              Exposure: {chainExposure.toFixed(4)} WHSK
            </span>
          </>
        )}

        {complexity && (
          <>
            <span className="text-white/10">|</span>
            <span className={complexity.color + "/60"}>{complexity.label}</span>
          </>
        )}

        <div className="flex-1" />

        <span className="text-white/15">? for shortcuts</span>
      </div>
    </div>
  );
}
