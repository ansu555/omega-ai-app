# Graph Report - app  (2026-04-18)

## Corpus Check
- Corpus is ~8,690 words - fits in a single context window. You may not need a graph.

## Summary
- 39 nodes · 35 edges · 15 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Crypto Market Fetchers|Crypto Market Fetchers]]
- [[_COMMUNITY_Crypto Data Transforms|Crypto Data Transforms]]
- [[_COMMUNITY_Agent Builder API|Agent Builder API]]
- [[_COMMUNITY_Explore Tokens Page|Explore Tokens Page]]
- [[_COMMUNITY_Portfolio Analytics|Portfolio Analytics]]
- [[_COMMUNITY_Agent Builder UI|Agent Builder UI]]
- [[_COMMUNITY_Root App Shell|Root App Shell]]
- [[_COMMUNITY_Main App Layout|Main App Layout]]
- [[_COMMUNITY_Transaction History|Transaction History]]
- [[_COMMUNITY_Builder Layout|Builder Layout]]
- [[_COMMUNITY_Landing Layout|Landing Layout]]
- [[_COMMUNITY_Landing Home Page|Landing Home Page]]
- [[_COMMUNITY_Pool Detail Page|Pool Detail Page]]
- [[_COMMUNITY_Trade Page|Trade Page]]
- [[_COMMUNITY_Crypto API Types|Crypto API Types]]

## God Nodes (most connected - your core abstractions)
1. `GET()` - 9 edges
2. `POST()` - 3 edges
3. `transformCMCData()` - 3 edges
4. `getOpenAIClient()` - 2 edges
5. `generateSparklineData()` - 2 edges
6. `transformCoinGeckoData()` - 2 edges
7. `transformGeckoTerminalPools()` - 2 edges
8. `fetchFromCoinGecko()` - 2 edges
9. `fetchPoolsFromGeckoTerminal()` - 2 edges
10. `fetchFromCoinMarketCap()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `transformCMCData()`  [EXTRACTED]
  app/api/crypto/route.ts → app/api/crypto/route.ts  _Bridges community 1 → community 0_

## Communities

### Community 0 - "Crypto Market Fetchers"
Cohesion: 0.33
Nodes (6): fetchFromCoinGecko(), fetchFromKryll(), fetchPoolsFromGeckoTerminal(), GET(), transformCoinGeckoData(), transformGeckoTerminalPools()

### Community 1 - "Crypto Data Transforms"
Cohesion: 0.5
Nodes (4): fetchFromCoinMarketCap(), generateSparklineData(), transformCMCData(), transformKryllData()

### Community 2 - "Agent Builder API"
Cohesion: 0.67
Nodes (2): getOpenAIClient(), POST()

### Community 3 - "Explore Tokens Page"
Cohesion: 0.67
Nodes (0): 

### Community 4 - "Portfolio Analytics"
Cohesion: 0.67
Nodes (0): 

### Community 5 - "Agent Builder UI"
Cohesion: 0.67
Nodes (0): 

### Community 6 - "Root App Shell"
Cohesion: 1.0
Nodes (0): 

### Community 7 - "Main App Layout"
Cohesion: 1.0
Nodes (0): 

### Community 8 - "Transaction History"
Cohesion: 1.0
Nodes (0): 

### Community 9 - "Builder Layout"
Cohesion: 1.0
Nodes (0): 

### Community 10 - "Landing Layout"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "Landing Home Page"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Pool Detail Page"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Trade Page"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Crypto API Types"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Root App Shell`** (2 nodes): `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Main App Layout`** (2 nodes): `layout.tsx`, `AppLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Transaction History`** (2 nodes): `page.tsx`, `TransactionHistory()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Builder Layout`** (2 nodes): `layout.tsx`, `BuilderLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Landing Layout`** (2 nodes): `layout.tsx`, `LandingLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Landing Home Page`** (2 nodes): `page.tsx`, `Home()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Pool Detail Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Trade Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Crypto API Types`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GET()` connect `Crypto Market Fetchers` to `Crypto Data Transforms`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `transformCMCData()` connect `Crypto Data Transforms` to `Crypto Market Fetchers`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._