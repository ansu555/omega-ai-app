---
type: "explain"
date: "2026-04-18T11:30:33.969399+00:00"
question: "Explain BacktestRunner"
contributor: "graphify"
source_nodes: ["BacktestRunner.ts", "runBacktest()", "runBot()"]
---

# Q: Explain BacktestRunner

## Answer

BacktestRunner.ts is the backtest orchestration file, and the graph models its main exported entrypoint as runBacktest(). That function snapshots and clears per-node state, wraps blockchain-touching nodes with simulated execute() behavior, calls runBot() once per candle with backtestCandle in the context, tracks markers and signals, then restores original state at the end. In other words, BacktestRunner reuses the live DAG executor instead of implementing a separate execution engine.

## Source Nodes

- BacktestRunner.ts
- runBacktest()
- runBot()