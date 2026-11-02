# Graph Report - .  (2026-04-18)

## Corpus Check
- Corpus is ~5,729 words - fits in a single context window. You may not need a graph.

## Summary
- 21 nodes · 12 edges · 9 communities detected
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Wallet Analysis|Wallet Analysis]]
- [[_COMMUNITY_Custom Address Analysis|Custom Address Analysis]]
- [[_COMMUNITY_DEX Aggregation|DEX Aggregation]]
- [[_COMMUNITY_Pool Discovery|Pool Discovery]]
- [[_COMMUNITY_Swap Execution|Swap Execution]]
- [[_COMMUNITY_Liquidity Management|Liquidity Management]]
- [[_COMMUNITY_Mobile Detection|Mobile Detection]]
- [[_COMMUNITY_Pool Details|Pool Details]]
- [[_COMMUNITY_Hook Exports|Hook Exports]]

## God Nodes (most connected - your core abstractions)
1. `useAvalancheWallet()` - 3 edges
2. `useWalletAnalysisQuery()` - 2 edges
3. `useWalletAnalysis()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `useWalletAnalysisQuery()` --calls--> `useAvalancheWallet()`  [INFERRED]
  use-wallet-analysis-query.tsx → use-avalanche-wallet.tsx
- `useWalletAnalysis()` --calls--> `useAvalancheWallet()`  [INFERRED]
  use-wallet-analysis.tsx → use-avalanche-wallet.tsx

## Communities

### Community 0 - "Wallet Analysis"
Cohesion: 0.33
Nodes (3): useAvalancheWallet(), useWalletAnalysisQuery(), useWalletAnalysis()

### Community 1 - "Custom Address Analysis"
Cohesion: 1.0
Nodes (0): 

### Community 2 - "DEX Aggregation"
Cohesion: 1.0
Nodes (0): 

### Community 3 - "Pool Discovery"
Cohesion: 1.0
Nodes (0): 

### Community 4 - "Swap Execution"
Cohesion: 1.0
Nodes (0): 

### Community 5 - "Liquidity Management"
Cohesion: 1.0
Nodes (0): 

### Community 6 - "Mobile Detection"
Cohesion: 1.0
Nodes (0): 

### Community 7 - "Pool Details"
Cohesion: 1.0
Nodes (0): 

### Community 8 - "Hook Exports"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Custom Address Analysis`** (2 nodes): `use-custom-address-analysis.tsx`, `useCustomAddressAnalysis()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DEX Aggregation`** (2 nodes): `use-dex-aggregator.tsx`, `useDexAggregator()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Pool Discovery`** (2 nodes): `use-dex-pools.tsx`, `useDexPools()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Swap Execution`** (2 nodes): `use-dex-swap.tsx`, `useDexSwap()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Liquidity Management`** (2 nodes): `use-liquidity.tsx`, `useLiquidity()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Mobile Detection`** (2 nodes): `use-mobile.tsx`, `useIsMobile()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Pool Details`** (2 nodes): `use-pool-details.tsx`, `usePoolDetails()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Hook Exports`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 2 inferred relationships involving `useAvalancheWallet()` (e.g. with `useWalletAnalysisQuery()` and `useWalletAnalysis()`) actually correct?**
  _`useAvalancheWallet()` has 2 INFERRED edges - model-reasoned connections that need verification._