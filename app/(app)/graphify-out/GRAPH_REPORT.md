# Graph Report - app/(app)  (2026-04-18)

## Corpus Check
- Corpus is ~41,289 words - fits in a single context window. You may not need a graph.

## Summary
- 98 nodes · 97 edges · 19 communities detected
- Extraction: 82% EXTRACTED · 12% INFERRED · 5% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Graph Report Narrative|Graph Report Narrative]]
- [[_COMMUNITY_Layout And API Routing|Layout And API Routing]]
- [[_COMMUNITY_Agent Builder Execution Flow|Agent Builder Execution Flow]]
- [[_COMMUNITY_Graph HTML Visualization|Graph HTML Visualization]]
- [[_COMMUNITY_Pool Detail UI Flow|Pool Detail UI Flow]]
- [[_COMMUNITY_Agent Runtime Architecture|Agent Runtime Architecture]]
- [[_COMMUNITY_Public Asset Icons|Public Asset Icons]]
- [[_COMMUNITY_Wallet Analysis Hooks|Wallet Analysis Hooks]]
- [[_COMMUNITY_Node Registry Workflow|Node Registry Workflow]]
- [[_COMMUNITY_Explore Favorites Logic|Explore Favorites Logic]]
- [[_COMMUNITY_Portfolio Page Helpers|Portfolio Page Helpers]]
- [[_COMMUNITY_Portfolio Data Pipeline|Portfolio Data Pipeline]]
- [[_COMMUNITY_App Layout Wrapper|App Layout Wrapper]]
- [[_COMMUNITY_Transactions History Page|Transactions History Page]]
- [[_COMMUNITY_Deep Mode Audit Notes|Deep Mode Audit Notes]]
- [[_COMMUNITY_Pool Route Entry|Pool Route Entry]]
- [[_COMMUNITY_Trade Route Entry|Trade Route Entry]]
- [[_COMMUNITY_Portfolio Route Entry|Portfolio Route Entry]]
- [[_COMMUNITY_Trade Page Component|Trade Page Component]]

## God Nodes (most connected - your core abstractions)
1. `Graph Report - app/(app)` - 8 edges
2. `PoolPage() Component` - 8 edges
3. `Main Route Entrypoints and Layouts Query` - 7 edges
4. `runBot()` - 6 edges
5. `main app agent-builder stack` - 6 edges
6. `Graph HTML Visualizer` - 6 edges
7. `Graph Full HTML Visualizer` - 6 edges
8. `Visual assets surface in avax-agent/public` - 5 edges
9. `App Layout Shell` - 4 edges
10. `Transactions History View` - 4 edges

## Surprising Connections (you probably didn't know these)
- `RAW_NODES Dataset (Full Graph)` --references--> `PoolPage() Component`  [AMBIGUOUS]
  app/(app)/graphify-out/graph_full.html → app/(app)/pool/[id]/page.tsx
- `Pool Detail Route Node (app_app_pool_id_page_tsx)` --conceptually_related_to--> `PoolPage() Component`  [INFERRED]
  app/(app)/graphify-out/graph.html → app/(app)/pool/[id]/page.tsx
- `RootLayout()` --routes_to--> `app/(app)/trade/page.tsx`  [AMBIGUOUS]
  app/(app)/graphify-out/memory/query_20260418_101338_what_are_the_main_route_entrypoints_and_layouts_in.md → app/(app)/graphify-out/memory/query_20260418_101343_path_from_layout_to_trade_page.md
- `BotRunner.ts` --semantically_similar_to--> `BacktestRunner.ts`  [INFERRED] [semantically similar]
  app/(app)/graphify-out/memory/query_20260418_113033_path_from_flowcanvas_to_botrunner.md → app/(app)/graphify-out/memory/query_20260418_113033_explain_backtestrunner.md
- `Graph HTML Visualizer` --semantically_similar_to--> `Graph Full HTML Visualizer`  [INFERRED] [semantically similar]
  app/(app)/graphify-out/graph.html → app/(app)/graphify-out/graph_full.html

## Hyperedges (group relationships)
- **Thin Route/View Communities** — graph_report_community_app_layout_shell, graph_report_community_transactions_history_view, graph_report_community_pool_detail_route, graph_report_community_trade_route [EXTRACTED 1.00]
- **Route and Layout Entry Surface** — app_api_crypto_route, crypto_get_handler, app_api_agent_builder_chat_route, agent_builder_chat_post_handler, app_api_agent_builder_agent_route, root_layout, app_layout, builder_layout, landing_layout [EXTRACTED 1.00]
- **Agent Builder Authoring-to-Execution Flow** — canvas_page, flow_canvas, top_bar, handle_run, execute_once, run_bot, bot_runner, handle_backtest, run_backtest, backtest_runner [EXTRACTED 1.00]
- **Duplicated Agent Builder Stack Across Main App and avax-agent** — main_app_agent_builder, avax_agent_app, bot_runner, backtest_runner, node_registry, create_node_instance, workflow_manager, top_bar, api_agent_route_pair [EXTRACTED 1.00]
- **Graph HTML Visualization Pipeline** — graph_html_graph_visualizer, graph_html_raw_nodes_dataset, graph_html_raw_edges_dataset, graph_html_legend_dataset, graph_html_vis_network_instance [EXTRACTED 1.00]
- **Graph Full Visualization Pipeline** — graph_full_html_graph_visualizer, graph_full_html_raw_nodes_dataset, graph_full_html_raw_edges_dataset, graph_full_html_legend_dataset, graph_full_html_vis_network_instance [EXTRACTED 1.00]
- **Pool Detail Route Data Flow** — page_poolpage_component, page_use_pool_details_hook, page_user_position_contract_read, page_transactions_table, page_user_position_panel, page_swapcarddex_panel [INFERRED 0.84]

## Communities

### Community 0 - "Graph Report Narrative"
Cohesion: 0.22
Nodes (11): App Layout Shell, Explore Favorites Flow, Pool Detail Route, Portfolio Pricing Flow, Trade Route, Transactions History View, Corpus fits single context window, Graph Report - app/(app) (+3 more)

### Community 1 - "Layout And API Routing"
Cohesion: 0.17
Nodes (9): POST() agent-builder chat handler, app/api/agent-builder/agent/route.ts, app/api/agent-builder/chat/route.ts, app/api/crypto/route.ts, AST graph missed layout-to-route binding, GET() crypto handler, Main Route Entrypoints and Layouts Query, RootLayout() (+1 more)

### Community 2 - "Agent Builder Execution Flow"
Cohesion: 0.24
Nodes (11): CanvasPage, executeOnce(), FlowCanvas.tsx, handleBacktest(), handleRun(), Reuse live DAG executor for backtests, runBacktest(), runBot() (+3 more)

### Community 3 - "Graph HTML Visualization"
Cohesion: 0.2
Nodes (11): Graph Full HTML Visualizer, Hyperedges Array (Full Graph), LEGEND Community Dataset (Full Graph), RAW_EDGES Dataset (Full Graph), RAW_NODES Dataset (Full Graph), vis.Network Instance (Full Graph), Graph HTML Visualizer, Hyperedges Array (+3 more)

### Community 4 - "Pool Detail UI Flow"
Cohesion: 0.24
Nodes (10): Pool Detail Route Node (app_app_pool_id_page_tsx), RAW_NODES Dataset, Pool Information Card, POOL_PAIRS Map, PoolPage() Component, SwapCardDex Panel, Pool Transactions Table, usePoolDetails Hook Call (+2 more)

### Community 5 - "Agent Runtime Architecture"
Cohesion: 0.38
Nodes (7): app/api/agent/route.ts + app/api/agent-builder/agent/route.ts, avax-agent app, BacktestRunner.ts, BotRunner.ts, Near-total structural duplication, main app agent-builder stack, WorkflowManager

### Community 6 - "Public Asset Icons"
Cohesion: 0.33
Nodes (6): file.svg icon, globe.svg icon, Next.js logo asset (next.svg), Vercel triangle mark (vercel.svg), Visual assets surface in avax-agent/public, window.svg icon

### Community 7 - "Wallet Analysis Hooks"
Cohesion: 0.5
Nodes (5): Alias resolution not stitched across folders, analyzeWallet(), useWalletAnalysis(), useWalletAnalysisQuery(), WalletAnalysisPanel.tsx

### Community 8 - "Node Registry Workflow"
Cohesion: 0.5
Nodes (3): Build Docs From Node Registry concept node, registry.ts / NODE_REGISTRY, SwapNode

### Community 9 - "Explore Favorites Logic"
Cohesion: 0.67
Nodes (0): 

### Community 10 - "Portfolio Page Helpers"
Cohesion: 0.67
Nodes (0): 

### Community 11 - "Portfolio Data Pipeline"
Cohesion: 0.67
Nodes (1): app/(app)/portfolio/page.tsx

### Community 12 - "App Layout Wrapper"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Transactions History Page"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Deep Mode Audit Notes"
Cohesion: 1.0
Nodes (2): Run with deep mode for richer edges, Low signal explains missing generated questions

### Community 15 - "Pool Route Entry"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Trade Route Entry"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Portfolio Route Entry"
Cohesion: 1.0
Nodes (1): app/(app)/portfolio/page.tsx

### Community 18 - "Trade Page Component"
Cohesion: 1.0
Nodes (1): app/(app)/trade/page.tsx

## Ambiguous Edges - Review These
- `Pool Detail Route` → `page.tsx`  [AMBIGUOUS]
  app/(app)/graphify-out/GRAPH_REPORT.md · relation: cites
- `Trade Route` → `page.tsx`  [AMBIGUOUS]
  app/(app)/graphify-out/GRAPH_REPORT.md · relation: cites
- `RootLayout()` → `app/(app)/trade/page.tsx`  [AMBIGUOUS]
  app/(app)/graphify-out/memory/query_20260418_101343_path_from_layout_to_trade_page.md · relation: routes_to
- `SwapNode` → `Build Docs From Node Registry concept node`  [AMBIGUOUS]
  app/(app)/graphify-out/memory/query_20260418_113033_path_from_node_registry_to_swapnode.md · relation: depends_on
- `RAW_NODES Dataset (Full Graph)` → `PoolPage() Component`  [AMBIGUOUS]
  app/(app)/graphify-out/graph_full.html · relation: references

## Knowledge Gaps
- **31 isolated node(s):** `app/(app)/portfolio/page.tsx`, `app/(app)/trade/page.tsx`, `Corpus fits single context window`, `100% extracted relationships`, `layout.tsx` (+26 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `App Layout Wrapper`** (2 nodes): `layout.tsx`, `AppLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Transactions History Page`** (2 nodes): `page.tsx`, `TransactionHistory()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Deep Mode Audit Notes`** (2 nodes): `Run with deep mode for richer edges`, `Low signal explains missing generated questions`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Pool Route Entry`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Trade Route Entry`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Portfolio Route Entry`** (1 nodes): `app/(app)/portfolio/page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Trade Page Component`** (1 nodes): `app/(app)/trade/page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Pool Detail Route` and `page.tsx`?**
  _Edge tagged AMBIGUOUS (relation: cites) - confidence is low._
- **What is the exact relationship between `Trade Route` and `page.tsx`?**
  _Edge tagged AMBIGUOUS (relation: cites) - confidence is low._
- **What is the exact relationship between `RootLayout()` and `app/(app)/trade/page.tsx`?**
  _Edge tagged AMBIGUOUS (relation: routes_to) - confidence is low._
- **What is the exact relationship between `SwapNode` and `Build Docs From Node Registry concept node`?**
  _Edge tagged AMBIGUOUS (relation: depends_on) - confidence is low._
- **What is the exact relationship between `RAW_NODES Dataset (Full Graph)` and `PoolPage() Component`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `PoolPage() Component` connect `Pool Detail UI Flow` to `Graph HTML Visualization`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `Graph HTML Visualizer` connect `Graph HTML Visualization` to `Pool Detail UI Flow`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._