---
type: "path_query"
date: "2026-04-18T11:30:33.881011+00:00"
question: "Path from node registry to SwapNode"
contributor: "graphify"
source_nodes: ["registry.ts", "createNodeInstance()", "SwapNode"]
---

# Q: Path from node registry to SwapNode

## Answer

The literal graph path for node registry -> SwapNode is mostly conceptual because the query matched the concept node Build Docs From Node Registry rather than the concrete registry.ts structure. In source, the direct structural relationship is stronger: registry.ts imports SwapNode and registers it in NODE_REGISTRY under the swap key, then createNodeInstance() instantiates it at runtime. So the graph answer here is a retrieval mismatch, not a claim that SwapNode depends on backtest concepts.

## Source Nodes

- registry.ts
- createNodeInstance()
- SwapNode