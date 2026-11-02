---
type: "query"
date: "2026-04-18T11:43:50.986983+00:00"
question: "Where do workflow manager, node palette, and bot runner connect?"
contributor: "graphify"
source_nodes: ["WorkflowManager.tsx", "handleSave()", "listWorkflows()", "loadFromSession()", "setConfig()", "setStatus()", "runBot()", "NodePalette.tsx"]
---

# Q: Where do workflow manager, node palette, and bot runner connect?

## Answer

In this graph, WorkflowManager.tsx connects to runBot() through handleSave() -> listWorkflows() -> useStore.ts -> loadFromSession() -> setConfig() -> BaseNode.ts -> setStatus() -> runBot(). NodePalette.tsx does not connect to that chain here; it is an isolated degree-0 node in its own community, so the current graph does not show a shared bridge from NodePalette into the workflow manager or bot runner path.

## Source Nodes

- WorkflowManager.tsx
- handleSave()
- listWorkflows()
- loadFromSession()
- setConfig()
- setStatus()
- runBot()
- NodePalette.tsx