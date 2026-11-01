# Graph Report - app/api  (2026-04-18)

## Corpus Check
- Corpus is ~3,651 words - fits in a single context window. You may not need a graph.

## Summary
- 63 nodes · 91 edges · 10 communities detected
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Crypto Route Core|Crypto Route Core]]
- [[_COMMUNITY_Agent Builder Prompting|Agent Builder Prompting]]
- [[_COMMUNITY_GeckoTerminal Pools Flow|GeckoTerminal Pools Flow]]
- [[_COMMUNITY_Market Source Ingestion|Market Source Ingestion]]
- [[_COMMUNITY_Graph Report Insights|Graph Report Insights]]
- [[_COMMUNITY_Token Normalization Pipeline|Token Normalization Pipeline]]
- [[_COMMUNITY_Agent Route Handlers|Agent Route Handlers]]
- [[_COMMUNITY_Kryll Source Models|Kryll Source Models]]
- [[_COMMUNITY_Kryll Audit Types|Kryll Audit Types]]
- [[_COMMUNITY_Crypto Types Module|Crypto Types Module]]

## God Nodes (most connected - your core abstractions)
1. `GET (crypto route)` - 13 edges
2. `GET()` - 9 edges
3. `transformCMCData()` - 7 edges
4. `transformCoinGeckoData()` - 6 edges
5. `transformKryllData()` - 5 edges
6. `CryptoAPIResponse` - 5 edges
7. `Insight: GET() bridges to transformCMCData()` - 5 edges
8. `POST (agent builder agent route)` - 4 edges
9. `POST (agent builder chat route)` - 4 edges
10. `getOpenAIClient()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Insight: GET() bridges to transformCMCData()` --cites--> `GET (crypto route)`  [EXTRACTED]
  app/api/graphify-out/GRAPH_REPORT.md → app/api/crypto/route.ts
- `Insight: GET() bridges to transformCMCData()` --cites--> `transformCMCData()`  [EXTRACTED]
  app/api/graphify-out/GRAPH_REPORT.md → app/api/crypto/route.ts
- `POST (agent builder chat route)` --semantically_similar_to--> `POST (agent builder agent route)`  [INFERRED] [semantically similar]
  app/api/agent-builder/chat/route.ts → app/api/agent-builder/agent/route.ts
- `transformCoinGeckoData()` --references--> `CoinGeckoMarket`  [EXTRACTED]
  app/api/crypto/route.ts → app/api/crypto/types.ts
- `GET (crypto route)` --references--> `Metric`  [EXTRACTED]
  app/api/crypto/route.ts → app/api/crypto/types.ts

## Hyperedges (group relationships)
- **Crypto Token Source Fallback Chain** — crypto_get_route, crypto_fetch_from_kryll, crypto_fetch_from_coingecko, crypto_fetch_from_coinmarketcap [EXTRACTED 1.00]
- **Sparkline-Driven Token Transformers** — crypto_generate_sparkline_data, crypto_transform_coingecko_data, crypto_transform_cmc_data, crypto_transform_kryll_data [EXTRACTED 1.00]
- **Agent Builder Chat Schema Validation Stack** — chat_block_parameter_schema, chat_agent_block_schema, chat_block_connection_schema, chat_response_schema, chat_route_post [EXTRACTED 1.00]

## Communities

### Community 0 - "Crypto Route Core"
Cohesion: 0.35
Nodes (10): fetchFromCoinGecko(), fetchFromCoinMarketCap(), fetchFromKryll(), fetchPoolsFromGeckoTerminal(), generateSparklineData(), GET(), transformCMCData(), transformCoinGeckoData() (+2 more)

### Community 1 - "Agent Builder Prompting"
Cohesion: 0.22
Nodes (10): POST (agent builder agent route), AGENT_TOOLS, AgentBlockSchema, BlockConnectionSchema, BlockParameterSchema, getOpenAIClient(), OpenAI SDK Client, ChatResponseSchema (+2 more)

### Community 2 - "GeckoTerminal Pools Flow"
Cohesion: 0.25
Nodes (11): fetchPoolsFromGeckoTerminal(), GET (crypto route), transformGeckoTerminalPools(), GeckoTerminal AVAX Pools API, CryptoAPIResponse, GeckoTerminalPool, GeckoTerminalResponse, GeckoTerminalToken (+3 more)

### Community 3 - "Market Source Ingestion"
Cohesion: 0.25
Nodes (8): CoinGecko Markets API, CoinMarketCap Listings API, fetchFromCoinGecko(), fetchFromCoinMarketCap(), CMCCryptocurrency, CMCQuote, CMCResponse, CoinGeckoMarket

### Community 4 - "Graph Report Insights"
Cohesion: 0.47
Nodes (5): Insight: GET() bridges to transformCMCData(), Community: Agent Builder Routes, Community: CMC Transform Helpers, Community: Crypto Data Route, Community: Crypto Types

### Community 5 - "Token Normalization Pipeline"
Cohesion: 0.8
Nodes (5): generateSparklineData(), transformCMCData(), transformCoinGeckoData(), transformKryllData(), TokenRow

### Community 6 - "Agent Route Handlers"
Cohesion: 0.67
Nodes (2): getOpenAIClient(), POST()

### Community 7 - "Kryll Source Models"
Cohesion: 0.67
Nodes (4): fetchFromKryll(), Kryll X-Ray List API, KryllResponse, KryllToken

### Community 8 - "Kryll Audit Types"
Cohesion: 1.0
Nodes (2): KryllAuditData, KryllAuditResponse

### Community 9 - "Crypto Types Module"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **15 isolated node(s):** `AGENT_TOOLS`, `BlockParameterSchema`, `BlockConnectionSchema`, `OpenAI SDK Client`, `CoinGecko Markets API` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Kryll Audit Types`** (2 nodes): `KryllAuditData`, `KryllAuditResponse`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Crypto Types Module`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GET (crypto route)` connect `GeckoTerminal Pools Flow` to `Market Source Ingestion`, `Graph Report Insights`, `Token Normalization Pipeline`, `Kryll Source Models`?**
  _High betweenness centrality (0.306) - this node is a cross-community bridge._
- **Why does `getOpenAIClient()` connect `Agent Builder Prompting` to `Graph Report Insights`?**
  _High betweenness centrality (0.185) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `transformCoinGeckoData()` (e.g. with `transformKryllData()` and `transformCMCData()`) actually correct?**
  _`transformCoinGeckoData()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AGENT_TOOLS`, `BlockParameterSchema`, `BlockConnectionSchema` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._