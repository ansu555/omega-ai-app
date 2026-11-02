# Graph Report - /home/anik2003/Documents/omeswap/lib/agent-builder  (2026-04-18)

## Corpus Check
- Corpus is ~12,343 words - fits in a single context window. You may not need a graph.

## Summary
- 109 nodes · 94 edges · 28 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Chatbot Validation|Chatbot Validation]]
- [[_COMMUNITY_Workflow Storage|Workflow Storage]]
- [[_COMMUNITY_Execution Engine|Execution Engine]]
- [[_COMMUNITY_Node Base Registry|Node Base Registry]]
- [[_COMMUNITY_Schedule Trigger|Schedule Trigger]]
- [[_COMMUNITY_Avalanche Providers|Avalanche Providers]]
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
- [[_COMMUNITY_System Prompt|System Prompt]]
- [[_COMMUNITY_Backtest History|Backtest History]]
- [[_COMMUNITY_Block Templates|Block Templates]]
- [[_COMMUNITY_Workflow Templates|Workflow Templates]]
- [[_COMMUNITY_Agent Tooling|Agent Tooling]]

## God Nodes (most connected - your core abstractions)
1. `AgentStorageManager` - 12 edges
2. `ScheduleTriggerNode` - 6 edges
3. `runBot()` - 5 edges
4. `AgentValidator` - 4 edges
5. `AgentChatbotService` - 2 edges
6. `generateBlockId()` - 2 edges
7. `getMetaMaskProvider()` - 2 edges
8. `connectMetaMask()` - 2 edges
9. `runBacktest()` - 2 edges
10. `topologicalSort()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `runBot()` --calls--> `setStatus()`  [INFERRED]
  engine/BotRunner.ts → nodes/BaseNode.ts
- `runBacktest()` --calls--> `runBot()`  [INFERRED]
  backtest/BacktestRunner.ts → engine/BotRunner.ts
- `createNodeInstance()` --calls--> `init()`  [INFERRED]
  nodes/registry.ts → nodes/BaseNode.ts

## Communities

### Community 0 - "Chatbot Validation"
Cohesion: 0.18
Nodes (3): AgentChatbotService, AgentValidator, generateBlockId()

### Community 1 - "Workflow Storage"
Cohesion: 0.24
Nodes (1): AgentStorageManager

### Community 2 - "Execution Engine"
Cohesion: 0.29
Nodes (4): runBacktest(), runBot(), topologicalSort(), VariableNode

### Community 3 - "Node Base Registry"
Cohesion: 0.25
Nodes (3): init(), setStatus(), createNodeInstance()

### Community 4 - "Schedule Trigger"
Cohesion: 0.43
Nodes (1): ScheduleTriggerNode

### Community 5 - "Avalanche Providers"
Cohesion: 0.67
Nodes (2): connectMetaMask(), getMetaMaskProvider()

### Community 6 - "Chart Marker Action"
Cohesion: 0.67
Nodes (1): AddChartMarkerNode

### Community 7 - "Limit Order Action"
Cohesion: 0.67
Nodes (1): LimitOrderNode

### Community 8 - "Notification Action"
Cohesion: 0.67
Nodes (1): NotificationNode

### Community 9 - "Swap Action"
Cohesion: 0.67
Nodes (1): SwapNode

### Community 10 - "DEX Price Data"
Cohesion: 0.67
Nodes (1): DEXPriceNode

### Community 11 - "Price Feed Data"
Cohesion: 0.67
Nodes (1): PriceFeedNode

### Community 12 - "Wallet Balance Data"
Cohesion: 0.67
Nodes (1): WalletBalanceNode

### Community 13 - "End Flow Node"
Cohesion: 0.67
Nodes (1): EndNode

### Community 14 - "Merge Flow Node"
Cohesion: 0.67
Nodes (1): MergeNode

### Community 15 - "Start Flow Node"
Cohesion: 0.67
Nodes (1): StartNode

### Community 16 - "Accumulator Logic"
Cohesion: 0.67
Nodes (1): AccumulatorNode

### Community 17 - "Condition Logic"
Cohesion: 0.67
Nodes (1): ConditionNode

### Community 18 - "Delay Logic"
Cohesion: 0.67
Nodes (1): DelayNode

### Community 19 - "Math Logic"
Cohesion: 0.67
Nodes (1): MathNode

### Community 20 - "Moving Average Logic"
Cohesion: 0.67
Nodes (1): MovingAverageNode

### Community 21 - "Previous Value Logic"
Cohesion: 0.67
Nodes (1): PreviousValueNode

### Community 22 - "Threshold Alert Logic"
Cohesion: 0.67
Nodes (1): ThresholdAlertNode

### Community 23 - "System Prompt"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Backtest History"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Block Templates"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Workflow Templates"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Agent Tooling"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `System Prompt`** (2 nodes): `systemPrompt.ts`, `buildSystemPrompt()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Backtest History`** (2 nodes): `fetchHistory.ts`, `fetchBinanceHistory()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Block Templates`** (1 nodes): `block-templates.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Workflow Templates`** (1 nodes): `templates.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Agent Tooling`** (1 nodes): `tools.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AgentStorageManager` connect `Workflow Storage` to `Chatbot Validation`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `runBot()` connect `Execution Engine` to `Node Base Registry`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `runBot()` (e.g. with `runBacktest()` and `setStatus()`) actually correct?**
  _`runBot()` has 3 INFERRED edges - model-reasoned connections that need verification._