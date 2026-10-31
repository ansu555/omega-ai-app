# Graph Report - lib/agent-builder  (2026-04-19)

## Corpus Check
- Corpus is ~491 words - fits in a single context window. You may not need a graph.

## Summary
- 151 nodes · 140 edges · 35 communities detected
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Agent Chatbot Validation|Agent Chatbot Validation]]
- [[_COMMUNITY_Agent Storage Operations|Agent Storage Operations]]
- [[_COMMUNITY_Backtest Bot Execution|Backtest Bot Execution]]
- [[_COMMUNITY_Base Node Lifecycle|Base Node Lifecycle]]
- [[_COMMUNITY_Schedule Trigger Control|Schedule Trigger Control]]
- [[_COMMUNITY_Report Trading Bridges|Report Trading Bridges]]
- [[_COMMUNITY_Avalanche Provider Utilities|Avalanche Provider Utilities]]
- [[_COMMUNITY_Trading Node Execution|Trading Node Execution]]
- [[_COMMUNITY_Chart Marker Node|Chart Marker Node]]
- [[_COMMUNITY_Notification Node Flow|Notification Node Flow]]
- [[_COMMUNITY_Price Feed Node|Price Feed Node]]
- [[_COMMUNITY_End Node Flow|End Node Flow]]
- [[_COMMUNITY_Merge Node Logic|Merge Node Logic]]
- [[_COMMUNITY_Start Node Flow|Start Node Flow]]
- [[_COMMUNITY_Accumulator Node Logic|Accumulator Node Logic]]
- [[_COMMUNITY_Condition Node Logic|Condition Node Logic]]
- [[_COMMUNITY_Delay Node Logic|Delay Node Logic]]
- [[_COMMUNITY_Math Node Logic|Math Node Logic]]
- [[_COMMUNITY_Moving Average Node|Moving Average Node]]
- [[_COMMUNITY_Previous Value Node|Previous Value Node]]
- [[_COMMUNITY_Threshold Alert Node|Threshold Alert Node]]
- [[_COMMUNITY_System Prompt Builder|System Prompt Builder]]
- [[_COMMUNITY_Binance History Fetching|Binance History Fetching]]
- [[_COMMUNITY_Limit Order Node|Limit Order Node]]
- [[_COMMUNITY_Swap Node Logic|Swap Node Logic]]
- [[_COMMUNITY_DEX Price Node|DEX Price Node]]
- [[_COMMUNITY_Wallet Balance Node|Wallet Balance Node]]
- [[_COMMUNITY_Block Templates Module|Block Templates Module]]
- [[_COMMUNITY_Node Templates Module|Node Templates Module]]
- [[_COMMUNITY_Agent Tools Module|Agent Tools Module]]
- [[_COMMUNITY_Provider Module|Provider Module]]
- [[_COMMUNITY_Block Templates Duplicate|Block Templates Duplicate]]
- [[_COMMUNITY_Templates Duplicate|Templates Duplicate]]
- [[_COMMUNITY_Tools Duplicate|Tools Duplicate]]
- [[_COMMUNITY_Avalanche Chain Constant|Avalanche Chain Constant]]

## God Nodes (most connected - your core abstractions)
1. `AgentStorageManager` - 13 edges
2. `ScheduleTriggerNode` - 7 edges
3. `runBot()` - 6 edges
4. `AgentValidator` - 5 edges
5. `Agent Builder Graph Report` - 5 edges
6. `SwapNode.execute()` - 4 edges
7. `AgentChatbotService` - 3 edges
8. `generateBlockId()` - 3 edges
9. `connectWallet()` - 3 edges
10. `runBacktest()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `runBot()` --calls--> `setStatus()`  [INFERRED]
  engine/BotRunner.ts → nodes/BaseNode.ts
- `runBacktest()` --calls--> `runBot()`  [INFERRED]
  backtest/BacktestRunner.ts → engine/BotRunner.ts
- `Agent Builder Graph Report` --references--> `LimitOrderNode`  [EXTRACTED]
  lib/agent-builder/graphify-out/GRAPH_REPORT.md → lib/agent-builder/nodes/action/LimitOrderNode.ts
- `Agent Builder Graph Report` --references--> `SwapNode`  [EXTRACTED]
  lib/agent-builder/graphify-out/GRAPH_REPORT.md → lib/agent-builder/nodes/action/SwapNode.ts
- `Agent Builder Graph Report` --references--> `DEXPriceNode`  [EXTRACTED]
  lib/agent-builder/graphify-out/GRAPH_REPORT.md → lib/agent-builder/nodes/data/DEXPriceNode.ts

## Hyperedges (group relationships)
- **Quote Trigger Execute Flow** — dexpricenode_execute, limitordernode_execute, swapnode_execute [INFERRED 0.86]
- **Graphify Artifact Feedback Loop** — agent_builder_graph_report, agent_builder_graph_html, agent_builder_confidence_encoding, agent_builder_surprising_connections [INFERRED 0.76]

## Communities

### Community 0 - "Agent Chatbot Validation"
Cohesion: 0.2
Nodes (6): AgentChatbotService, getBlockStyle(), AgentValidator, generateAgentId(), generateBlockId(), generateConnectionId()

### Community 1 - "Agent Storage Operations"
Cohesion: 0.24
Nodes (1): AgentStorageManager

### Community 2 - "Backtest Bot Execution"
Cohesion: 0.22
Nodes (4): runBacktest(), runBot(), topologicalSort(), VariableNode

### Community 3 - "Base Node Lifecycle"
Cohesion: 0.29
Nodes (6): constructor(), init(), setConfig(), setStatus(), createNodeInstance(), meta()

### Community 4 - "Schedule Trigger Control"
Cohesion: 0.36
Nodes (1): ScheduleTriggerNode

### Community 5 - "Report Trading Bridges"
Cohesion: 0.29
Nodes (7): Betweenness bridge rationale, Agent Builder Graph Report, Surprising Connections section, DEXPriceNode, LimitOrderNode, SwapNode, WalletBalanceNode

### Community 6 - "Avalanche Provider Utilities"
Cohesion: 0.4
Nodes (5): Deprecated Avalanche Provider Exports, connectMetaMask alias, connectWallet(), getMetaMaskProvider(), getPublicProvider()

### Community 7 - "Trading Node Execution"
Cohesion: 0.5
Nodes (4): DEXPriceNode.execute(), LimitOrderNode.execute(), SwapNode.execute(), addTransaction() usage

### Community 8 - "Chart Marker Node"
Cohesion: 0.5
Nodes (1): AddChartMarkerNode

### Community 9 - "Notification Node Flow"
Cohesion: 0.5
Nodes (1): NotificationNode

### Community 10 - "Price Feed Node"
Cohesion: 0.5
Nodes (1): PriceFeedNode

### Community 11 - "End Node Flow"
Cohesion: 0.5
Nodes (1): EndNode

### Community 12 - "Merge Node Logic"
Cohesion: 0.5
Nodes (1): MergeNode

### Community 13 - "Start Node Flow"
Cohesion: 0.5
Nodes (1): StartNode

### Community 14 - "Accumulator Node Logic"
Cohesion: 0.5
Nodes (1): AccumulatorNode

### Community 15 - "Condition Node Logic"
Cohesion: 0.5
Nodes (1): ConditionNode

### Community 16 - "Delay Node Logic"
Cohesion: 0.5
Nodes (1): DelayNode

### Community 17 - "Math Node Logic"
Cohesion: 0.5
Nodes (1): MathNode

### Community 18 - "Moving Average Node"
Cohesion: 0.5
Nodes (1): MovingAverageNode

### Community 19 - "Previous Value Node"
Cohesion: 0.5
Nodes (1): PreviousValueNode

### Community 20 - "Threshold Alert Node"
Cohesion: 0.5
Nodes (1): ThresholdAlertNode

### Community 21 - "System Prompt Builder"
Cohesion: 0.67
Nodes (1): buildSystemPrompt()

### Community 22 - "Binance History Fetching"
Cohesion: 0.67
Nodes (1): fetchBinanceHistory()

### Community 23 - "Limit Order Node"
Cohesion: 0.67
Nodes (1): LimitOrderNode

### Community 24 - "Swap Node Logic"
Cohesion: 0.67
Nodes (1): SwapNode

### Community 25 - "DEX Price Node"
Cohesion: 0.67
Nodes (1): DEXPriceNode

### Community 26 - "Wallet Balance Node"
Cohesion: 0.67
Nodes (1): WalletBalanceNode

### Community 27 - "Block Templates Module"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Node Templates Module"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Agent Tools Module"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Provider Module"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Block Templates Duplicate"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Templates Duplicate"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Tools Duplicate"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Avalanche Chain Constant"
Cohesion: 1.0
Nodes (1): AVALANCHE_CHAIN_ID constant

## Knowledge Gaps
- **9 isolated node(s):** `Deprecated Avalanche Provider Exports`, `connectMetaMask alias`, `AVALANCHE_CHAIN_ID constant`, `LimitOrderNode`, `SwapNode` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Block Templates Module`** (1 nodes): `block-templates.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Node Templates Module`** (1 nodes): `templates.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Agent Tools Module`** (1 nodes): `tools.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Provider Module`** (1 nodes): `provider.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Block Templates Duplicate`** (1 nodes): `block-templates.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Templates Duplicate`** (1 nodes): `templates.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tools Duplicate`** (1 nodes): `tools.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Avalanche Chain Constant`** (1 nodes): `AVALANCHE_CHAIN_ID constant`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AgentStorageManager` connect `Agent Storage Operations` to `Agent Chatbot Validation`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `runBot()` connect `Backtest Bot Execution` to `Base Node Lifecycle`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `runBot()` (e.g. with `runBacktest()` and `setStatus()`) actually correct?**
  _`runBot()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Deprecated Avalanche Provider Exports`, `connectMetaMask alias`, `AVALANCHE_CHAIN_ID constant` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._