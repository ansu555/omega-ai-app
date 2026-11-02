# ATS — Implementation Phases Index

This directory breaks the full ATS implementation (documented in [ATS_Agent_Execution_Flow.md](../ATS_Agent_Execution_Flow.md)) into 9 sequential phases. Each phase builds on the previous one and produces concrete, testable outputs before the next phase begins.

---

## Phase map

```
Phase 0 — Foundation
    Docker + Redis + Postgres + shared models
    │
    ▼
Phase 1 — Agent 1: Data Ingestion
    Binance WS, NewsAPI, DeFiLlama, CoinGecko
    price_buffer and normalized_queue flowing
    │
    ▼
Phase 2 — Agent 4: Regime Detection
    HMM model, BTC vol + funding rate, regime:current in Redis
    │
    ├──────────────────────────────────┐
    ▼                                  ▼
Phase 3 — Agent 2: Signal Agent    Phase 4 — Agent 3: Graph Agent
    FinBERT + technicals               DeFi protocol dependency graph
    signal:latest in Redis             secondary token queuing
    │                                  │
    └──────────────┬───────────────────┘
                   ▼
Phase 5 — Agent 5: Risk Management
    10-rule evaluator, Kelly criterion
    RiskDecision with full position spec
                   │
                   ▼
Phase 6 — Orchestrator (LangGraph)
    regime → signal+graph → risk → consensus
    Decision Receipts written to Postgres
                   │
                   ▼
Phase 7 — Agent 6: Execution Agent
    ccxt Binance, TWAP, fill monitor, stop-loss loop
    portfolio:state and execution:fills in Redis
                   │
                   ▼
Phase 8 — API, WebSocket & Conversation Layer
    FastAPI, /api/chat (Claude API + RAG), WebSocket fill feed
    System is end-to-end complete
```

---

## Phase files

| Phase | File | What it builds | Agent |
|---|---|---|---|
| 0 | [phase-0-foundation.md](phase-0-foundation.md) | Docker, Redis, Postgres, shared models | — |
| 1 | [phase-1-data-ingestion.md](phase-1-data-ingestion.md) | All data source workers, normalizer, price buffers | Agent 1 |
| 2 | [phase-2-regime-detection.md](phase-2-regime-detection.md) | HMM regime classifier, BTC vol, funding rate | Agent 4 |
| 3 | [phase-3-signal-agent.md](phase-3-signal-agent.md) | FinBERT sentiment, technical indicators, signal combiner | Agent 2 |
| 4 | [phase-4-graph-agent.md](phase-4-graph-agent.md) | DeFi protocol graph, propagation scoring, secondary queuing | Agent 3 |
| 5 | [phase-5-risk-agent.md](phase-5-risk-agent.md) | 10-rule evaluator, Kelly criterion, position sizing | Agent 5 |
| 6 | [phase-6-orchestrator.md](phase-6-orchestrator.md) | LangGraph pipeline, consensus, Decision Receipts | Orchestrator |
| 7 | [phase-7-execution-agent.md](phase-7-execution-agent.md) | ccxt order routing, TWAP, fill monitor, stop-loss | Agent 6 |
| 8 | [phase-8-api-and-conversation.md](phase-8-api-and-conversation.md) | FastAPI, WebSocket, Claude Conversation Layer | API |

---

## Key design rules across all phases

- **Agents never call each other directly.** All inter-agent communication is through Redis keys and `normalized_queue`.
- **Agent 1 owns all external connections.** No other agent calls Binance, CoinGecko, or NewsAPI directly (except Agent 6, which writes orders only).
- **Risk Agent veto is absolute.** No consensus rule, user setting, or operating mode can override a Risk veto.
- **Market orders only for stop-loss exits.** All entries use limit orders to avoid paying spread.
- **Decision Receipt is written for every cycle** — whether the trade executes or is skipped. The Conversation Layer always has audit data.
