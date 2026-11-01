---
type: "path_query"
date: "2026-04-18T11:29:31.043035+00:00"
question: "Path from token analysis route to token detail page"
contributor: "graphify"
source_nodes: ["POST()", "TokenDetailPage", "FundamentalAnalysis", "SecurityAnalysis"]
---

# Q: Path from token analysis route to token detail page

## Answer

There is no path because app/api/token/[id]/analysis/route.ts is not used by app/(app)/token/[id]/page.tsx. The token detail page fetches /api/token/{id} instead and passes the returned data into FundamentalAnalysis, SocialAnalysis, and SecurityAnalysis panels. The analysis route generates fundamental and technical text, but it is currently disconnected from the token detail page.

## Source Nodes

- POST()
- TokenDetailPage
- FundamentalAnalysis
- SecurityAnalysis