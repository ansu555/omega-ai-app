---
type: "path_query"
date: "2026-04-18T10:13:43.139419+00:00"
question: "Path from layout to trade page"
contributor: "graphify"
source_nodes: ["RootLayout()", "page.tsx"]
---

# Q: Path from layout to trade page

## Answer

The fuzzy path matcher resolved layout to RootLayout() and trade page to AgentBuilderPage(), but the actual trade page node app/(app)/trade/page.tsx is isolated in the current graph with degree 0. Looking up the exact trade page node, there is no graph path from any extracted layout node to that page. This means the current AST graph did not capture a layout-to-trade routing relationship.

## Source Nodes

- RootLayout()
- page.tsx