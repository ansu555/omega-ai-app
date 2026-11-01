---
type: "query"
date: "2026-04-18T11:30:33.699668+00:00"
question: "What are the core execution flows in the agent builder?"
contributor: "graphify"
source_nodes: ["TopBar.tsx", "runBot()", "runBacktest()", "createNodeInstance()"]
---

# Q: What are the core execution flows in the agent builder?

## Answer

The core execution flows split into authoring, live execution, and backtesting. CanvasPage composes TopBar, FlowCanvas, NodePalette, and ConfigPanel; live runs start in handleRun(), optionally loop through ScheduleTriggerNode, and funnel through executeOnce() into runBot(), which topologically sorts the graph and executes each node instance in order. Backtests start in handleBacktest(), fetch candles, then call runBacktest(), which snapshots state, mocks blockchain-facing nodes like SwapNode, reuses runBot() once per candle, and restores state afterward. Node construction comes from NODE_REGISTRY and createNodeInstance(), which bridge authoring-time node types to runtime instances.

## Source Nodes

- TopBar.tsx
- runBot()
- runBacktest()
- createNodeInstance()