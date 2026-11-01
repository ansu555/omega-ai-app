---
type: "query"
date: "2026-04-18T10:13:38.993299+00:00"
question: "What are the main route entrypoints and layouts in the app?"
contributor: "graphify"
source_nodes: ["route.ts", "GET()", "POST()", "RootLayout()", "AppLayout()", "BuilderLayout()", "LandingLayout()"]
---

# Q: What are the main route entrypoints and layouts in the app?

## Answer

The graph shows three main API route entrypoints: app/api/crypto/route.ts with GET() and its market-data helpers, app/api/agent-builder/chat/route.ts with POST() and getOpenAIClient(), and app/api/agent-builder/agent/route.ts as a route file node with no connected handler extracted. It also shows four layout entrypoints: app/layout.tsx -> RootLayout(), app/(app)/layout.tsx -> AppLayout(), app/(builder)/layout.tsx -> BuilderLayout(), and app/(landing)/layout.tsx -> LandingLayout().

## Source Nodes

- route.ts
- GET()
- POST()
- RootLayout()
- AppLayout()
- BuilderLayout()
- LandingLayout()