# Graph Report - components/providers  (2026-04-18)

## Corpus Check
- Corpus is ~435 words - fits in a single context window. You may not need a graph.

## Summary
- 13 nodes · 7 edges · 6 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Chat Provider|Chat Provider]]
- [[_COMMUNITY_Txnlab Wallet Provider|Txnlab Wallet Provider]]
- [[_COMMUNITY_Avalanche Wallet Provider|Avalanche Wallet Provider]]
- [[_COMMUNITY_Rainbowkit Wrapper|Rainbowkit Wrapper]]
- [[_COMMUNITY_Theme Provider|Theme Provider]]
- [[_COMMUNITY_Omeswap|Omeswap]]

## God Nodes (most connected - your core abstractions)

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Chat Provider"
Cohesion: 0.67
Nodes (0): 

### Community 1 - "Txnlab Wallet Provider"
Cohesion: 0.67
Nodes (0): 

### Community 2 - "Avalanche Wallet Provider"
Cohesion: 1.0
Nodes (0): 

### Community 3 - "Rainbowkit Wrapper"
Cohesion: 1.0
Nodes (0): 

### Community 4 - "Theme Provider"
Cohesion: 1.0
Nodes (0): 

### Community 5 - "Omeswap"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Avalanche Wallet Provider`** (2 nodes): `AvalancheWalletProvider()`, `avalanche-wallet-provider.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Rainbowkit Wrapper`** (2 nodes): `rainbowkit-wrapper.tsx`, `RainbowKitWrapper()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Theme Provider`** (2 nodes): `theme-provider.tsx`, `ThemeProvider()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Omeswap`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Not enough signal to generate questions. This usually means the corpus has no AMBIGUOUS edges, no bridge nodes, no INFERRED relationships, and all communities are tightly cohesive. Add more files or run with --mode deep to extract richer edges._