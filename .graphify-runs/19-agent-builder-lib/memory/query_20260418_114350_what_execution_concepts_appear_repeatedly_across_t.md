---
type: "query"
date: "2026-04-18T11:43:50.985589+00:00"
question: "What execution concepts appear repeatedly across the agent system?"
contributor: "graphify"
source_nodes: ["runBot()", "topologicalSort()", "ScheduleTriggerNode", "runBacktest()", "createNodeInstance()", "setStatus()"]
---

# Q: What execution concepts appear repeatedly across the agent system?

## Answer

Repeated execution concepts in this graph are: node-level .execute() methods across action, data, flow, and logic nodes; orchestration through runBot() and topologicalSort(); scheduling controls in ScheduleTriggerNode via .getInterval(), .getMaxRuns(), .shouldContinue(), .execute(), and .reset(); backtesting reuse where runBacktest() calls runBot(); and lifecycle/state hooks where createNodeInstance() calls init() and runBot() calls setStatus().

## Source Nodes

- runBot()
- topologicalSort()
- ScheduleTriggerNode
- runBacktest()
- createNodeInstance()
- setStatus()