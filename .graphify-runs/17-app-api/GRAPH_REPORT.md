# Graph Report - /home/anik2003/Documents/omeswap/app/api  (2026-04-18)

## Corpus Check
- Corpus is ~3,320 words - fits in a single context window. You may not need a graph.

## Summary
- 16 nodes · 23 edges · 4 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Crypto Data Route|Crypto Data Route]]
- [[_COMMUNITY_Agent Builder Routes|Agent Builder Routes]]
- [[_COMMUNITY_CMC Transform Helpers|CMC Transform Helpers]]
- [[_COMMUNITY_Crypto Types|Crypto Types]]

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
  /home/anik2003/Documents/omeswap/app/api/crypto/route.ts → /home/anik2003/Documents/omeswap/app/api/crypto/route.ts  _Bridges community 2 → community 0_

## Communities

### Community 0 - "Crypto Data Route"
Cohesion: 0.42
Nodes (8): fetchFromCoinGecko(), fetchFromCoinMarketCap(), fetchFromKryll(), fetchPoolsFromGeckoTerminal(), GET(), transformCoinGeckoData(), transformGeckoTerminalPools(), transformKryllData()

### Community 1 - "Agent Builder Routes"
Cohesion: 0.67
Nodes (2): getOpenAIClient(), POST()

### Community 2 - "CMC Transform Helpers"
Cohesion: 1.0
Nodes (2): generateSparklineData(), transformCMCData()

### Community 3 - "Crypto Types"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `CMC Transform Helpers`** (2 nodes): `generateSparklineData()`, `transformCMCData()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Crypto Types`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GET()` connect `Crypto Data Route` to `CMC Transform Helpers`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **Why does `transformCMCData()` connect `CMC Transform Helpers` to `Crypto Data Route`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._