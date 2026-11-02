---
type: "path_query"
date: "2026-04-18T11:29:31.050762+00:00"
question: "Path from wallet analysis to WalletAnalysisPanel"
contributor: "graphify"
source_nodes: ["WalletAnalysisPanel.tsx", "useWalletAnalysis()", "useWalletAnalysisQuery()", "analyzeWallet()"]
---

# Q: Path from wallet analysis to WalletAnalysisPanel

## Answer

No single shortest path exists in the current repo-level graph. The graph fragments show WalletAnalysisPanel.tsx importing from the hooks barrel, hooks/index.ts exporting useWalletAnalysis and useWalletAnalysisQuery, and those hooks calling analyzeWallet via lib/api/wallet-analysis.ts, but cross-folder alias resolution was not stitched into one graph path.

## Source Nodes

- WalletAnalysisPanel.tsx
- useWalletAnalysis()
- useWalletAnalysisQuery()
- analyzeWallet()