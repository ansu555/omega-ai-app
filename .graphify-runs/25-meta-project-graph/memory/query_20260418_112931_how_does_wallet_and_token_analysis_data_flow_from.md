---
type: "query"
date: "2026-04-18T11:29:31.025488+00:00"
question: "How does wallet and token analysis data flow from API routes into UI panels?"
contributor: "graphify"
source_nodes: ["WalletAnalysisPanel.tsx", "useWalletAnalysis()", "useWalletAnalysisQuery()", "analyzeWallet()", "TokenDetailPage"]
---

# Q: How does wallet and token analysis data flow from API routes into UI panels?

## Answer

The current repo-level graph does not contain a single end-to-end path for wallet or token analysis UI flow. Wallet analysis is split across folder graphs: WalletAnalysisPanel imports from hooks, useWalletAnalysis/useWalletAnalysisQuery call analyzeWallet, and analyzeWallet posts to the external backend at /wallet/analyze. Token detail UI fetches /api/token/{id} and renders FundamentalAnalysis, SocialAnalysis, and SecurityAnalysis. The separate /api/token/{id}/analysis route exists, but the token detail page does not call it, so there is no graph path from that route into the token detail page in the current codebase.

## Source Nodes

- WalletAnalysisPanel.tsx
- useWalletAnalysis()
- useWalletAnalysisQuery()
- analyzeWallet()
- TokenDetailPage