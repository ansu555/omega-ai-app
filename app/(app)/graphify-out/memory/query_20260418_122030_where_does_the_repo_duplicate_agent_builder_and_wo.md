---
type: "query"
date: "2026-04-18T12:20:30.426872+00:00"
question: "Where does the repo duplicate agent-builder and workflow logic across the main app and avax-agent?"
contributor: "graphify"
source_nodes: ["runBot", "topologicalSort", "ScheduleTriggerNode", "BotRunner", "BacktestRunner", "WorkflowManager", "TopBar"]
---

# Q: Where does the repo duplicate agent-builder and workflow logic across the main app and avax-agent?

## Answer

The duplication is near-total and structural. The avax-agent/ directory is an independent Next.js app that mirrors the entire agent-builder system from the main app. Duplicated layers: (1) Engine layer: lib/engine/BotRunner.ts (topologicalSort, runBot) mirrors lib/engine/BotRunner.ts. (2) Backtest layer: lib/backtest/BacktestRunner.ts + fetchHistory.ts fully duplicated. (3) All 13 node types duplicated under lib/nodes/ (action, data, flow, logic). (4) All canvas UI components duplicated under components/canvas/ (TopBar, WorkflowManager, FlowCanvas, ConfigPanel, ChartPanel, AgentSidebar, BacktestConfigStrip, BacktestSummaryModal, NodePalette, ToastContainer). (5) Agent API routes: app/api/agent/route.ts vs app/api/agent-builder/agent/route.ts. (6) Templates, storage patterns, and node registry duplicated. The main app version lives at components/agent-builder/ and lib/ (relative paths), while avax-agent mirrors everything under avax-agent/components/canvas/ and avax-agent/lib/.

## Source Nodes

- runBot
- topologicalSort
- ScheduleTriggerNode
- BotRunner
- BacktestRunner
- WorkflowManager
- TopBar