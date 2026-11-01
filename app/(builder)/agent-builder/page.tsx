"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/agent-builder/canvas/TopBar";
import NodePalette from "@/components/agent-builder/canvas/NodePalette";
import FlowCanvas from "@/components/agent-builder/canvas/FlowCanvas";
import ConfigPanel from "@/components/agent-builder/canvas/ConfigPanel";
import ToastContainer from "@/components/agent-builder/canvas/ToastContainer";
import ChartPanel from "@/components/agent-builder/canvas/ChartPanel";
import AgentSidebar from "@/components/agent-builder/canvas/AgentSidebar";
import { useStore } from "@/store/agent-builder";
import { useChatContext } from "@/components/providers/chat-provider";
import LiquidEther from "@/components/ui/liquid-ether";
import { NODE_REGISTRY } from "@/lib/agent-builder/nodes/registry";

// Map AI-generated block subTypes/types to actual registry node types
const AI_TO_REGISTRY: Record<string, string> = {
  // subType mappings
  price_trigger: "schedule_trigger",
  time_trigger: "schedule_trigger",
  event_trigger: "schedule_trigger",
  volume_trigger: "threshold",
  liquidity_trigger: "threshold",
  price_condition: "condition",
  balance_condition: "wallet_balance",
  time_condition: "condition",
  technical_indicator: "moving_average",
  buy: "swap",
  sell: "swap",
  stop_loss: "condition",
  take_profit: "condition",
  cancel_order: "notification",
  dca: "schedule_trigger",
  grid_trading: "condition",
  arbitrage: "condition",
  liquidity_provision: "swap",
  rebalancing: "swap",
  rsi: "moving_average",
  macd: "moving_average",
  bollinger_bands: "moving_average",
  volume_analysis: "accumulator",
  loop: "merge",
  // generic type fallbacks
  trigger: "schedule_trigger",
  indicator: "moving_average",
  action: "swap",
  strategy: "condition",
};

function resolveNodeType(block: {
  type: string;
  subType?: string;
}): string | null {
  // Try exact subType first
  if (block.subType && NODE_REGISTRY[block.subType]) return block.subType;
  // Try mapped subType
  if (block.subType && AI_TO_REGISTRY[block.subType])
    return AI_TO_REGISTRY[block.subType];
  // Try exact type
  if (NODE_REGISTRY[block.type]) return block.type;
  // Try mapped type
  if (AI_TO_REGISTRY[block.type]) return AI_TO_REGISTRY[block.type];
  return null;
}

function AgentBuilderContent() {
  const searchParams = useSearchParams();
  const publishMode =
    searchParams.get("mode") === "indicator" ? "indicator" : "strategy";
  const { chartOpen, setChartOpen, addNodeToCanvas, appendEdges, agentOpen } =
    useStore();
  const { setAgentBuilderMode } = useChatContext();

  // Enable agent builder mode when component mounts
  useEffect(() => {
    setAgentBuilderMode(true, {
      currentAgent: null,
      onBlocksGenerated: (blocks, connections) => {
        // Add blocks and build a map: chatbot block ID → canvas node ID
        const blockIdToNodeId: Record<string, string> = {};
        const nodeIds: string[] = [];
        let xOffset = 0;
        blocks.forEach((block) => {
          const nodeType = resolveNodeType(block);
          if (!nodeType) {
            console.warn(
              `Skipping unknown block type: ${block.type}/${block.subType}`,
            );
            nodeIds.push("");
            return;
          }
          const id = addNodeToCanvas(
            nodeType,
            block.position || { x: 200 + xOffset, y: 200 },
          );
          nodeIds.push(id);
          if (block.id) blockIdToNodeId[block.id] = id;
          xOffset += 280;
        });

        // Wire connections — c.source/c.target are chatbot block IDs, map to canvas IDs
        if (connections && connections.length > 0) {
          const edges = connections
            .map((c, i) => ({
              id: `e-${Date.now()}-${i}`,
              source: blockIdToNodeId[c.source] || "",
              sourceHandle: c.sourceHandle,
              target: blockIdToNodeId[c.target] || "",
              targetHandle: c.targetHandle,
              animated: true,
              type: "default" as const,
            }))
            .filter((e) => e.source && e.target);
          if (edges.length > 0) appendEdges(edges);
        } else if (nodeIds.filter(Boolean).length > 1) {
          // No connections provided — chain blocks sequentially as a fallback
          const validIds = nodeIds.filter(Boolean);
          const edges = validIds.slice(0, -1).map((id, i) => ({
            id: `e-${Date.now()}-${i}`,
            source: id,
            target: validIds[i + 1],
            animated: true,
            type: "default" as const,
          }));
          appendEdges(edges);
        }
      },
    });

    // Cleanup on unmount
    return () => {
      setAgentBuilderMode(false);
    };
  }, [setAgentBuilderMode, addNodeToCanvas]);

  return (
    <div
      className="min-h-screen pt-20 pb-4 px-3 md:px-6"
      style={{
        background:
          "radial-gradient(circle at 24% 18%, rgba(139,92,246,0.13), transparent 30%), radial-gradient(circle at 78% 4%, rgba(45,212,191,0.08), transparent 26%), linear-gradient(135deg, rgba(5,7,13,0.98), rgba(10,10,18,0.98))",
      }}
    >
      <div className="relative h-[calc(100vh-6rem)] overflow-hidden rounded-[28px] border border-white/10 bg-[#07080f]/80 backdrop-blur-xl shadow-2xl shadow-black/[0.45]">
        <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.15]">
          <LiquidEther
            colors={["#2d9eff", "#34d399", "#7c3aed"]}
            mouseForce={12}
            cursorSize={90}
            isViscous={false}
            viscous={30}
            iterationsViscous={32}
            iterationsPoisson={32}
            resolution={0.5}
            isBounce={false}
            autoDemo={true}
            autoSpeed={0.35}
            autoIntensity={1.4}
            takeoverDuration={0.25}
            autoResumeDelay={3000}
            autoRampDuration={0.6}
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        <div className="relative z-10 flex flex-col h-full overflow-hidden text-foreground">
          <TopBar publishMode={publishMode} />
          <div className="flex flex-1 min-h-0">
            <NodePalette />
            <FlowCanvas />
            <ConfigPanel />
            {agentOpen && <AgentSidebar />}
          </div>
          <ToastContainer />
          {chartOpen && <ChartPanel onClose={() => setChartOpen(false)} />}
        </div>
      </div>
    </div>
  );
}

export default function AgentBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-28 text-center text-zinc-500 text-sm">
          Loading builder…
        </div>
      }
    >
      <AgentBuilderContent />
    </Suspense>
  );
}
