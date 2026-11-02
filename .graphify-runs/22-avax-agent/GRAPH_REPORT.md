# Graph Report - /home/anik2003/Documents/omeswap/avax-agent  (2026-04-18)

## Corpus Check
- Corpus is ~19,828 words - fits in a single context window. You may not need a graph.

## Summary
- 139 nodes · 117 edges · 40 communities detected
- Extraction: 81% EXTRACTED · 18% INFERRED · 1% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Starter Docs and Branding|Starter Docs and Branding]]
- [[_COMMUNITY_Workflow Persistence|Workflow Persistence]]
- [[_COMMUNITY_Bot Execution and Backtest|Bot Execution and Backtest]]
- [[_COMMUNITY_Scheduling Controls|Scheduling Controls]]
- [[_COMMUNITY_Node Registry and State|Node Registry and State]]
- [[_COMMUNITY_Wallet Connectivity|Wallet Connectivity]]
- [[_COMMUNITY_Prompted Agent API|Prompted Agent API]]
- [[_COMMUNITY_Agent Sidebar Markdown|Agent Sidebar Markdown]]
- [[_COMMUNITY_Chart Interactions|Chart Interactions]]
- [[_COMMUNITY_Configuration Panel|Configuration Panel]]
- [[_COMMUNITY_Chart Marker Action|Chart Marker Action]]
- [[_COMMUNITY_Limit Order Action|Limit Order Action]]
- [[_COMMUNITY_Notification Action|Notification Action]]
- [[_COMMUNITY_Swap Action|Swap Action]]
- [[_COMMUNITY_DEX Price Data|DEX Price Data]]
- [[_COMMUNITY_Price Feed Data|Price Feed Data]]
- [[_COMMUNITY_Wallet Balance Data|Wallet Balance Data]]
- [[_COMMUNITY_End Flow Node|End Flow Node]]
- [[_COMMUNITY_Merge Flow Node|Merge Flow Node]]
- [[_COMMUNITY_Start Flow Node|Start Flow Node]]
- [[_COMMUNITY_Accumulator Logic|Accumulator Logic]]
- [[_COMMUNITY_Condition Logic|Condition Logic]]
- [[_COMMUNITY_Delay Logic|Delay Logic]]
- [[_COMMUNITY_Math Logic|Math Logic]]
- [[_COMMUNITY_Moving Average Logic|Moving Average Logic]]
- [[_COMMUNITY_Previous Value Logic|Previous Value Logic]]
- [[_COMMUNITY_Threshold Alert Logic|Threshold Alert Logic]]
- [[_COMMUNITY_Canvas Page|Canvas Page]]
- [[_COMMUNITY_Backtest Summary Modal|Backtest Summary Modal]]
- [[_COMMUNITY_Starter UI Icons|Starter UI Icons]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Backtest Config Strip|Backtest Config Strip]]
- [[_COMMUNITY_Flow Canvas|Flow Canvas]]
- [[_COMMUNITY_Node Palette|Node Palette]]
- [[_COMMUNITY_Toast Notifications|Toast Notifications]]
- [[_COMMUNITY_Base Node UI|Base Node UI]]
- [[_COMMUNITY_Workflow Templates|Workflow Templates]]
- [[_COMMUNITY_Agent Tools|Agent Tools]]
- [[_COMMUNITY_Shared Types|Shared Types]]

## God Nodes (most connected - your core abstractions)
1. `handleRun()` - 7 edges
2. `runBot()` - 6 edges
3. `ScheduleTriggerNode` - 6 edges
4. `Next.js Starter Project` - 6 edges
5. `executeOnce()` - 3 edges
6. `handleBacktest()` - 3 edges
7. `connectMetaMask()` - 3 edges
8. `runBacktest()` - 3 edges
9. `createNodeInstance()` - 3 edges
10. `listWorkflows()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Next.js Starter Project` --conceptually_related_to--> `Next.js Wordmark`  [INFERRED]
  avax-agent/README.md → avax-agent/public/next.svg
- `Globe Icon` --conceptually_related_to--> `Next.js Documentation`  [AMBIGUOUS]
  avax-agent/public/globe.svg → avax-agent/README.md
- `runBot()` --calls--> `setStatus()`  [INFERRED]
  avax-agent/lib/engine/BotRunner.ts → avax-agent/lib/nodes/BaseNode.ts
- `Vercel Deployment` --conceptually_related_to--> `Vercel Triangle Logo`  [INFERRED]
  avax-agent/README.md → avax-agent/public/vercel.svg
- `executeOnce()` --calls--> `runBot()`  [INFERRED]
  avax-agent/components/canvas/TopBar.tsx → avax-agent/lib/engine/BotRunner.ts

## Hyperedges (group relationships)
- **Starter Public Assets** — public_file_icon, public_globe_icon, public_nextjs_wordmark, public_vercel_logo, public_window_icon [INFERRED 0.82]

## Communities

### Community 0 - "Starter Docs and Branding"
Cohesion: 0.17
Nodes (8): Globe Icon, Next.js Wordmark, Vercel Triangle Logo, Geist Font Setup, Local Development Server, Next.js Documentation, Next.js Starter Project, Vercel Deployment

### Community 1 - "Workflow Persistence"
Cohesion: 0.2
Nodes (3): listWorkflows(), handleDelete(), handleSave()

### Community 2 - "Bot Execution and Backtest"
Cohesion: 0.2
Nodes (6): runBacktest(), runBot(), topologicalSort(), fetchBinanceHistory(), handleBacktest(), VariableNode

### Community 3 - "Scheduling Controls"
Cohesion: 0.33
Nodes (4): ScheduleTriggerNode, executeOnce(), getScheduleNode(), handleRun()

### Community 4 - "Node Registry and State"
Cohesion: 0.25
Nodes (5): init(), setConfig(), setStatus(), createNodeInstance(), loadFromSession()

### Community 5 - "Wallet Connectivity"
Cohesion: 0.5
Nodes (3): connectMetaMask(), getMetaMaskProvider(), handleConnect()

### Community 6 - "Prompted Agent API"
Cohesion: 0.5
Nodes (2): POST(), buildSystemPrompt()

### Community 7 - "Agent Sidebar Markdown"
Cohesion: 1.0
Nodes (2): inlineMarkdown(), renderMarkdown()

### Community 8 - "Chart Interactions"
Cohesion: 0.67
Nodes (0): 

### Community 9 - "Configuration Panel"
Cohesion: 0.67
Nodes (0): 

### Community 10 - "Chart Marker Action"
Cohesion: 0.67
Nodes (1): AddChartMarkerNode

### Community 11 - "Limit Order Action"
Cohesion: 0.67
Nodes (1): LimitOrderNode

### Community 12 - "Notification Action"
Cohesion: 0.67
Nodes (1): NotificationNode

### Community 13 - "Swap Action"
Cohesion: 0.67
Nodes (1): SwapNode

### Community 14 - "DEX Price Data"
Cohesion: 0.67
Nodes (1): DEXPriceNode

### Community 15 - "Price Feed Data"
Cohesion: 0.67
Nodes (1): PriceFeedNode

### Community 16 - "Wallet Balance Data"
Cohesion: 0.67
Nodes (1): WalletBalanceNode

### Community 17 - "End Flow Node"
Cohesion: 0.67
Nodes (1): EndNode

### Community 18 - "Merge Flow Node"
Cohesion: 0.67
Nodes (1): MergeNode

### Community 19 - "Start Flow Node"
Cohesion: 0.67
Nodes (1): StartNode

### Community 20 - "Accumulator Logic"
Cohesion: 0.67
Nodes (1): AccumulatorNode

### Community 21 - "Condition Logic"
Cohesion: 0.67
Nodes (1): ConditionNode

### Community 22 - "Delay Logic"
Cohesion: 0.67
Nodes (1): DelayNode

### Community 23 - "Math Logic"
Cohesion: 0.67
Nodes (1): MathNode

### Community 24 - "Moving Average Logic"
Cohesion: 0.67
Nodes (1): MovingAverageNode

### Community 25 - "Previous Value Logic"
Cohesion: 0.67
Nodes (1): PreviousValueNode

### Community 26 - "Threshold Alert Logic"
Cohesion: 0.67
Nodes (1): ThresholdAlertNode

### Community 27 - "Canvas Page"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Backtest Summary Modal"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Starter UI Icons"
Cohesion: 1.0
Nodes (2): File Icon, Window Icon

### Community 30 - "Next.js Config"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "PostCSS Config"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Backtest Config Strip"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Flow Canvas"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Node Palette"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Toast Notifications"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Base Node UI"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Workflow Templates"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Agent Tools"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Shared Types"
Cohesion: 1.0
Nodes (0): 

## Ambiguous Edges - Review These
- `Next.js Documentation` → `Globe Icon`  [AMBIGUOUS]
  avax-agent/public/globe.svg · relation: conceptually_related_to

## Knowledge Gaps
- **6 isolated node(s):** `Local Development Server`, `File Icon`, `Globe Icon`, `Next.js Wordmark`, `Vercel Triangle Logo` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Canvas Page`** (2 nodes): `page.tsx`, `CanvasPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Backtest Summary Modal`** (2 nodes): `BacktestSummaryModal.tsx`, `BacktestSummaryModal()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Starter UI Icons`** (2 nodes): `File Icon`, `Window Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Config`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PostCSS Config`** (1 nodes): `postcss.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Backtest Config Strip`** (1 nodes): `BacktestConfigStrip.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Flow Canvas`** (1 nodes): `FlowCanvas.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Node Palette`** (1 nodes): `NodePalette.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Toast Notifications`** (1 nodes): `ToastContainer.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Base Node UI`** (1 nodes): `BaseNodeComponent.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Workflow Templates`** (1 nodes): `templates.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Agent Tools`** (1 nodes): `tools.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shared Types`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Next.js Documentation` and `Globe Icon`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `runBot()` connect `Bot Execution and Backtest` to `Scheduling Controls`, `Node Registry and State`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `setStatus()` connect `Node Registry and State` to `Bot Execution and Backtest`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `executeOnce()` connect `Scheduling Controls` to `Bot Execution and Backtest`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `handleRun()` (e.g. with `.reset()` and `.shouldContinue()`) actually correct?**
  _`handleRun()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `runBot()` (e.g. with `executeOnce()` and `runBacktest()`) actually correct?**
  _`runBot()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Local Development Server`, `File Icon`, `Globe Icon` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._