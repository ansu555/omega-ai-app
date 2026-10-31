# Graph Report - components/trade  (2026-04-19)

## Corpus Check
- Corpus is ~23,824 words - fits in a single context window. You may not need a graph.

## Summary
- 124 nodes · 109 edges · 34 communities detected
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Agent Chatbot Processing|Agent Chatbot Processing]]
- [[_COMMUNITY_Agent Storage Management|Agent Storage Management]]
- [[_COMMUNITY_Wallet Chain Utilities|Wallet Chain Utilities]]
- [[_COMMUNITY_Backtest Bot Execution|Backtest Bot Execution]]
- [[_COMMUNITY_Base Node Registry|Base Node Registry]]
- [[_COMMUNITY_Schedule Trigger Logic|Schedule Trigger Logic]]
- [[_COMMUNITY_Add Chart Marker|Add Chart Marker]]
- [[_COMMUNITY_Limit Order Node|Limit Order Node]]
- [[_COMMUNITY_Notification Node|Notification Node]]
- [[_COMMUNITY_Swap Execution Node|Swap Execution Node]]
- [[_COMMUNITY_DEX Price Node|DEX Price Node]]
- [[_COMMUNITY_Price Feed Node|Price Feed Node]]
- [[_COMMUNITY_Wallet Balance Node|Wallet Balance Node]]
- [[_COMMUNITY_End Node Flow|End Node Flow]]
- [[_COMMUNITY_Merge Node Logic|Merge Node Logic]]
- [[_COMMUNITY_Start Node Flow|Start Node Flow]]
- [[_COMMUNITY_Accumulator Node|Accumulator Node]]
- [[_COMMUNITY_Condition Branch Node|Condition Branch Node]]
- [[_COMMUNITY_Delay Timing Node|Delay Timing Node]]
- [[_COMMUNITY_Math Node Ops|Math Node Ops]]
- [[_COMMUNITY_Moving Average Node|Moving Average Node]]
- [[_COMMUNITY_Previous Value Node|Previous Value Node]]
- [[_COMMUNITY_Threshold Alert Node|Threshold Alert Node]]
- [[_COMMUNITY_Utility Classnames|Utility Classnames]]
- [[_COMMUNITY_System Prompt Builder|System Prompt Builder]]
- [[_COMMUNITY_Binance History Fetch|Binance History Fetch]]
- [[_COMMUNITY_Wallet Analysis Engine|Wallet Analysis Engine]]
- [[_COMMUNITY_Block Template Library|Block Template Library]]
- [[_COMMUNITY_Agent Template Library|Agent Template Library]]
- [[_COMMUNITY_Tool Definition Registry|Tool Definition Registry]]
- [[_COMMUNITY_Provider Adapter|Provider Adapter]]
- [[_COMMUNITY_Avalanche Chain Runtime|Avalanche Chain Runtime]]
- [[_COMMUNITY_Shared Type Definitions|Shared Type Definitions]]
- [[_COMMUNITY_Avalanche Schema Types|Avalanche Schema Types]]

## God Nodes (most connected - your core abstractions)
1. `AgentStorageManager` - 12 edges
2. `ScheduleTriggerNode` - 6 edges
3. `getChainConfig()` - 6 edges
4. `runBot()` - 5 edges
5. `AgentValidator` - 4 edges
6. `connectWallet()` - 4 edges
7. `getPublicProvider()` - 3 edges
8. `getDefaultChainId()` - 3 edges
9. `AgentChatbotService` - 2 edges
10. `generateBlockId()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `runBot()` --calls--> `setStatus()`  [INFERRED]
  lib/agent-builder/engine/BotRunner.ts → lib/agent-builder/nodes/BaseNode.ts
- `runBacktest()` --calls--> `runBot()`  [INFERRED]
  lib/agent-builder/backtest/BacktestRunner.ts → lib/agent-builder/engine/BotRunner.ts
- `getPublicProvider()` --calls--> `getChainConfig()`  [INFERRED]
  lib/agent-builder/evm-provider.ts → lib/chain-registry/index.ts
- `getPublicProvider()` --calls--> `getDefaultChainId()`  [INFERRED]
  lib/agent-builder/evm-provider.ts → lib/chain-registry/index.ts
- `connectWallet()` --calls--> `getDefaultChainId()`  [INFERRED]
  lib/agent-builder/evm-provider.ts → lib/chain-registry/index.ts

## Communities

### Community 0 - "Agent Chatbot Processing"
Cohesion: 0.18
Nodes (3): AgentChatbotService, AgentValidator, generateBlockId()

### Community 1 - "Agent Storage Management"
Cohesion: 0.24
Nodes (1): AgentStorageManager

### Community 2 - "Wallet Chain Utilities"
Cohesion: 0.31
Nodes (8): connectWallet(), getMetaMaskProvider(), getPublicProvider(), getChainConfig(), getDefaultChainId(), getDexRouters(), getExplorerLink(), getTokens()

### Community 3 - "Backtest Bot Execution"
Cohesion: 0.29
Nodes (4): runBacktest(), runBot(), topologicalSort(), VariableNode

### Community 4 - "Base Node Registry"
Cohesion: 0.25
Nodes (3): init(), setStatus(), createNodeInstance()

### Community 5 - "Schedule Trigger Logic"
Cohesion: 0.43
Nodes (1): ScheduleTriggerNode

### Community 6 - "Add Chart Marker"
Cohesion: 0.67
Nodes (1): AddChartMarkerNode

### Community 7 - "Limit Order Node"
Cohesion: 0.67
Nodes (1): LimitOrderNode

### Community 8 - "Notification Node"
Cohesion: 0.67
Nodes (1): NotificationNode

### Community 9 - "Swap Execution Node"
Cohesion: 0.67
Nodes (1): SwapNode

### Community 10 - "DEX Price Node"
Cohesion: 0.67
Nodes (1): DEXPriceNode

### Community 11 - "Price Feed Node"
Cohesion: 0.67
Nodes (1): PriceFeedNode

### Community 12 - "Wallet Balance Node"
Cohesion: 0.67
Nodes (1): WalletBalanceNode

### Community 13 - "End Node Flow"
Cohesion: 0.67
Nodes (1): EndNode

### Community 14 - "Merge Node Logic"
Cohesion: 0.67
Nodes (1): MergeNode

### Community 15 - "Start Node Flow"
Cohesion: 0.67
Nodes (1): StartNode

### Community 16 - "Accumulator Node"
Cohesion: 0.67
Nodes (1): AccumulatorNode

### Community 17 - "Condition Branch Node"
Cohesion: 0.67
Nodes (1): ConditionNode

### Community 18 - "Delay Timing Node"
Cohesion: 0.67
Nodes (1): DelayNode

### Community 19 - "Math Node Ops"
Cohesion: 0.67
Nodes (1): MathNode

### Community 20 - "Moving Average Node"
Cohesion: 0.67
Nodes (1): MovingAverageNode

### Community 21 - "Previous Value Node"
Cohesion: 0.67
Nodes (1): PreviousValueNode

### Community 22 - "Threshold Alert Node"
Cohesion: 0.67
Nodes (1): ThresholdAlertNode

### Community 23 - "Utility Classnames"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "System Prompt Builder"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Binance History Fetch"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Wallet Analysis Engine"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Block Template Library"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Agent Template Library"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Tool Definition Registry"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Provider Adapter"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Avalanche Chain Runtime"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Shared Type Definitions"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Avalanche Schema Types"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Utility Classnames`** (2 nodes): `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `System Prompt Builder`** (2 nodes): `systemPrompt.ts`, `buildSystemPrompt()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Binance History Fetch`** (2 nodes): `fetchBinanceHistory()`, `fetchHistory.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Wallet Analysis Engine`** (2 nodes): `wallet-analysis.ts`, `analyzeWallet()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Block Template Library`** (1 nodes): `block-templates.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Agent Template Library`** (1 nodes): `templates.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tool Definition Registry`** (1 nodes): `tools.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Provider Adapter`** (1 nodes): `provider.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Avalanche Chain Runtime`** (1 nodes): `avalanche.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shared Type Definitions`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Avalanche Schema Types`** (1 nodes): `avalanche.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AgentStorageManager` connect `Agent Storage Management` to `Agent Chatbot Processing`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `runBot()` connect `Backtest Bot Execution` to `Base Node Registry`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `getChainConfig()` (e.g. with `getPublicProvider()` and `connectWallet()`) actually correct?**
  _`getChainConfig()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `runBot()` (e.g. with `runBacktest()` and `setStatus()`) actually correct?**
  _`runBot()` has 3 INFERRED edges - model-reasoned connections that need verification._