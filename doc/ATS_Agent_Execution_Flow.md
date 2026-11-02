# ATS — Agent Execution Flow
### Complete Technical Reference for Developers

> **System:** Agentic Trading System (ATS) — Multi-Agent AI Architecture  
> **Version:** MVP-Ready Reference  
> **Scope:** Agent roles, real-time data sourcing, inter-agent logic, risk management, trade execution, tech stack

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Real-Time Data Architecture](#2-real-time-data-architecture)
3. [The Six Agents — Roles & Logic](#3-the-six-agents--roles--logic)
4. [Inter-Agent Communication & Execution Flow](#4-inter-agent-communication--execution-flow)
5. [Risk Management Logic](#5-risk-management-logic)
6. [Trade Execution Flow](#6-trade-execution-flow)
7. [Shared Memory & State](#7-shared-memory--state)
8. [Full Tech Stack](#8-full-tech-stack)
9. [End-to-End Example](#9-end-to-end-example-aave-wbtc-shock)

> **Implementation phases:** Step-by-step build guides for each agent live in [doc/phases/index.md](phases/index.md)

---

## 1. System Overview

The ATS deploys **six specialized AI agents** that run concurrently, communicate through a shared event bus, and collectively vote on every trading decision. No single agent can execute a trade alone. Every decision requires multi-agent consensus, and the Risk Agent holds absolute veto power.

```
External World
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│  Agent 1 — Data Ingestion                               │
│  (watches everything: prices, news, filings, sentiment) │
└────────────────────────┬────────────────────────────────┘
                         │  normalized data packets
                         ▼
              ┌──────────────────┐
              │   Event Bus      │  ← in-process queue (MVP)
              │  (Kafka in prod) │    or Kafka (production)
              └──┬───┬───┬───┬──┘
                 │   │   │   │
        ┌────────┘   │   │   └────────┐
        ▼            ▼   ▼            ▼
   Agent 2      Agent 3  Agent 4   Agent 5
   Signal       Graph    Regime    Risk
   Agent        Agent    Agent     Agent
        │            │   │            │
        └────────────┴───┴────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │  Orchestrator    │  ← LangGraph StateGraph
              │  (vote counter)  │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │  Agent 6         │
              │  Execution Agent │
              └────────┬─────────┘
                       │
                       ▼
              Exchange / Broker API
              (Alpaca, Binance, etc.)
```

**Three operating modes:**

| Mode | What agents do | Who executes |
|---|---|---|
| Autonomous | Full pipeline — agents trade on behalf of user | Agents |
| Assisted | Agents produce research dossier per ticker | User decides |
| Solo | Agents answer research questions only | User only |

---

## 2. Real-Time Data Architecture

### 2.1 What "Real-Time" Means Per Data Type

Not all data needs the same latency. The ATS splits data into tiers:

| Tier | Latency needed | Source | Protocol |
|---|---|---|---|
| Price ticks | < 100ms | Binance WS / Alpaca WS | WebSocket |
| News events | < 5s | NewsAPI / Polygon.io | REST polling or WebSocket |
| SEC filings | < 60s | SEC EDGAR RSS | RSS polling |
| Social sentiment | < 30s | Reddit pushshift / Twitter filtered stream | REST polling |
| Options/GEX data | < 10s | Tradier / Polygon options | REST polling |
| Macro releases | event-driven | FRED / BLS | Webhook / polling |

### 2.2 Binance WebSocket — When and How

**Yes, the system uses Binance WebSocket for crypto assets.** For equities it uses Alpaca's WebSocket stream.

**Binance WebSocket (crypto)** connects to `wss://stream.binance.com:9443/stream` and subscribes to a combined ticker stream for all monitored crypto pairs (e.g. `btcusdt@ticker`, `ethusdt@ticker`). Each incoming message is parsed and standardized into a normalized price packet containing the ticker symbol, last price, 24h volume, price change percentage, bid/ask spread, and a millisecond timestamp. The connection is fully async and auto-reconnects with a 3-second backoff on any disconnect.

Every packet produced by the Binance WebSocket is assigned a `freshness_score` of 1.0 (just arrived) and a `reliability_weight` of 0.95 (Binance is a high-reliability source). These two values multiply to produce the packet's **Content Quality (CQ) score**, which all downstream agents use to weight how much they trust this data.

**Alpaca WebSocket (equities — US stocks)** connects via the Alpaca `StockDataStream` SDK and subscribes to minute bars (OHLCV) for all monitored equity tickers. Each bar fires an event containing the symbol, open, high, low, close, volume, VWAP, and ISO timestamp. This is the primary source of equity price data for Agent 1's rolling price buffer, which Agent 2 reads for technical indicator computation.

### 2.3 News — Polling vs Streaming

NewsAPI free tier is polling only (no WebSocket). For MVP, the system polls every 60 seconds per ticker. Each article retrieved is checked against a deduplication set (keyed by URL) so the same headline is never processed twice.

Each article is tagged with a **source reliability weight** based on its domain — Reuters and Bloomberg score highest (~0.91–0.93), while Reddit and anonymous blogs score lowest (~0.55–0.60). The article's age in seconds is used to compute a **freshness score** that decays linearly over one hour. CQ score = freshness × reliability.

In production, Polygon.io's news WebSocket (`wss://delayed.polygon.io/stocks`) replaces polling and delivers headlines within seconds of publication.

### 2.4 The Central Event Queue

All data sources — Binance WebSocket, Alpaca WebSocket, NewsAPI poller, SEC RSS watcher, and Reddit poller — write into a single shared raw queue. Agent 1 reads from this queue, normalizes every packet into a standard format, scores it for quality, deduplicates it, and drops anything with a CQ score below 0.20 before pushing it to a second normalized queue that downstream agents consume.

```
Binance WS ──┐
Alpaca WS  ──┤
News Poller──┤──► raw queue ──► Agent 1 normalizer ──► normalized queue
SEC RSS    ──┤                                                │
Reddit     ──┘                                    consumed by Agents 2, 3, 4
```

In production this queue pair is replaced by **Apache Kafka** topics. The transport layer changes; the agent logic does not.

---

## 3. The Six Agents — Roles & Logic

---

### Agent 1 — Data Ingestion Agent
**"The Eyes and Ears"**

**Role:** Watch every data source simultaneously, normalize all incoming data into a standard packet format, score data quality, detect anomalies, and push clean packets downstream.

**Why it exists:** Raw data from Binance, NewsAPI, Reddit, and SEC EDGAR arrives in completely different formats, at different latencies, with different reliability levels. Every downstream agent needs the same normalized format so they can focus on their own logic instead of parsing raw APIs.

**Real-time data sources:**

| Source | Protocol | Latency | Used for |
|---|---|---|---|
| Binance | WebSocket | < 100ms | Crypto price ticks |
| Alpaca | WebSocket | < 100ms | US equity price bars |
| NewsAPI / Polygon | REST poll / WS | 5–60s | News headlines |
| SEC EDGAR | RSS poll | 30–90s | 8-K, 13F filings |
| Reddit (pushshift) | REST poll | 30s | Retail sentiment |
| FRED | REST | on-release | Macro data (CPI, etc.) |

**How it works:** The agent runs all six source workers concurrently using `asyncio.gather`. Each worker is responsible for one source and runs as an infinite async loop. When a packet arrives, the central normalization loop picks it up from the raw queue, stamps it with a unique ID, computes its CQ score, checks it against the dedup set, and — if it passes — pushes it to the normalized queue. Any packet with a CQ score below 0.20 is silently dropped. The dedup set prevents the same news article or price tick from triggering multiple analysis cycles.

**Anomaly detection:** A coordinated information attack (20+ social posts in 60 seconds with cosine similarity above 0.85) is flagged and tagged before FinBERT even sees the text. This prevents manufactured sentiment spikes from fooling Agent 2.

**Output:** Normalized data packets — each with guaranteed fields: `id`, `type`, `ticker`, `payload`, `cq_score`, `received_at` — pushed to the normalized queue and consumed by Agents 2, 3, and 4.

---

### Agent 2 — Signal Agent
**"The Brain"**

**Role:** Produce a trade signal (LONG / SHORT / NEUTRAL) for a given ticker by combining sentiment analysis, technical indicators, and ML model output into a single confidence-weighted vote.

**Why it exists:** No single signal source is reliable enough on its own. Sentiment alone can be manipulated. Technicals alone are lagging. By fusing all three in one agent — weighted by the current market regime — the signal carries far more predictive content than any individual component.

**Real-time data needed:** Yes — consumes normalized price packets from Agent 1's queue to maintain a rolling 60-bar price buffer per ticker. Also reads the current regime from Redis (published by Agent 4) at the start of every analysis cycle to determine which indicators to trust and how much to weight them.

**Does it connect directly to Binance?** No. Agent 2 never touches external APIs. It exclusively reads from Agent 1's normalized queue and from Redis. Agent 1 owns all external connections.

**Three sub-modules run in parallel:**

**Sentiment sub-module** loads FinBERT (`ProsusAI/finbert`) once at startup. When news packets arrive for a ticker, it batches up to 10 headlines and runs them through the model simultaneously. Each result (positive/negative/neutral + confidence score) is then weighted by the source article's CQ score before averaging — a Reuters article with CQ 0.91 counts nearly twice as much as a Reddit post with CQ 0.55. The final weighted sentiment score ranges from -1.0 (strongly negative) to +1.0 (strongly positive).

**Technical sub-module** reads the ticker's rolling 60-bar OHLCV buffer and computes RSI(14), MACD histogram, and Bollinger Band %B using `pandas-ta`. Which indicator is trusted depends on the current regime: in trending regimes (`low_vol_bull`, `high_vol_bull`), the MACD histogram is the primary signal and the system trusts momentum. In `choppy` regime, Bollinger Band %B drives mean-reversion signals. In `bear` or `crisis` regime, the technical module returns NEUTRAL and stands down entirely.

**Combination logic:** For a LONG signal, sentiment score must be above +0.25 AND the technical module must independently agree (LONG). For a SHORT signal, sentiment must be below -0.25 AND technicals must agree. If the two modules disagree, the output is always NEUTRAL. This forces multi-source agreement before any directional signal is emitted.

**Output:** Vote object containing `{direction, confidence, sentiment_breakdown, technical_breakdown, regime_used}` published to the Orchestrator via the event bus.

---

### Agent 3 — Graph & Relationship Agent
**"The Network Analyst"**

**Role:** Understand how DeFi protocols and tokens are connected — shared collateral pools, liquidity routing dependencies, bridge exposure, and token correlation clusters — and compute how a risk event hitting one protocol propagates through the on-chain ecosystem.

**Why it exists:** DeFi moves on second-order effects that most participants miss. When a major lending protocol pauses a collateral market, every token that uses that protocol as a yield source or collateral layer re-prices before any news is published. The Graph Agent systematically catches these on-chain relationships and queues affected tokens for analysis in the same cycle.

**Four relationship types tracked:**

| Relationship type | Example | Propagation direction |
|---|---|---|
| Collateral dependency | WBTC used in Aave → Aave pause → WBTC dump | Negative |
| Liquidity pool coupling | Token paired with USDC in Curve → depeg → paired token drops | Negative |
| Bridge exposure | Token bridged via Stargate → Stargate exploit → bridged version at risk | Negative |
| Token correlation cluster | BTC dominance spike → altcoins bleed regardless of fundamentals | Directional |

**Real-time data needed:** Moderate. The protocol dependency graph is rebuilt nightly from on-chain data — Dune Analytics queries for pool composition, The Graph subgraphs for protocol TVL flows, and DeFiLlama protocol API for cross-chain exposure. During live trading, the Graph Agent listens to Agent 1's normalized queue for on-chain events and news, then traverses the pre-built static graph on demand. It does not need its own WebSocket connection.

**How it works:** When an event arrives for a trigger token or protocol (e.g. Aave pauses WBTC borrowing), the agent looks up the trigger in the DeFi protocol graph and retrieves all tier-1 and tier-2 connected tokens. Tier-1 connections are direct protocol relationships (collateral, LP pairing, bridge wrapping). Tier-2 are second-degree connections (protocols that depend on a tier-1 protocol). Each connection has a base propagation weight. The agent multiplies the event's sentiment score by each connection's weight to produce an impact score. Tier-2 impacts are further discounted by 50% to reflect signal attenuation over graph distance.

All tokens with an absolute impact score above 0.20 are added to the next-cycle analysis queue so they each go through the full agent pipeline independently.

> **Production upgrade path:** In production the static lookup is replaced by a Neo4j graph database with Cypher queries and GraphSAGE-learned propagation weights trained on historical DeFi contagion events. The inputs and outputs of the agent are identical — no other agent changes.

**Output:** Impact propagation scores for all connected tokens, plus a directional vote for the trigger token, published to the Orchestrator.

---

### Agent 4 — Regime Detection Agent
**"The Weatherman"**

**Role:** Classify the current market environment into one of six regimes and broadcast that classification to every other agent so they can adapt their behavior accordingly.

**Why it exists:** The same signal that works in a calm bull trend is catastrophic in a choppy or bear market. Without regime awareness, all other agents would apply the same logic regardless of market conditions. The Regime Agent is the global context provider for the entire system — its output is the first thing every other agent reads at the start of each cycle.

**Real-time data needed:** Yes — reads three crypto-native market signals: BTC 30-day realized volatility, BTC/ETH price data, and the perpetual futures funding rate across major pairs. In the MVP these are fetched via REST every 15 minutes from CoinGecko (price/vol) and Binance futures API (funding rate). In production they are streamed continuously via Binance WebSocket.

**This agent's output is the most critical broadcast in the entire system.**

**How it works:** The agent uses a 6-state Gaussian Hidden Markov Model (`hmmlearn`) trained on 2 years of daily crypto data. The feature matrix has three columns: daily BTC return, BTC 30-day realized volatility, and the average perpetual funding rate across BTC and ETH. The HMM learns to identify latent market states from patterns in these three features rather than from any single threshold rule. After training, the model predicts the current state from the most recent observations and looks up the human-readable label from a fixed mapping. Confidence is derived from the log-probability of the recent observation sequence under the model. The model is retrained monthly on a rolling 2-year window.

The regime result — label, confidence, and timestamp — is immediately written to the Redis key `regime:current`. Every other agent reads this key as its first action on each cycle, guaranteeing all agents operate on the same regime context.

**Why these three features for crypto:**

| Feature | What it captures | Stock market equivalent |
|---|---|---|
| Daily BTC return | Market direction | SPY daily return |
| BTC 30d realized vol | Fear / calm baseline | VIX |
| Perpetual funding rate | Long/short market bias; negative = fear | 10Y-2Y yield spread |

**The six regimes and what they mean for other agents:**

| Regime | Market state | Signal Agent behavior | Risk Agent behavior |
|---|---|---|---|
| `low_vol_bull` | Calm uptrend | Trust MACD/EMA, full-weight signals | Full Kelly sizing |
| `high_vol_bull` | Volatile uptrend | Reduce momentum confidence | Kelly × 0.7 |
| `choppy` | No clear trend | Mean reversion only; ignore MACD | Kelly × 0.5 |
| `bear` | Downtrend | Short bias only; all longs blocked | Kelly × 0.4 |
| `high_vol_bear` | Panic selling | Defensive; mostly cash | Kelly × 0.2 |
| `crisis` | Black swan | **ALL new trades blocked** | Hard halt — 0 size |

**Output:** Regime dict written to Redis key `regime:current`. Also writes `market:btc_vol` (BTC 30d realized volatility) and `market:funding_rate` (latest perpetual funding rate) to Redis so Agent 5 can apply the volatility-based position size multiplier without re-fetching. All agents read `regime:current` on every cycle. Re-broadcast every 15 minutes regardless of whether the regime has changed.

---

### Agent 5 — Risk Management Agent
**"The Gatekeeper"**

**Role:** Receive signals and regime context from the Orchestrator, apply position sizing using the Kelly Criterion, validate the proposed trade against all hard risk rules, and return a final approved/rejected decision with exact position size, stop-loss price, and take-profit price.

**Why it exists:** Every other agent is optimistic by nature — they look for trades to make. The Risk Agent is the only agent whose entire job is to say no. Its veto is absolute and cannot be overridden by any other agent or any user setting in any operating mode.

**Real-time data needed:** Yes — reads the current portfolio state (positions, cash balance, daily drawdown percentage, protocol category weights) from Redis on every single evaluation. Also reads the latest BTC 30-day realized volatility (`market:btc_vol`), the perpetual funding rate (`market:funding_rate`), and the current price of the token from Redis. None of these require a direct WebSocket connection — they are all maintained in Redis by Agent 1 and Agent 4.

**The Risk Agent has no vote. It has a veto.**

**How it works:** Ten rules are evaluated in strict sequence. The first rule that fails immediately returns a veto — no further rules are checked. Rules 1–5 are binary pass/fail gates. Rules 6–9 are sizing calculations that progressively scale down the position. Rule 10 is a final sanity check.

The ten rules in sequence: (1) crisis mode halt, (2) daily drawdown circuit breaker, (3) minimum signal confidence threshold, (4) direction-versus-regime conflict check, (5) protocol category concentration limit, (6) Kelly Criterion sizing, (7) BTC volatility-based size reduction, (8) regime-based size scaling, (9) minimum position size check, and (10) zero-shares guard after all sizing.

**Position sizing logic:** The Kelly formula computes the theoretically optimal fraction of portfolio to risk. The system uses quarter-Kelly (multiplied by 0.25) for conservatism. That fraction is then further reduced by the BTC volatility multiplier (×0.5 if BTC 30d realized vol > 35%) and the regime multiplier (×1.0 down to ×0.2 depending on regime). The result is the final position size as a percentage of portfolio. Maximum position is hard-capped at 8% regardless of what Kelly produces.

**Hard limits — these cannot be changed at runtime:**

| Limit | Value |
|---|---|
| Max risk per trade | 2% of portfolio |
| Max single position | 8% of portfolio |
| Max protocol category concentration | 20% of portfolio |
| Daily drawdown halt | 5% daily loss |
| Minimum signal confidence | 0.60 |
| BTC 30d vol high threshold | 35% (triggers 50% size cut) |
| Kelly fraction applied | 0.25 (quarter-Kelly) |

**Output:** Approved/rejected decision with full position specification: token amount, size in USD, position percentage, stop-loss price, take-profit price, BTC 30d vol at decision time, and regime at decision time. If approved, the Orchestrator routes the full spec to Agent 6.

---

### Agent 6 — Execution Agent
**"The Hands"**

**Role:** Receive a fully specified, risk-approved order and execute it on the actual exchange or broker using smart order routing to minimize market impact and slippage.

**Why it exists:** How you enter a trade is as important as whether to enter it. A large market order moves the price against you before it fills. Agent 6 handles order type selection, order splitting, fill monitoring, stop-loss enforcement, and fill quality reporting.

**Real-time data needed:** Yes — reads the live bid/ask spread from the broker at the moment of order submission to set limit prices correctly. Directly calls Binance REST API (for crypto) or Alpaca Trading API (for equities). This is the only agent that has write access to external systems.

**Exchange connections:**

| Asset class | API used | Notes |
|---|---|---|
| Crypto | Binance REST via `ccxt` | Unified interface; supports Bybit, OKX with zero code changes |
| US equities | Alpaca Trading API | Paper and live accounts; free tier available |
| DeFi | Chain Adapter (Uniswap/GMX) | Deferred to production |

**How it works:** The agent first determines asset class (crypto or equity) from the ticker. It then selects an execution strategy based on order size. For orders below $10K, it submits a single limit order priced at ask × 1.001 for buys (or bid × 0.999 for sells) to ensure fast fills without paying full spread. For orders between $10K and $100K, it splits into 5 equal slices executed over 10 minutes (TWAP). For orders above $100K, it uses VWAP-timed slicing aligned to historical volume patterns.

After submission, the agent polls the broker for fill status every 2 seconds. On confirmation, it updates the portfolio state in Redis, appends the fill to the execution fills list in Redis, writes the fill data back to the Decision Receipt in Postgres, and broadcasts the fill event via WebSocket to the trading terminal.

**Stop-loss enforcement** runs as a background loop. On every incoming price tick from the normalized queue, Agent 6 checks whether the current price has breached any open position's stop-loss level. If breached, it immediately submits a market order to exit — market orders are only used for stop-loss exits, never for entries.

**Execution strategy selection:**

| Order size | Strategy | How it works |
|---|---|---|
| < $10K | Single limit order | One limit order, 30s timeout, then cancel |
| $10K–$100K | TWAP | 5 equal slices over 10 minutes |
| > $100K | VWAP | Sliced over volume-weighted time windows |

**Output:** Fill report written to Redis and Postgres. Actual fill price vs. theoretical entry price is computed as slippage and fed back to Agent 2's price buffer so the signal agent's confidence calibration improves over time.

---

## 4. Inter-Agent Communication & Execution Flow

### 4.1 The Orchestrator — How Agents Vote

The Orchestrator is a **LangGraph StateGraph** — not an agent itself, but a coordination protocol. It defines which agent runs in which order, collects all agent outputs into a shared `AgentState` object, applies consensus rules, and routes to either Agent 6 (execute) or END (skip).

**The `AgentState` object** is the single shared data structure that flows through the entire pipeline on each cycle. It carries: the trigger ticker and event, the regime classification, the signal vote, the graph vote, the risk decision, the consensus result, and the receipt ID. Every agent node receives the full state and returns an updated copy.

**Execution order within LangGraph:**

1. Regime node runs first — reads from Redis (instantaneous, regime was set up to 15 min ago)
2. Signal node and Graph node run in parallel (fan-out) — both receive the regime
3. Risk node runs after both Signal and Graph complete (fan-in)
4. Orchestrator node collects all three outputs, applies consensus, writes the Decision Receipt
5. Conditional routing: consensus = EXECUTE → Execution node; otherwise → END

**Consensus rules applied by the Orchestrator:**

| Condition | Consensus |
|---|---|
| Risk Agent returned veto (any reason) | SKIP |
| Signal direction = NEUTRAL | SKIP |
| Signal confidence ≥ 0.75 AND risk approved | EXECUTE |
| Signal confidence 0.60–0.74 AND risk approved | SKIP (escalate to assisted mode if enabled) |

### 4.2 Full Execution Timeline (Tick to Trade)

```
T+0ms     Binance WebSocket fires price tick for BTCUSDT
          OR on-chain monitor detects new governance event for a tracked DeFi protocol
                │
T+10ms    Agent 1 normalizes packet, computes CQ score, pushes to queue
                │
T+50ms    LangGraph pipeline starts (trigger: scheduled or event-driven)
          Regime Agent reads from Redis (regime was set 15min ago — instant)
                │
T+50ms    Signal Agent and Graph Agent start in parallel:
          - Signal: FinBERT runs on latest news, technical on price buffer
          - Graph: traverses DeFi protocol dependency graph for trigger token
                │
T+300ms   Signal Agent vote ready
T+90ms    Graph Agent vote ready (faster — no ML model)
                │
T+310ms   Risk Agent receives both votes, reads portfolio from Redis,
          applies 10 rules, computes Kelly size
                │
T+350ms   Orchestrator collects all votes, applies consensus rule,
          writes Decision Receipt to Postgres
                │
T+360ms   If EXECUTE: Execution Agent receives sized order
          Selects strategy (single limit / TWAP / VWAP)
          Submits to Alpaca or Binance
                │
T+500ms–  Order placed at exchange
T+5000ms  Fill confirmed (depends on market conditions)
                │
          Fill written to Redis (portfolio state updated)
          Fill appended to Decision Receipt in Postgres
          WebSocket broadcasts fill event to trading terminal UI
          Conversation Layer indexes receipt — user can now ask questions
```

---

## 5. Risk Management Logic

### 5.1 The 10 Hard Rules

These rules are evaluated sequentially by Agent 5. The first rule that fails immediately vetoes the trade — no subsequent rules are checked.

| # | Rule | Limit | Veto code |
|---|---|---|---|
| 1 | Crisis mode | Regime = crisis | `crisis_mode_active` |
| 2 | Daily drawdown | Portfolio down ≥ 5% today | `daily_drawdown_limit` |
| 3 | Confidence threshold | Signal confidence < 0.60 | `confidence_too_low` |
| 4 | Direction vs regime | LONG in bear/crisis regime | `direction_regime_conflict` |
| 5 | Protocol category concentration | Category weight ≥ 20% | `category_limit_reached` |
| 6 | Kelly sizing | If Kelly gives size < $50 | `position_too_small` |
| 7 | BTC vol adjustment | BTC 30d vol > 35% → cut size 50% | *(not a veto — size reduction)* |
| 8 | Regime scaling | Scale by regime multiplier | *(not a veto — size reduction)* |
| 9 | Max risk per trade | Risk USD > 2% of portfolio | Auto-resize, then recheck |
| 10 | Zero shares check | Shares = 0 after all sizing | `zero_shares_after_sizing` |

### 5.2 Position Sizing — Kelly Criterion

The Kelly formula determines the theoretically optimal fraction of capital to allocate to any given trade:

```
f* = (p × b − q) / b

where:
  p = probability of win  (= signal confidence)
  q = 1 − p               (probability of loss)
  b = reward/risk ratio   (target gain ÷ stop-loss distance)

Quarter-Kelly applied:  actual_f = f* × 0.25
```

**Worked example:**

- Signal confidence = 0.70 → p = 0.70, q = 0.30
- Reward/risk ratio = 2.0 (4% target, 2% stop-loss)
- f\* = (0.70 × 2 − 0.30) / 2 = 0.55
- Quarter-Kelly: 0.55 × 0.25 = 0.1375 → 13.75% of portfolio
- BTC 30d realized vol = 38% (above 35% threshold): 13.75% × 0.5 = 6.875%
- Regime = `high_vol_bull`: × 0.7 → **4.8% final position size**

### 5.3 Stop-Loss Rules

Every approved trade is issued with a stop-loss price calculated before order submission. The stop-loss is stored in Redis and Agent 6 monitors it on every incoming price tick.

- **Stop-loss price (long)** = entry price × (1 − stop_loss_pct)
- **Stop-loss price (short)** = entry price × (1 + stop_loss_pct)
- **Stop-loss pct** = 2% fixed (MVP) / ATR × 1.5 (production)
- **Trailing stop** activates once the trade is profitable: highest price since entry × (1 − ATR × 2.0)

Stop-loss exits always use market orders. Speed of exit takes priority over price precision when a stop is triggered.

---

## 6. Trade Execution Flow

### 6.1 Decision → Exchange: Step by Step

**Step 1** — Orchestrator emits EXECUTE with the full risk decision object: ticker, direction, shares, size in USD, stop-loss price, take-profit price.

**Step 2** — Agent 6 receives the risk decision and determines asset class. If the ticker is in the configured crypto list, it routes to Binance. If in the equity list, it routes to Alpaca.

**Step 3** — Agent 6 selects execution strategy based on order size: single limit order for under $10K, TWAP for $10K–$100K, VWAP for over $100K.

**Step 4** — Agent 6 fetches the current bid/ask from the broker. For a buy it sets the limit price at ask × 1.001 (a 0.1% buffer above ask to ensure the order hits). For a sell it sets bid × 0.999.

**Step 5** — Order is submitted to the exchange. For Alpaca this is a `LimitOrderRequest` with `TimeInForce.DAY`. For Binance this is a `create_limit_order` call via `ccxt`.

**Step 6** — Agent 6 polls for fill status every 2 seconds. If a limit order has not filled within 30 seconds, it is cancelled and re-evaluated at the updated spread.

**Step 7** — On fill confirmation: portfolio state is updated in Redis; fill is appended to the execution fills list in Redis; fill data is written back to the Decision Receipt in Postgres; WebSocket broadcasts the fill event to the trading terminal.

**Step 8** — Risk Agent's background stop-loss monitor begins watching the open position. On every price tick, it compares current price to stored stop-loss price. If breached, Agent 6 immediately submits a market exit order.

### 6.2 Order Types Used

| Condition | Order type | Reason |
|---|---|---|
| Normal entry | Limit order | Never pays more than intended |
| Stop-loss trigger | Market order | Speed of exit > price precision |
| Large order (TWAP) | Series of limits | Minimize market impact |
| Crypto entry | Limit via ccxt | Same logic — no market orders on entry |

The system never places a market order for entry. Only stop-loss exits and emergency halts use market orders.

### 6.3 TWAP Execution Detail

When order size falls between $10K and $100K, the full order is split into 5 equal slices. Each slice is submitted as a separate limit order with a fresh bid/ask fetch immediately before submission. Slices are spaced 2 minutes apart, giving a 10-minute total execution window. The average fill price across all 5 slices is reported as the position's entry price. This reduces market impact by preventing a single large order from moving the price against the position before it fully fills.

---

## 7. Shared Memory & State

### 7.1 Redis Key Schema (Live State)

All agents share state through Redis. No agent calls another agent directly — they communicate exclusively via Redis reads/writes and the event bus.

| Key | Type | Written by | Read by | Contents |
|---|---|---|---|---|
| `regime:current` | String (JSON) | Agent 4 | Agents 2, 3, 5, Orchestrator | `{regime, confidence, updated_at}` |
| `regime:updated_at` | String | Agent 4 | Monitoring | Unix timestamp |
| `price:{TICKER}` | String (float) | Agent 1 | Agents 5, 6 | Latest price |
| `price_buffer:{TICKER}` | String (JSON list) | Agent 1 | Agent 2 | Last 60 OHLCV bars |
| `market:btc_vol` | String (float) | Agent 4 | Agent 5 | BTC 30-day realized volatility |
| `market:funding_rate` | String (float) | Agent 4 | Agent 5 | Latest perpetual funding rate (avg BTC+ETH) |
| `portfolio:state` | String (JSON) | Agent 6 | Agent 5 | Positions, cash, drawdown, sector weights |
| `execution:fills` | List | Agent 6 | Monitoring, Agent 5 | Last 1000 fill reports |
| `signal:latest:{TICKER}` | String (JSON) | Agent 2 | Conversation Layer | Most recent signal output |

### 7.2 Postgres Schema (Persistent Records)

Three tables cover all persistent state in the MVP.

**`decision_receipts`** — one row per analysis cycle, whether the trade was executed or skipped. Contains: receipt ID, ticker, timestamp, trigger event, regime at the time, all agent votes, risk decision with veto reason if applicable, consensus result, fill data (null until filled), and final P&L once the trade is closed.

**`strategies`** — one row per strategy in the marketplace. Contains: strategy ID, name, description, the React Flow node DAG as JSON, author, win rate, Sharpe ratio, max drawdown, trade count, alpha contribution score, and install status.

**`portfolio_snapshots`** — one row per snapshot (taken after every fill). Contains: timestamp, total portfolio value, cash balance, all open positions as JSON, and daily P&L.

### 7.3 What Each Agent Reads/Writes

| Agent | Reads from Redis | Writes to Redis | Reads Postgres | Writes Postgres |
|---|---|---|---|---|
| Agent 1 (Data) | — | `price:{ticker}`, `price_buffer:{ticker}` | — | — |
| Agent 2 (Signal) | `regime:current`, `price_buffer:{ticker}` | `signal:latest:{ticker}` | — | — |
| Agent 3 (Graph) | `price:{ticker}` | — | — | — |
| Agent 4 (Regime) | `price_buffer:BTC`, `price_buffer:ETH` | `regime:current`, `regime:updated_at`, `market:btc_vol`, `market:funding_rate` | — | — |
| Agent 5 (Risk) | `portfolio:state`, `regime:current`, `market:btc_vol`, `market:funding_rate`, `price:{ticker}` | — | — | — |
| Orchestrator | — | — | — | `decision_receipts` |
| Agent 6 (Execution) | `portfolio:state` | `portfolio:state`, `execution:fills` | — | `decision_receipts` (fill update) |
| Conversation Layer | — | — | `decision_receipts` | — |

---

## 8. Full Tech Stack

### Backend — Agent Layer

| Component | Technology | Why |
|---|---|---|
| Agent framework | **LangGraph** | StateGraph for Orchestrator vote flow; conditional routing; inspectable |
| Web framework | **FastAPI** | Async-native; WebSocket support; auto OpenAPI docs |
| Async runtime | **asyncio** | Non-blocking I/O across all data source connections |
| Task queue | **asyncio.Queue** (MVP) / **Apache Kafka** (prod) | Decoupled agent communication; Kafka adds replay + durability |
| Sentiment NLP | **HuggingFace Transformers** — `ProsusAI/finbert` | Domain-specific BERT for financial text; best-in-class for news scoring |
| Technical indicators | **pandas-ta** | 130+ indicators; pandas-native; no TA-Lib C dependency issues |
| Regime detection | **hmmlearn** (`GaussianHMM`) | Hidden Markov Model for latent market state classification |
| Graph (MVP) | Python dict | Static DeFi protocol dependency map — zero setup, demo-ready |
| Graph (prod) | **Neo4j** + **PyTorch Geometric** (GraphSAGE) | Graph DB for on-chain relationship traversal; GNN for propagation weight learning trained on historical DeFi contagion events |
| Risk math | Pure Python + **numpy** | Kelly formula is simple math; no library needed |
| Risk (prod) | **QuantLib** + **PyPortfolioOpt** | VaR, correlation matrix, portfolio-level analytics |
| Crypto exchange | **ccxt** | Unified API for 100+ exchanges; Binance, Bybit, OKX same interface |
| Equity broker | **Alpaca Trading API** | Paper + live trading; free for US equities; WebSocket included |
| Price / vol data | **CoinGecko API** (MVP) / **Binance WS** (prod) | CoinGecko free tier sufficient for MVP regime polling; Binance WS for production latency |
| DeFi graph data | **DeFiLlama API** + **The Graph** (subgraphs) | Protocol TVL, pool composition, on-chain event indexing for Agent 3 |
| WebSocket client | **websockets** library | Binance WS connection |
| HTTP client | **httpx** | Async HTTP for REST polling (news, DeFiLlama, CoinGecko) |
| Inference device | CPU (MVP) / CUDA GPU (prod) | FinBERT on CPU: ~400ms per batch; GPU: ~40ms |

### Data Layer

| Component | Technology | Role |
|---|---|---|
| Live state | **Redis** | Sub-millisecond reads for regime, prices, portfolio |
| Persistent storage | **PostgreSQL** | Decision Receipts, strategies, portfolio history |
| Object storage | **AWS S3** (prod) | Model weights, historical tick data, archived receipts |
| Vector search | Postgres full-text (MVP) / **Weaviate** (prod) | Semantic search over Decision Receipts for Conversation Layer |

### Frontend

| Component | Technology | Role |
|---|---|---|
| App framework | **Next.js 14** (App Router) | Trading terminal, marketplace, builder pages |
| Price charts | **Lightweight Charts** (TradingView, free MIT) | Candlestick + indicator overlays |
| Strategy builder | **React Flow** | Visual drag-and-drop node canvas for strategy creation |
| Code editor | **Monaco Editor** | Python DSL editor for advanced strategy authors |
| Live feed | Native **WebSocket** → FastAPI endpoint | Real-time signal cards pushed to terminal |
| State management | **Zustand** | Lightweight client state for portfolio, regime badge |
| Styling | **Tailwind CSS** | Utility-first; dark mode built-in |

### Infrastructure

| Component | Technology | Role |
|---|---|---|
| Containerization | **Docker + Docker Compose** | Local dev: `docker-compose up` starts everything |
| Orchestration (prod) | **Kubernetes** | Agent scaling, health checks, rolling deploys |
| Reverse proxy | **Nginx** | Route `/api` to FastAPI, `/` to Next.js |
| Monitoring | **Prometheus + Grafana** | Agent latency, fill rates, drawdown dashboards |
| Secrets | **HashiCorp Vault** (prod) / `.env` (MVP) | API keys for Binance, Alpaca, Anthropic |
| CI/CD | **GitHub Actions** | Lint, test, Docker build on every push |

### Conversation Layer

| Component | Technology | Role |
|---|---|---|
| LLM | **Anthropic Claude API** (`claude-sonnet-4-6`) | Answer user questions about trade decisions |
| RAG store | Postgres full-text → top-10 receipts injected as context | Grounds Claude in actual receipt data; prevents hallucination |
| SDK | `anthropic` Python SDK | Direct API calls from FastAPI `/api/chat` endpoint |

---

## 9. End-to-End Example: Aave WBTC Shock

**Scenario:** On-chain monitor detects a new Aave emergency governance proposal — *"AIP-412: Pause WBTC borrowing markets due to custodian regulatory risk"*

**T+0s — Agent 1 (Data Ingestion)**
On-chain event watcher detects a new Aave governance transaction tagged as emergency. Simultaneously NewsAPI returns a CoinDesk article on the same event. Freshness score = 1.0 (just mined). CoinDesk reliability weight = 0.82. CQ score = 0.82 — high quality. The entity tagger identifies token = WBTC, protocol = Aave, event type = governance/risk. The normalized packet is pushed to the downstream queue.

**T+0.05s — Agent 2 (Signal) and Agent 3 (Graph) triggered simultaneously**

Agent 2 runs FinBERT on the headline: negative sentiment, confidence 0.79 — strong negative. The technical module reads WBTC's price buffer: RSI = 48 (slight downside), MACD histogram = -0.003 (negative). The current regime (from Redis) is `choppy` at 0.81 confidence — mean-reversion signals only, MACD deprioritized, Bollinger Band %B used instead (%B = 0.32, below midpoint, bearish in choppy). Both sentiment and technicals agree SHORT — signal vote: `direction=SHORT, confidence=0.68`.

Agent 3 simultaneously traverses the DeFi protocol dependency graph. WBTC's tier-1 connections: Aave WBTC collateral pool (weight -1.3), Curve BTC pools (weight -0.8), Compound WBTC market (weight -0.7), Badger DAO vaults (weight -0.5). Multiplied by negative sentiment (-0.79), impact scores: Aave WBTC pool → -0.72 (already trigger), Curve BTC pools → -0.63, Compound WBTC → -0.55, Badger DAO → -0.40. All three non-trigger tokens with |impact| > 0.20 are queued for the next cycle.

**T+0.05s — Agent 4 (Regime) — already running in background**
Current regime is `choppy`, classified 6 minutes ago, still valid. BTC 30d realized vol = 38% (elevated — above 35% threshold, will trigger size cut in Risk Agent). Average BTC+ETH perpetual funding rate = -0.008% (slightly negative — market leaning short). Same state re-broadcast to Redis. If funding rate turned sharply more negative during this cycle, the regime would be reassessed on the next 15-minute run.

**T+0.31s — Orchestrator receives both votes**
Signal vote: SHORT, confidence 0.68 ✓. Graph vote: SHORT propagation confirmed across 3 related protocols ✓. Regime is `choppy` — LONG trades would be blocked, SHORT is allowed. Routes to Risk Agent.

**T+0.32s — Agent 5 (Risk)**
Rule 1: not crisis → pass. Rule 2: daily drawdown = 0.6% → pass. Rule 3: confidence 0.68 > 0.60 → pass. Rule 4: SHORT in `choppy` → allowed. Rule 5: DeFi lending category weight = 11% < 20% → pass. Kelly: p=0.68, b=2.0, f\* = 0.43, quarter-Kelly = 0.1075 → 10.75%. BTC 30d vol = 38% (above 35%): × 0.5 = 5.375%. Regime = `choppy`: × 0.5 → 2.69%. Portfolio = $10,000 → position = $269 → 0.004 WBTC at $67,250/WBTC. Stop-loss for short = $67,250 × 1.02 = $68,595. **Approved.**

**T+0.35s — Orchestrator**
Both votes aligned (SHORT), risk approved. Consensus: EXECUTE. Decision Receipt written to Postgres: trigger = Aave WBTC governance shock, votes = SHORT × 2, risk = approved, size = 0.004 WBTC ($269), stop = $68,595, regime = `choppy`.

**T+0.36s — Agent 6 (Execution)**
Asset class: crypto → Binance via ccxt. Size $269 < $10K → single limit strategy. Fetches bid/ask: bid = $67,200, ask = $67,300. Places limit SELL (short) at $67,133 (bid × 0.999). Order submitted to Binance.

**T+1.8s — Fill confirmed**
Fill at $67,198 (5 cents slippage on 0.004 WBTC). Portfolio state updated in Redis. Fill appended to Decision Receipt in Postgres. WebSocket broadcasts: "SHORT WBTC — 0.004 @ $67,198".

**Next cycle — secondary propagation**
Curve BTC pools, Compound WBTC market, and Badger DAO are dequeued for independent analysis. Each goes through the full 6-agent pipeline. Risk Agent checks protocol category concentration before each — if the DeFi lending category would exceed 20% after adding a new position, it vetoes that specific trade.

**User asks in Conversation Layer:** *"Why did we short WBTC?"*

Claude reads the Decision Receipt from Postgres and responds:

> "We shorted WBTC because an emergency Aave governance proposal was detected on-chain to pause WBTC borrowing markets due to custodian regulatory risk. CoinDesk covered it simultaneously. FinBERT scored the event at -0.79 negative sentiment. Technical indicators confirmed downside: RSI at 48, MACD negative, and Bollinger Band %B at 0.32 in the active choppy regime. The market regime was choppy at 0.81 confidence with BTC 30-day realized vol at 38% — both conditions triggered size cuts, bringing the final position to 0.004 WBTC ($269) with a stop-loss at $68,595. The Graph Agent also flagged Curve BTC pools, Compound WBTC markets, and Badger DAO vaults for secondary analysis due to their direct collateral dependency on WBTC."

---

## Appendix: Required Environment Variables

| Variable | Purpose |
|---|---|
| `BINANCE_API_KEY` | Binance exchange access (crypto execution + funding rate stream) |
| `BINANCE_SECRET` | Binance secret key |
| `NEWS_API_KEY` | NewsAPI.org — free tier sufficient for MVP |
| `COINGECKO_API_KEY` | CoinGecko Pro — BTC/ETH price and volatility data for Agent 4 |
| `THE_GRAPH_API_KEY` | The Graph — DeFi protocol subgraph queries for Agent 3 |
| `DEFILLAMA_BASE_URL` | DeFiLlama API base URL (public, no key required for MVP) |
| `ANTHROPIC_API_KEY` | Claude API — Conversation Layer |
| `REDIS_URL` | Redis connection string |
| `DATABASE_URL` | Postgres connection string |
| `CRYPTO_TICKERS` | Comma-separated list of crypto pairs to monitor (e.g. BTCUSDT,WBTCUSDT) |
| `DEFI_PROTOCOLS` | Comma-separated list of DeFi protocol slugs to watch in Agent 3 graph (e.g. aave,compound,curve) |

---

*ATS Agent Execution Flow — Developer Reference*  
*For research and educational use only. Not financial advice.*
