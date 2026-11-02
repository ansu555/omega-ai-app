# Graph Report - app  (2026-04-18)

## Corpus Check
- 54 files · ~128,370 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 338 nodes · 332 edges · 67 communities detected
- Extraction: 77% EXTRACTED · 20% INFERRED · 4% AMBIGUOUS · INFERRED: 65 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Coingeckomarket Transformcoingeckodata|Coingeckomarket Transformcoingeckodata]]
- [[_COMMUNITY_Agent Backtestrunner|Agent Backtestrunner]]
- [[_COMMUNITY_Dataset Raw|Dataset Raw]]
- [[_COMMUNITY_Dataset Pool|Dataset Pool]]
- [[_COMMUNITY_Agent Chat|Agent Chat]]
- [[_COMMUNITY_Query Runbot|Query Runbot]]
- [[_COMMUNITY_Agent Post|Agent Post]]
- [[_COMMUNITY_Get Getopenaiclient|Get Getopenaiclient]]
- [[_COMMUNITY_Icon Svg|Icon Svg]]
- [[_COMMUNITY_Crypto Fetchfromcoingecko|Crypto Fetchfromcoingecko]]
- [[_COMMUNITY_Registry Swapnode|Registry Swapnode]]
- [[_COMMUNITY_Trade Entrypoints|Trade Entrypoints]]
- [[_COMMUNITY_Duplication Agent|Duplication Agent]]
- [[_COMMUNITY_Path Wallet|Path Wallet]]
- [[_COMMUNITY_Portfolio Fetchprices|Portfolio Fetchprices]]
- [[_COMMUNITY_Alias Resolution|Alias Resolution]]
- [[_COMMUNITY_Next Svg|Next Svg]]
- [[_COMMUNITY_Window Fill|Window Fill]]
- [[_COMMUNITY_Next Svg|Next Svg]]
- [[_COMMUNITY_Window Fill|Window Fill]]
- [[_COMMUNITY_Agent Getopenaiclient|Agent Getopenaiclient]]
- [[_COMMUNITY_Agent Flow|Agent Flow]]
- [[_COMMUNITY_Portfolio Fetchprices|Portfolio Fetchprices]]
- [[_COMMUNITY_Svg Folded|Svg Folded]]
- [[_COMMUNITY_Globe Fill|Globe Fill]]
- [[_COMMUNITY_Svg Vercel|Svg Vercel]]
- [[_COMMUNITY_Svg Folded|Svg Folded]]
- [[_COMMUNITY_Globe Fill|Globe Fill]]
- [[_COMMUNITY_Svg Vercel|Svg Vercel]]
- [[_COMMUNITY_Explore Fetchtokens|Explore Fetchtokens]]
- [[_COMMUNITY_Portfolio Fetchprices|Portfolio Fetchprices]]
- [[_COMMUNITY_Agent Agentbuilderpage|Agent Agentbuilderpage]]
- [[_COMMUNITY_Path Wallet|Path Wallet]]
- [[_COMMUNITY_Workflow Repo|Workflow Repo]]
- [[_COMMUNITY_Pool Detail|Pool Detail]]
- [[_COMMUNITY_Runbot Avax|Runbot Avax]]
- [[_COMMUNITY_Uniswap Amm|Uniswap Amm]]
- [[_COMMUNITY_Rootlayout Group|Rootlayout Group]]
- [[_COMMUNITY_Applayout Group|Applayout Group]]
- [[_COMMUNITY_Transactions Transactionhistory|Transactions Transactionhistory]]
- [[_COMMUNITY_Builderlayout Group|Builderlayout Group]]
- [[_COMMUNITY_Landing Landinglayout|Landing Landinglayout]]
- [[_COMMUNITY_Landing Home|Landing Home]]
- [[_COMMUNITY_Kryllauditdata Kryllauditresponse|Kryllauditdata Kryllauditresponse]]
- [[_COMMUNITY_Builderlayout Group|Builderlayout Group]]
- [[_COMMUNITY_Agent Post|Agent Post]]
- [[_COMMUNITY_Types Crypto|Types Crypto]]
- [[_COMMUNITY_Avax Agent|Avax Agent]]
- [[_COMMUNITY_Vercel Triangle|Vercel Triangle]]
- [[_COMMUNITY_Icon Window|Icon Window]]
- [[_COMMUNITY_Globe Icon|Globe Icon]]
- [[_COMMUNITY_Next Wordmark|Next Wordmark]]
- [[_COMMUNITY_Clippath 16X16|Clippath 16X16]]
- [[_COMMUNITY_Clippath 16X16|Clippath 16X16]]
- [[_COMMUNITY_Omeswap Avalanche|Omeswap Avalanche]]
- [[_COMMUNITY_Avalanche Mainnet|Avalanche Mainnet]]
- [[_COMMUNITY_Swapcarddex Swapnode|Swapcarddex Swapnode]]
- [[_COMMUNITY_Walletanalysisdemo Walletanalysispanel|Walletanalysisdemo Walletanalysispanel]]
- [[_COMMUNITY_Scheduletriggernode Avax|Scheduletriggernode Avax]]
- [[_COMMUNITY_Agent Post|Agent Post]]
- [[_COMMUNITY_Chatbotpanel Agentchatbotservice|Chatbotpanel Agentchatbotservice]]
- [[_COMMUNITY_Pool Group|Pool Group]]
- [[_COMMUNITY_Trade Group|Trade Group]]
- [[_COMMUNITY_Types Group|Types Group]]
- [[_COMMUNITY_Document Group|Document Group]]
- [[_COMMUNITY_Get Group|Get Group]]
- [[_COMMUNITY_Cluster 66|Cluster 66]]

## God Nodes (most connected - your core abstractions)
1. `GET (crypto route)` - 11 edges
2. `GET()` - 9 edges
3. `transformCoinGeckoData()` - 8 edges
4. `avax-agent app` - 8 edges
5. `PoolPage() Component` - 7 edges
6. `transformCMCData()` - 7 edges
7. `Main Route Entrypoints and Layouts Query` - 7 edges
8. `TopBar.tsx` - 7 edges
9. `runBot()` - 7 edges
10. `PoolPage() Component` - 7 edges

## Surprising Connections (you probably didn't know these)
- `RootLayout()` --routes_to--> `app/(app)/trade/page.tsx`  [AMBIGUOUS]
  app/layout.tsx → app/(app)/graphify-out/memory/query_20260418_101343_path_from_layout_to_trade_page.md
- `RAW_NODES Dataset (Full Graph)` --references--> `PoolPage() Component`  [AMBIGUOUS]
  app/(app)/graphify-out/graph_full.html → app/(app)/pool/[id]/page.tsx
- `RAW_NODES Dataset (Full Graph)` --references--> `PoolPage() Component`  [AMBIGUOUS]
  app/(app)/graphify-out/graph_full.html → app/(app)/pool/[id]/page.tsx
- `RootLayout()` --routes_to--> `app/(app)/trade/page.tsx`  [AMBIGUOUS]
  app/layout.tsx → app/(app)/trade/page.tsx
- `Insight: GET() bridges to transformCMCData()` --cites--> `transformCMCData()`  [EXTRACTED]
  app/api/graphify-out/GRAPH_REPORT.md → app/api/crypto/route.ts

## Hyperedges (group relationships)
- **Pool Detail Route Data Flow** — page_poolpage_component, page_use_pool_details_hook, page_user_position_contract_read, page_transactions_table, page_user_position_panel, page_swapcarddex_panel [INFERRED 0.84]
- **Agent Builder Chat Schema Validation Stack** — chat_block_parameter_schema, chat_agent_block_schema, chat_block_connection_schema, chat_response_schema, chat_route_post [EXTRACTED 1.00]
- **Crypto Token Source Fallback Chain** — crypto_get_route, crypto_fetch_from_kryll, crypto_fetch_from_coingecko, crypto_fetch_from_coinmarketcap [EXTRACTED 1.00]
- **Sparkline-Driven Token Transformers** — crypto_generate_sparkline_data, crypto_transform_coingecko_data, crypto_transform_cmc_data, crypto_transform_kryll_data [EXTRACTED 1.00]
- **Graph Full Visualization Pipeline** — graph_full_html_graph_visualizer, graph_full_html_raw_nodes_dataset, graph_full_html_raw_edges_dataset, graph_full_html_legend_dataset, graph_full_html_vis_network_instance [EXTRACTED 1.00]
- **Route and Layout Entry Surface** — app_api_crypto_route, crypto_get_handler, app_api_agent_builder_chat_route, agent_builder_chat_post_handler, app_api_agent_builder_agent_route, root_layout, app_layout, builder_layout, landing_layout [EXTRACTED 1.00]
- **Agent Builder Authoring-to-Execution Flow** — canvas_page, flow_canvas, top_bar, handle_run, execute_once, run_bot, bot_runner, handle_backtest, run_backtest, backtest_runner [EXTRACTED 1.00]
- **Duplicated Agent Builder Stack Across Main App and avax-agent** — main_app_agent_builder, avax_agent_app, bot_runner, backtest_runner, node_registry, create_node_instance, workflow_manager, top_bar, api_agent_route_pair [EXTRACTED 1.00]
- **Builder Layout Shell Thin Community** — community_builder_layout_shell, layout_tsx, builderlayout_function [EXTRACTED 0.93]
- **Wallet Analysis Fragmented Path** — wallet_analysis_panel, use_wallet_analysis, use_wallet_analysis_query, analyze_wallet, claim_wallet_path_unstitched [EXTRACTED 0.92]
- **Agent Builder Runtime Chain** — flow_canvas, top_bar, execute_once, run_bot, bot_runner [INFERRED 0.88]
- **Duplicated Agent Builder Stack** — avax_agent_app, bot_runner, backtest_runner, top_bar, workflow_manager, claim_repo_duplication_near_total [EXTRACTED 0.95]
- **Crypto Token Source Fallback Chain** — crypto_route_get, crypto_transform_coingecko_data, crypto_transform_cmc_data, crypto_transform_kryll_data [EXTRACTED 1.00]
- **Sparkline-Driven Token Transformers** — crypto_transform_coingecko_data, crypto_transform_cmc_data, crypto_transform_kryll_data [EXTRACTED 1.00]
- **Agent Builder Chat Schema Validation Stack** — chat_block_parameter_schema, chat_block_connection_schema, agent_builder_chat_route_post [EXTRACTED 1.00]
- **Agent Builder Execution Path** — flowcanvas_component, topbar_component, executeonce_fn, runbot_fn, botrunner_module [EXTRACTED 1.00]
- **Public Visual Asset Set** — nextjs_logo_asset, vercel_logo_asset, ui_file_icon_asset, ui_globe_icon_asset, ui_window_icon_asset [EXTRACTED 1.00]
- **Mirrored Agent Builder Layers** — duplication_engine_layer, duplication_backtest_layer, duplication_nodes_layer, duplication_canvas_ui_layer, duplication_agent_api_routes [EXTRACTED 1.00]
- **Agent Builder Authoring-to-Execution Flow** — canvas_page, flow_canvas, top_bar, handle_run, execute_once, run_bot, bot_runner_ts, handle_backtest, run_backtest, backtest_runner_ts [EXTRACTED 1.00]
- **Duplicated Agent Builder Stack Across Main App and avax-agent** — main_app_agent_builder_stack, avax_agent_app, bot_runner_ts, backtest_runner_ts, node_registry, workflow_manager, top_bar [EXTRACTED 1.00]
- **Graph HTML Visualization Pipeline** — graph_html_visualizer, raw_nodes_dataset, raw_edges_dataset, legend_dataset, vis_network_instance [EXTRACTED 1.00]
- **Graph Full Visualization Pipeline** — graph_full_html_visualizer, raw_nodes_dataset_full_graph, raw_edges_dataset_full, legend_dataset_full, vis_network_instance_full [EXTRACTED 1.00]
- **Pool Detail Route Data Flow** — pool_page_component, pool_details_hook, user_position_contract_read, pool_transactions_table, user_position_panel, swap_card_dex_panel [INFERRED 0.84]

## Communities

### Community 0 - "Coingeckomarket Transformcoingeckodata"
Cohesion: 0.11
Nodes (30): CoinGecko Markets API, CoinMarketCap Listings API, CoinGeckoMarket, fetchFromCoinGecko(), fetchFromCoinMarketCap(), fetchFromKryll(), fetchPoolsFromGeckoTerminal(), generateSparklineData() (+22 more)

### Community 1 - "Agent Backtestrunner"
Cohesion: 0.12
Nodes (26): app/api/agent/route.ts + app/api/agent-builder/agent/route.ts, avax-agent app, BacktestRunner.ts, BacktestRunner.ts, BotRunner.ts, BotRunner.ts, CanvasPage, BacktestRunner reuses runBot live executor (+18 more)

### Community 2 - "Dataset Raw"
Cohesion: 0.12
Nodes (17): Graph Full HTML Visualizer, Graph HTML Visualizer, LEGEND Dataset, LEGEND Community Dataset (Full Graph), Pool Detail Route Node (app_app_pool_id_page_tsx), usePoolDetails Hook Call, PoolPage() Component, Pool Transactions Table (+9 more)

### Community 3 - "Dataset Pool"
Cohesion: 0.16
Nodes (14): Graph Full HTML Visualizer, Hyperedges Array (Full Graph), LEGEND Community Dataset (Full Graph), RAW_EDGES Dataset (Full Graph), RAW_NODES Dataset (Full Graph), vis.Network Instance (Full Graph), Pool Information Card, POOL_PAIRS Map (+6 more)

### Community 4 - "Agent Chat"
Cohesion: 0.18
Nodes (14): POST() agent-builder chat handler, app/api/agent-builder/agent/route.ts, app/api/agent-builder/chat/route.ts, app/api/crypto/route.ts, AppLayout(), AST graph missed layout-to-route binding, BuilderLayout(), GET() crypto handler (+6 more)

### Community 5 - "Query Runbot"
Cohesion: 0.16
Nodes (12): Rationale: backtest reuses live runBot executor, BacktestRunner.ts, BotRunner.ts, CanvasPage, executeOnce(), FlowCanvas.tsx, Query: Core execution flows in the agent builder, Query: Explain BacktestRunner (+4 more)

### Community 6 - "Agent Post"
Cohesion: 0.23
Nodes (11): POST (agent builder agent route), AGENT_TOOLS, AgentBlockSchema, BlockConnectionSchema, BlockParameterSchema, getOpenAIClient(), OpenAI SDK Client, ChatResponseSchema (+3 more)

### Community 7 - "Get Getopenaiclient"
Cohesion: 0.17
Nodes (11): Agent Builder Prompting, GeckoTerminal Pools Flow, Graph Report Insights, Kryll Source Models, Market Source Ingestion, Token Normalization Pipeline, Metric, GET (crypto route) (+3 more)

### Community 8 - "Icon Svg"
Cohesion: 0.17
Nodes (12): file.svg icon, globe.svg icon, Next.js logo asset (next.svg), Query: product areas in visual assets, File/document icon asset, Globe/internet icon asset, Window/browser chrome icon asset, Vercel triangle logo asset (+4 more)

### Community 9 - "Crypto Fetchfromcoingecko"
Cohesion: 0.35
Nodes (10): fetchFromCoinGecko(), fetchFromCoinMarketCap(), fetchFromKryll(), fetchPoolsFromGeckoTerminal(), generateSparklineData(), GET(), transformCMCData(), transformCoinGeckoData() (+2 more)

### Community 10 - "Registry Swapnode"
Cohesion: 0.22
Nodes (9): Build Docs From Node Registry concept node, Build Docs From Node Registry concept node, createNodeInstance(), registry.ts / NODE_REGISTRY, Query: node registry to swapnode path, Query: Path from node registry to SwapNode, Rationale: query matched conceptual node instead of concrete registry.ts, SwapNode (+1 more)

### Community 11 - "Trade Entrypoints"
Cohesion: 0.22
Nodes (9): API route entrypoints, No extracted graph path from layouts to trade page, Layout entrypoints, Rationale: layout-to-trade relation not captured by AST graph, Query: path from layout to trade page, Query: Main route entrypoints and layouts, Rationale: trade page node reported isolated with degree 0, app/(app)/trade/page.tsx (+1 more)

### Community 12 - "Duplication Agent"
Cohesion: 0.33
Nodes (7): avax-agent mirrors main app agent-builder, Agent API route duplication, Backtest layer duplication, Canvas UI component duplication, Engine layer duplication (BotRunner/topologicalSort), Node types duplication, Query: Duplicated agent-builder/workflow logic

### Community 13 - "Path Wallet"
Cohesion: 0.4
Nodes (6): analyzeWallet(), Query: Path from wallet analysis to WalletAnalysisPanel, useWalletAnalysis(), useWalletAnalysisQuery(), Rationale: alias/cross-folder stitching missing for wallet path, WalletAnalysisPanel.tsx

### Community 14 - "Portfolio Fetchprices"
Cohesion: 0.5
Nodes (5): fetchPrices(), generateChartData(), app/(app)/portfolio/page.tsx, app/(app)/portfolio/page.tsx, Query: explain portfolio page

### Community 15 - "Alias Resolution"
Cohesion: 0.5
Nodes (5): Alias resolution not stitched across folders, analyzeWallet(), useWalletAnalysis(), useWalletAnalysisQuery(), WalletAnalysisPanel.tsx

### Community 16 - "Next Svg"
Cohesion: 0.4
Nodes (4): Primary path: large Next.js wordmark geometry (fill #000), Secondary path: small Next.js mark / sub-wordmark detail (fill #000), SVG root (viewBox 0 0 394 80, fill none, xmlns SVG 1.1), Next.js framework default logo asset (public static SVG)

### Community 17 - "Window Fill"
Cohesion: 0.4
Nodes (4): Browser or OS window chrome icon (frame + traffic-light dots), Window outer frame path (rounded rectangle, fill #666), Title bar control dots (three .75-radius circles, fill #666), SVG root (viewBox 0 0 16 16, fill none)

### Community 18 - "Next Svg"
Cohesion: 0.4
Nodes (4): Primary path: large Next.js wordmark geometry (fill #000), Secondary path: small Next.js mark / sub-wordmark detail (fill #000), SVG root (viewBox 0 0 394 80, fill none, xmlns SVG 1.1), Next.js framework default logo asset (public static SVG)

### Community 19 - "Window Fill"
Cohesion: 0.4
Nodes (4): Browser or OS window chrome icon (frame + traffic-light dots), Window outer frame path (rounded rectangle, fill #666), Title bar control dots (three .75-radius circles, fill #666), SVG root (viewBox 0 0 16 16, fill none)

### Community 20 - "Agent Getopenaiclient"
Cohesion: 0.67
Nodes (2): getOpenAIClient(), POST()

### Community 21 - "Agent Flow"
Cohesion: 0.5
Nodes (4): Agent Builder Flow, Builder Layout Shell, Graph Report - app/(builder), Too small to be a meaningful cluster; may be noise or needs more extracted connections

### Community 22 - "Portfolio Fetchprices"
Cohesion: 0.5
Nodes (2): Portfolio page entrypoint, Query: Explain portfolio page

### Community 23 - "Svg Folded"
Cohesion: 0.5
Nodes (3): Generic document or file attachment icon (page with folded corner and text lines), Single compound path: folded sheet, corner fold triangle, horizontal rule lines (fill #666, evenodd), SVG root (viewBox 0 0 16 16, fill none, W3C SVG namespace)

### Community 24 - "Globe Fill"
Cohesion: 0.5
Nodes (3): World or internet globe UI glyph (16px), Globe meridian grid path (fill #666, fill-rule evenodd), SVG root (viewBox 0 0 16 16, fill none)

### Community 25 - "Svg Vercel"
Cohesion: 0.5
Nodes (3): Vercel-style upward triangle mark (brand-associated raster/vector glyph), SVG root (viewBox 0 0 1155 1000, fill none, SVG namespace), Single path triangle (d m577.3 0 577.4 1000H0z, fill #fff)

### Community 26 - "Svg Folded"
Cohesion: 0.5
Nodes (3): Generic document or file attachment icon (page with folded corner and text lines), Single compound path: folded sheet, corner fold triangle, horizontal rule lines (fill #666, evenodd), SVG root (viewBox 0 0 16 16, fill none, W3C SVG namespace)

### Community 27 - "Globe Fill"
Cohesion: 0.5
Nodes (3): World or internet globe UI glyph (16px), Globe meridian grid path (fill #666, fill-rule evenodd), SVG root (viewBox 0 0 16 16, fill none)

### Community 28 - "Svg Vercel"
Cohesion: 0.5
Nodes (3): Vercel-style upward triangle mark (brand-associated raster/vector glyph), SVG root (viewBox 0 0 1155 1000, fill none, SVG namespace), Single path triangle (d m577.3 0 577.4 1000H0z, fill #fff)

### Community 29 - "Explore Fetchtokens"
Cohesion: 0.67
Nodes (0): 

### Community 30 - "Portfolio Fetchprices"
Cohesion: 0.67
Nodes (0): 

### Community 31 - "Agent Agentbuilderpage"
Cohesion: 0.67
Nodes (0): 

### Community 32 - "Path Wallet"
Cohesion: 0.67
Nodes (3): Wallet panel path exists as fragments, not one stitched path, Query: wallet analysis to panel path, Rationale: alias/cross-folder resolution not stitched into one graph path

### Community 33 - "Workflow Repo"
Cohesion: 0.67
Nodes (3): Repo has near-total duplication of builder/workflow stack, Query: duplicate builder and workflow logic, Rationale: avax-agent mirrors engine, backtest, nodes, canvas, and api layers

### Community 34 - "Pool Detail"
Cohesion: 0.67
Nodes (3): page.tsx, Pool Detail Route, Trade Route

### Community 35 - "Runbot Avax"
Cohesion: 0.67
Nodes (3): runBot(), avax-agent (standalone Next.js app), runBot() (avax-agent)

### Community 36 - "Uniswap Amm"
Cohesion: 0.67
Nodes (3): MultiTokenLiquidityPools Contract, Rationale: Uniswap V2 AMM as design basis, Uniswap V2 AMM Design

### Community 37 - "Rootlayout Group"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Applayout Group"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Transactions Transactionhistory"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Builderlayout Group"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Landing Landinglayout"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Landing Home"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Kryllauditdata Kryllauditresponse"
Cohesion: 1.0
Nodes (2): KryllAuditData, KryllAuditResponse

### Community 44 - "Builderlayout Group"
Cohesion: 1.0
Nodes (1): layout.tsx

### Community 45 - "Agent Post"
Cohesion: 1.0
Nodes (2): POST (agent builder agent route), POST (agent builder chat route)

### Community 46 - "Types Crypto"
Cohesion: 1.0
Nodes (2): Crypto Types Module, types.ts

### Community 47 - "Avax Agent"
Cohesion: 1.0
Nodes (1): Geist Font Setup

### Community 48 - "Vercel Triangle"
Cohesion: 1.0
Nodes (2): Vercel Triangle Logo, Vercel Deployment

### Community 49 - "Icon Window"
Cohesion: 1.0
Nodes (2): File Icon, Window Icon

### Community 50 - "Globe Icon"
Cohesion: 1.0
Nodes (2): Globe Icon, Next.js Documentation

### Community 51 - "Next Wordmark"
Cohesion: 1.0
Nodes (2): Next.js Wordmark, Next.js Starter Project

### Community 52 - "Clippath 16X16"
Cohesion: 1.0
Nodes (2): ClipPath id a: 16x16 rectangular mask (white fill), Group with clip-path url(#a)

### Community 53 - "Clippath 16X16"
Cohesion: 1.0
Nodes (2): ClipPath id a: 16x16 rectangular mask (white fill), Group with clip-path url(#a)

### Community 54 - "Omeswap Avalanche"
Cohesion: 1.0
Nodes (2): OmeSwap / Avalanche DEX, RootLayout (app shell)

### Community 55 - "Avalanche Mainnet"
Cohesion: 1.0
Nodes (2): Avalanche Mainnet (Chain ID 43114), Rationale: Avalanche chosen for low gas fees

### Community 56 - "Swapcarddex Swapnode"
Cohesion: 1.0
Nodes (2): SwapCardDex Component, SwapNode (agent action)

### Community 57 - "Walletanalysisdemo Walletanalysispanel"
Cohesion: 1.0
Nodes (2): WalletAnalysisDemo Component, WalletAnalysisPanel Component

### Community 58 - "Scheduletriggernode Avax"
Cohesion: 1.0
Nodes (2): ScheduleTriggerNode, ScheduleTriggerNode (avax-agent)

### Community 59 - "Agent Post"
Cohesion: 1.0
Nodes (2): POST() (avax-agent Agent API), POST() (app/api/agent-builder route)

### Community 60 - "Chatbotpanel Agentchatbotservice"
Cohesion: 1.0
Nodes (2): ChatbotPanel Component, AgentChatbotService

### Community 61 - "Pool Group"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Trade Group"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Types Group"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Document Group"
Cohesion: 1.0
Nodes (1): Graph Report - app/api (2026-04-18)

### Community 65 - "Get Group"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Cluster 66"
Cohesion: 1.0
Nodes (1): Graph Report - app/(app)

## Ambiguous Edges - Review These
- `RootLayout()` → `app/(app)/trade/page.tsx`  [AMBIGUOUS]
  app/(app)/graphify-out/memory/query_20260418_101343_path_from_layout_to_trade_page.md · relation: routes_to
- `RootLayout()` → `app/(app)/trade/page.tsx`  [AMBIGUOUS]
  app/(builder)/graphify-out/memory/query_20260418_101343_path_from_layout_to_trade_page.md · relation: routes_to
- `RootLayout()` → `app/(app)/trade/page.tsx`  [AMBIGUOUS]
  app/(app)/graphify-out/memory/query_20260418_101343_path_from_layout_to_trade_page.md · relation: routes_to
- `PoolPage() Component` → `RAW_NODES Dataset (Full Graph)`  [AMBIGUOUS]
  app/(app)/graphify-out/graph_full.html · relation: references
- `registry.ts / NODE_REGISTRY` → `SwapNode`  [AMBIGUOUS]
  app/api/graphify-out/memory/query_20260418_113033_path_from_node_registry_to_swapnode.md · relation: conceptually_related_to
- `SwapNode` → `Build Docs From Node Registry concept node`  [AMBIGUOUS]
  app/(app)/graphify-out/memory/query_20260418_113033_path_from_node_registry_to_swapnode.md · relation: depends_on
- `SwapNode` → `Build Docs From Node Registry concept node`  [AMBIGUOUS]
  app/(app)/graphify-out/memory/query_20260418_113033_path_from_node_registry_to_swapnode.md · relation: depends_on
- `types.ts` → `Crypto Types Module`  [AMBIGUOUS]
  app/api/graphify-out/GRAPH_REPORT.md · relation: references
- `Layout entrypoints` → `Trade page node isolated in graph`  [AMBIGUOUS]
  app/api/graphify-out/memory/query_20260418_101343_path_from_layout_to_trade_page.md · relation: conceptually_related_to
- `PoolPage() Component` → `RAW_NODES Dataset (Full Graph)`  [AMBIGUOUS]
  app/(app)/graphify-out/graph_full.html · relation: references
- `Pool Detail Route` → `page.tsx`  [AMBIGUOUS]
  app/(app)/graphify-out/GRAPH_REPORT.md · relation: cites
- `Trade Route` → `page.tsx`  [AMBIGUOUS]
  app/(app)/graphify-out/GRAPH_REPORT.md · relation: cites
- `Next.js Documentation` → `Globe Icon`  [AMBIGUOUS]
  avax-agent/README.md · relation: conceptually_related_to

## Knowledge Gaps
- **148 isolated node(s):** `POOL_PAIRS Map`, `SwapCardDex Panel`, `OpenAI SDK Client`, `CoinGecko Markets API`, `CoinMarketCap Listings API` (+143 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Rootlayout Group`** (2 nodes): `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Applayout Group`** (2 nodes): `layout.tsx`, `AppLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Transactions Transactionhistory`** (2 nodes): `page.tsx`, `TransactionHistory()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Builderlayout Group`** (2 nodes): `layout.tsx`, `BuilderLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Landing Landinglayout`** (2 nodes): `layout.tsx`, `LandingLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Landing Home`** (2 nodes): `page.tsx`, `Home()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Kryllauditdata Kryllauditresponse`** (2 nodes): `KryllAuditData`, `KryllAuditResponse`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Builderlayout Group`** (2 nodes): `BuilderLayout()`, `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Agent Post`** (2 nodes): `POST (agent builder agent route)`, `POST (agent builder chat route)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Types Crypto`** (2 nodes): `Crypto Types Module`, `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Avax Agent`** (2 nodes): `layout.tsx`, `Geist Font Setup`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vercel Triangle`** (2 nodes): `Vercel Triangle Logo`, `Vercel Deployment`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Icon Window`** (2 nodes): `File Icon`, `Window Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Globe Icon`** (2 nodes): `Globe Icon`, `Next.js Documentation`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next Wordmark`** (2 nodes): `Next.js Wordmark`, `Next.js Starter Project`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Clippath 16X16`** (2 nodes): `ClipPath id a: 16x16 rectangular mask (white fill)`, `Group with clip-path url(#a)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Clippath 16X16`** (2 nodes): `ClipPath id a: 16x16 rectangular mask (white fill)`, `Group with clip-path url(#a)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Omeswap Avalanche`** (2 nodes): `OmeSwap / Avalanche DEX`, `RootLayout (app shell)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Avalanche Mainnet`** (2 nodes): `Avalanche Mainnet (Chain ID 43114)`, `Rationale: Avalanche chosen for low gas fees`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Swapcarddex Swapnode`** (2 nodes): `SwapCardDex Component`, `SwapNode (agent action)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Walletanalysisdemo Walletanalysispanel`** (2 nodes): `WalletAnalysisDemo Component`, `WalletAnalysisPanel Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Scheduletriggernode Avax`** (2 nodes): `ScheduleTriggerNode`, `ScheduleTriggerNode (avax-agent)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Agent Post`** (2 nodes): `POST() (avax-agent Agent API)`, `POST() (app/api/agent-builder route)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Chatbotpanel Agentchatbotservice`** (2 nodes): `ChatbotPanel Component`, `AgentChatbotService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Pool Group`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Trade Group`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Types Group`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Document Group`** (1 nodes): `Graph Report - app/api (2026-04-18)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Get Group`** (1 nodes): `GET()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Cluster 66`** (1 nodes): `Graph Report - app/(app)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `RootLayout()` and `app/(app)/trade/page.tsx`?**
  _Edge tagged AMBIGUOUS (relation: routes_to) - confidence is low._
- **What is the exact relationship between `RootLayout()` and `app/(app)/trade/page.tsx`?**
  _Edge tagged AMBIGUOUS (relation: routes_to) - confidence is low._
- **What is the exact relationship between `RootLayout()` and `app/(app)/trade/page.tsx`?**
  _Edge tagged AMBIGUOUS (relation: routes_to) - confidence is low._
- **What is the exact relationship between `PoolPage() Component` and `RAW_NODES Dataset (Full Graph)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `registry.ts / NODE_REGISTRY` and `SwapNode`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `SwapNode` and `Build Docs From Node Registry concept node`?**
  _Edge tagged AMBIGUOUS (relation: depends_on) - confidence is low._
- **What is the exact relationship between `SwapNode` and `Build Docs From Node Registry concept node`?**
  _Edge tagged AMBIGUOUS (relation: depends_on) - confidence is low._