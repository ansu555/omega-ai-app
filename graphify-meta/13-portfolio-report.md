# Graph Report - /home/anik2003/Documents/omeswap/components/portfolio  (2026-04-18)

## Corpus Check
- Corpus is ~3,529 words - fits in a single context window. You may not need a graph.

## Summary
- 20 nodes · 15 edges · 8 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Address Management|Address Management]]
- [[_COMMUNITY_Agent Wallet Card|Agent Wallet Card]]
- [[_COMMUNITY_Net Worth Display|Net Worth Display]]
- [[_COMMUNITY_Portfolio Summary|Portfolio Summary]]
- [[_COMMUNITY_Portfolio Table|Portfolio Table]]
- [[_COMMUNITY_Wallet Analysis Demo|Wallet Analysis Demo]]
- [[_COMMUNITY_Wallet Analysis Panel|Wallet Analysis Panel]]
- [[_COMMUNITY_Portfolio Exports|Portfolio Exports]]

## God Nodes (most connected - your core abstractions)
1. `saveToLocalStorage()` - 3 edges
2. `handleAddAddress()` - 3 edges
3. `validateAddress()` - 2 edges
4. `handleDeleteAddress()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Address Management"
Cohesion: 0.43
Nodes (4): handleAddAddress(), handleDeleteAddress(), saveToLocalStorage(), validateAddress()

### Community 1 - "Agent Wallet Card"
Cohesion: 1.0
Nodes (0): 

### Community 2 - "Net Worth Display"
Cohesion: 1.0
Nodes (0): 

### Community 3 - "Portfolio Summary"
Cohesion: 1.0
Nodes (0): 

### Community 4 - "Portfolio Table"
Cohesion: 1.0
Nodes (0): 

### Community 5 - "Wallet Analysis Demo"
Cohesion: 1.0
Nodes (0): 

### Community 6 - "Wallet Analysis Panel"
Cohesion: 1.0
Nodes (0): 

### Community 7 - "Portfolio Exports"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Agent Wallet Card`** (2 nodes): `AgentWalletCard()`, `AgentWalletCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Net Worth Display`** (2 nodes): `NetWorthCard.tsx`, `formatCurrency()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Portfolio Summary`** (2 nodes): `PortfolioSummary.tsx`, `PortfolioSummary()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Portfolio Table`** (2 nodes): `PortfolioTable.tsx`, `PortfolioTable()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Wallet Analysis Demo`** (2 nodes): `WalletAnalysisDemo.tsx`, `WalletAnalysisDemo()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Wallet Analysis Panel`** (2 nodes): `WalletAnalysisPanel.tsx`, `handleRefresh()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Portfolio Exports`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Not enough signal to generate questions. This usually means the corpus has no AMBIGUOUS edges, no bridge nodes, no INFERRED relationships, and all communities are tightly cohesive. Add more files or run with --mode deep to extract richer edges._