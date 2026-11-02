# OmeSwap — Project Description

OmeSwap is a chain-agnostic, agentic trading platform that combines a DeFi execution layer with a six-agent AI decision engine. It is designed as an explainable trading co-pilot where users can automate execution, get assisted recommendations, or run in research-only mode while keeping full visibility into why each decision is made.

## What We Built

- A multi-agent ATS pipeline (Data, Signal, Graph, Regime, Risk, Execution) that collaborates on every trade decision.
- A visual strategy builder (drag-and-drop DAG) with indicators, logic blocks, and backtesting workflows.
- A DEX execution stack with AMM liquidity pools and multi-hop routing contracts.
- A strategy/indicator marketplace flow with validation, publishing, and activation APIs.
- Decision-receipt and memory infrastructure so actions remain auditable and explainable over time.

## Core Product Value

- Explainability first: decisions are traceable to source signals, agent votes, and risk checks.
- User-control by design: Autonomous, Assisted, and Solo modes support different trust and control levels.
- Chain portability: execution adapters can be swapped while preserving core agent logic.
- End-to-end ownership: from research and signal generation to risk-gated execution and reporting.

## High-Level Architecture

1. Frontend and product UX: Next.js + React terminal, portfolio, research, and builder interfaces.
2. Agentic intelligence layer: Python ATS services for orchestration, consensus, and risk-aware execution.
3. On-chain execution layer: Solidity contracts for liquidity pools, routing, and trade interactions.
4. Data and persistence layer: API routes, storage, and receipts for replayable decision history.

## Who It Is For

- Traders who want AI-assisted execution with transparent reasoning.
- Strategy creators who want to build, test, and publish reusable alpha logic.
- Teams building chain-aware trading products that need a modular AI + DeFi foundation.
