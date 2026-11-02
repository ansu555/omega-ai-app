---
type: "path_query"
date: "2026-04-18T11:30:33.791525+00:00"
question: "Path from FlowCanvas to BotRunner"
contributor: "graphify"
source_nodes: ["FlowCanvas.tsx", "TopBar.tsx", "executeOnce()", "runBot()", "BotRunner.ts"]
---

# Q: Path from FlowCanvas to BotRunner

## Answer

The graph shortest path runs FlowCanvas.tsx -> Visual Workflow Canvas -> TopBar.tsx -> executeOnce() -> runBot() -> BotRunner.ts. In plain terms, the canvas sits inside the overall authoring surface, the top bar owns the run controls, executeOnce() is the live-run handoff, and BotRunner.ts contains the runtime engine. This is an architectural path rather than a direct import edge from FlowCanvas to BotRunner.

## Source Nodes

- FlowCanvas.tsx
- TopBar.tsx
- executeOnce()
- runBot()
- BotRunner.ts