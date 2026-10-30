# Graph Report - components/providers  (2026-04-19)

## Corpus Check
- Corpus is ~463 words - fits in a single context window. You may not need a graph.

## Summary
- 14 nodes · 7 edges · 7 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Chat Context Provider|Chat Context Provider]]
- [[_COMMUNITY_TxnLab Wallet Context|TxnLab Wallet Context]]
- [[_COMMUNITY_RainbowKit Integration|RainbowKit Integration]]
- [[_COMMUNITY_Theme State Provider|Theme State Provider]]
- [[_COMMUNITY_Wallet State Provider|Wallet State Provider]]
- [[_COMMUNITY_Avalanche Wallet Adapter|Avalanche Wallet Adapter]]
- [[_COMMUNITY_Provider Exports Index|Provider Exports Index]]

## God Nodes (most connected - your core abstractions)

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Chat Context Provider"
Cohesion: 0.67
Nodes (0): 

### Community 1 - "TxnLab Wallet Context"
Cohesion: 0.67
Nodes (0): 

### Community 2 - "RainbowKit Integration"
Cohesion: 1.0
Nodes (0): 

### Community 3 - "Theme State Provider"
Cohesion: 1.0
Nodes (0): 

### Community 4 - "Wallet State Provider"
Cohesion: 1.0
Nodes (0): 

### Community 5 - "Avalanche Wallet Adapter"
Cohesion: 1.0
Nodes (0): 

### Community 6 - "Provider Exports Index"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `RainbowKit Integration`** (2 nodes): `rainbowkit-wrapper.tsx`, `RainbowKitWrapper()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Theme State Provider`** (2 nodes): `theme-provider.tsx`, `ThemeProvider()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Wallet State Provider`** (2 nodes): `wallet-provider.tsx`, `WalletProvider()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Avalanche Wallet Adapter`** (1 nodes): `avalanche-wallet-provider.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Provider Exports Index`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Not enough signal to generate questions. This usually means the corpus has no AMBIGUOUS edges, no bridge nodes, no INFERRED relationships, and all communities are tightly cohesive. Add more files or run with --mode deep to extract richer edges._