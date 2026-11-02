# AGENTIC TRADING SYSTEM
## Complete Technical Documentation — v3.0

**6-Agent AI Architecture  |  Chain-Agnostic Template  |  Explainable Co-Pilot Platform**

| Document Type | Version | System Class | Last Updated |
|---|---|---|---|
| System Architecture & Design | v3.0 — Combined | Multi-Agent Trading AI | April 2026 |

> *CONFIDENTIAL — FOR RESEARCH AND EDUCATIONAL USE*

---

# CHAPTER 1 — PLATFORM VISION & PHILOSOPHY

## 1. Platform Vision

The Agentic Trading System is a fully autonomous, multi-agent artificial intelligence platform designed as an explainable co-pilot for intelligent market trading. Unlike conventional trading algorithms that rely on a single model or a fixed rule-set, this system deploys six specialized AI agents that continuously communicate, collaborate, and collectively make trading decisions based on a fusion of real-time market data, machine learning predictions, natural language sentiment analysis, causal reasoning, and dynamic risk management.

The core innovation is not the trading engine alone — it is making the entire pipeline legible to a human being in real time. Every decision the system makes is traceable to its source data, the agent that raised it, and the reasoning chain that validated it. A user can ask *"why did we buy Apple?"* and receive a forensic answer at any depth they choose.

The second core innovation is its **chain-agnostic architecture**. The entire platform is built as a reusable template where all trading logic, agent coordination, data pipelines, and decision-making infrastructure are pre-built and stable. When integration with any blockchain is needed — Ethereum for DeFi execution, Solana for high-speed settlement, or any future chain — only the chain-specific adapter layer changes. The core system remains untouched.

---

## 1.1 Core Design Principles

- No single model or agent ever makes a trade decision alone — all decisions require consensus across agents
- Every decision is explainable in plain English via the Conversation Layer at any depth the user requests
- Risk management has absolute veto power over all prediction signals in every mode
- The system knows the reason behind every action and can expand it to the user in full detail
- Human oversight is always available and is mandatory above certain capital thresholds
- Users choose how much control they hand to the agents — from full autonomy to research-only
- Sitting in cash is always a valid position — the system never forces trades
- Chain integration is modular — the trading core is blockchain-agnostic by design

---

## 1.2 What Makes This System Different

| Aspect | Conventional Trading AI | This System |
|---|---|---|
| Decision transparency | Black box — no explanation | Full Decision Receipt per trade at any depth |
| Agent architecture | Single model or fixed rules | 6 specialized agents with consensus voting |
| Regime awareness | One model for all conditions | Regime agent classifies market; agents adapt |
| Blockchain integration | Centralized execution only | HashKey Chain (EVM L2, chainId 177/133) via chain registry |
| Agent memory | Session-only or centralized DB | Persistent 0G Storage — KV state + Log history |
| AI inference | Centralized API (OpenAI/Anthropic) | 0G Compute — decentralized, ZK-verifiable inference |
| High-volume data | Off-chain or plain DB | 0G DA — on-chain availability commitments |
| User control | All or nothing | Three modes: Autonomous, Assisted, Solo |
| Strategy ecosystem | Fixed internal strategies | Built-in library + open marketplace + custom builder |
| Risk enforcement | Softcoded guidelines | Hard rules with absolute veto — cannot be overridden |
| Learning | Periodic full retrain | Rolling decay detection + targeted agent retraining |

---

# CHAPTER 2 — PLATFORM ARCHITECTURE

## 2.1 Three-Layer System

The platform is organized as three layers that always coexist and run simultaneously regardless of which trading mode the user selects.

### Layer 1 — The Engine
All data pipelines, ML models, risk management, and execution logic. This layer runs invisibly. Every single decision the engine makes is logged with full provenance — which agent said what, at what confidence, citing which data source, under which market regime, with what causal validation.

### Layer 2 — The Conversation Interface
Where the user lives. Reads Layer 1's decision log and presents it conversationally. Users ask questions in plain English and receive answers backed by the full pipeline. This is the primary product differentiator — any decision, at any depth, in any mode.

### Layer 3 — The Chain Adapter
The blockchain execution interface. Completely swappable per chain without touching Layers 1 or 2. Handles: wallet management, transaction signing, on-chain order routing, smart contract interaction, and Decision Receipt minting as verifiable on-chain records.

---

## 2.2 Three Trading Modes

All three modes share identical infrastructure — the strategy library, marketplace, data pipeline, and all 6 agents are available regardless of mode.

| Mode | What the Agents Do | What the User Does |
|---|---|---|
| **Autonomous** | Trade on behalf of user. Select strategies from library and marketplace. Full 6-agent pipeline runs on every signal. | Deposit capital. Ask the Conversation Layer why decisions were made. Set parameters and limits. |
| **Assisted** | Provide live research dossier per ticker. Run analysis on any strategy the user selects. Confirm risk sizing before execution. | Make own trading decisions. Choose own strategy. Execute manually. |
| **Solo** | Research-only. Agents answer questions, analyse setups, run reports. No agent votes on execution. No autonomous signals. | Trade completely independently. Full agent pipeline available for research on demand. |

> **Solo Mode Note:** In Solo mode the Orchestrator does not receive user trade signals and agent risk limits do not apply to execution. However every executed trade still writes a minimal audit receipt (ticker, direction, size, timestamp) so the Memory module can track performance over time. Users can later ask: *"How has my solo trading performed vs the periods where I used agents?"* — and receive a real, data-backed answer.

---

## 2.3 Chain-Agnostic Template Architecture

The entire system is built as a deployable template. All agent logic, data pipelines, decision receipts, and risk rules are chain-independent. When a specific blockchain is needed, only the Chain Adapter (Layer 3) is implemented.

| Component | Chain-Agnostic? | Notes |
|---|---|---|
| Agent coordination (Kafka bus) | ✅ Yes | Identical regardless of chain |
| ML models and signal generation | ✅ Yes | Identical regardless of chain |
| Risk management rules | ✅ Yes | Identical regardless of chain |
| Decision Receipt structure | ✅ Yes | Format is chain-agnostic; storage differs per chain |
| Strategy library and marketplace | ✅ Yes | Identical regardless of chain |
| Conversation Layer | ✅ Yes | Identical regardless of chain |
| Wallet management | ❌ Chain-specific | ERC-4337 for Ethereum; Keypair for Solana |
| Transaction signing | ❌ Chain-specific | ethers.js / @solana/web3.js / etc. |
| On-chain order routing | ❌ Chain-specific | Uniswap / GMX / dYdX / Raydium / etc. |
| Receipt minting | ❌ Chain-specific | ERC-721 on Ethereum; Metaplex on Solana |

### How to Add a New Chain

1. Implement the Chain Adapter interface — four functions: `connectWallet()`, `signTransaction()`, `routeOrder()`, `mintReceipt()`
2. Configure RPC endpoints and contract addresses in `lib/chain-registry/chains/<chain>.ts`
3. Register it in `lib/chain-registry/index.ts` and update `DEFAULT_CHAIN_ID`
4. Deploy — all agent logic, risk rules, and UI remain completely unchanged

> **Current chain: HashKey Chain (chainId 177 mainnet / 133 Sepolia testnet)**
> Config: `lib/chain-registry/chains/hashkey.ts` | 0G AI/data SDK wrappers: `lib/zerog/`

---

## 2.4 Chain + 0G Protocol Integration — Where Each Component Is Used

The ATS trades on **HashKey Chain** (Layer 3) and uses 0G's three AI/data primitives (Storage, Compute, DA) as external infrastructure. Each maps directly to a layer of the system.

### HashKey Chain — Layer 3 (Chain Adapter)
**File:** `lib/chain-registry/chains/hashkey.ts`, `lib/agent-builder/evm-provider.ts`

HashKey Chain is the EVM-compatible L2 execution layer where all on-chain actions happen.

| System action | How HashKey Chain is used |
|---|---|
| Agent 6 executes a swap | Signs and submits transaction to a HashKey Chain DEX router (HSKSwap) |
| Decision Receipt minting | Mints receipt as on-chain record (ERC-721 or native contract) |
| Wallet connection | MetaMask connects to chainId 177/133 via `wallet_addEthereumChain` |
| Explorer links | All tx/address links resolve to `hashkey.blockscout.com` |

---

### 0G Storage — Persistent Agent Memory (KV + Log)
**File:** `lib/zerog/storage.ts` | **Import:** `import { saveAgentMemory, loadAgentMemory, appendLog } from '@/lib/zerog'`

0G Storage gives agents persistent memory that survives restarts and survives across devices. Two use patterns:

| Pattern | Function | What is stored | Which agent |
|---|---|---|---|
| **KV — real-time state** | `saveAgentMemory()` / `loadAgentMemory()` | Current regime, open positions, risk params, last signal | All 6 agents |
| **Log — append history** | `appendLog()` | Full conversation history, every Decision Receipt, every trade audit line | Conversation Layer, Orchestrator |

**Decision Receipt persistence** — instead of writing receipts only to Postgres, each receipt is also uploaded to 0G Storage. The root hash is stored on-chain so any observer can retrieve the full receipt without trusting the platform.

```typescript
// Orchestrator writes a receipt after every trade decision
const { rootHash } = await saveAgentMemory('receipt', decisionReceipt)
// rootHash stored in Postgres AND in the on-chain contract for verifiability
```

---

### 0G Compute — Decentralized AI Inference
**File:** `lib/zerog/compute.ts` | **Import:** `import { computeInference, agentReason, streamComputeInference } from '@/lib/zerog'`

0G Compute replaces centralized LLM APIs with verifiable decentralized inference. Models run on the 0G Compute network; sealed inference adds a ZK proof that the model ran correctly.

| System component | Model used | Sealed? | What the call does |
|---|---|---|---|
| **Conversation Layer** | `qwen3-8b` | No | Generates plain-English explanations of Decision Receipts |
| **Copilot tile (streaming)** | `qwen3-8b` | No | Streams live agent analysis to the terminal copilot tile |
| **Signal Agent — causal validation** | `qwen3.6-plus` | **Yes** | Verifies a causal chain still holds before approving a signal |
| **Risk Agent — decision gate** | `GLM-5-FP8` | **Yes** | Final pre-trade sanity check on high-value orders (> $50K) |
| **Agent Builder — node reasoning** | `qwen3-8b` | No | Powers `ZeroGComputeNode` in the visual DAG builder |

`sealed: true` is mandatory for any inference call that directly influences an on-chain transaction. The ZK proof (`proofRef`) is embedded in the Decision Receipt.

```typescript
// Risk Agent — sealed inference before approving high-value trade
const { content, proofRef } = await computeInference({
  model: 'qwen3.6-plus',
  messages: [{ role: 'user', content: `Approve this trade? ${JSON.stringify(riskPayload)}` }],
  sealed: true,
})
// proofRef → stored in Decision Receipt so anyone can verify the AI approved this
```

---

### 0G DA — Data Availability for High-Volume Output
**File:** `lib/zerog/da.ts` | **Import:** `import { postSwarmMessage, postInferenceResult, submitToDA } from '@/lib/zerog'`

0G DA handles data that is too large or too frequent for on-chain storage but needs a verifiable availability proof.

| Use case | Function | Volume | What the commitment proves |
|---|---|---|---|
| **Multi-agent swarm coordination** | `postSwarmMessage()` | Every inter-agent vote (~380ms cadence) | Planner → Executor messages are available to any auditor |
| **Large inference outputs** | `postInferenceResult()` | Every `sealed: true` call result | Full LLM output is available off-chain at this commitment |
| **Market data attestation** | `submitToDA()` | Batch tick data every 15 min | Raw price data used for a trade decision is permanently available |
| **Agent log bulk export** | `submitToDA()` | On demand (weekly export) | Full agent activity log from 0G Storage can be bulk-verified |

```typescript
// Orchestrator posts the full vote tally to 0G DA after every decision
const { commitment } = await postSwarmMessage({
  from:   'orchestrator',
  votes:  agentVotes,        // all 6 agent votes with confidence scores
  regime: currentRegime,
  result: 'EXECUTE',
})
// commitment → stored in Decision Receipt as proof the full vote is available
```

---

# CHAPTER 3 — CONVERSATION LAYER & DECISION RECEIPT

## 3.1 The Decision Receipt

Every trade decision generates a Decision Receipt — a structured, immutable object capturing full provenance of why the trade was made. This receipt is stored permanently and never mutated. The Conversation Layer reads receipts; it never guesses.

```
DECISION RECEIPT STRUCTURE
─────────────────────────────────────────────────────────────────
TRIGGER:       Event that initiated analysis (news, price tick, filing alert)
SOURCE:        Data source + reliability weight (e.g. Bloomberg 0.93)
AGENT VOTES:   Each agent's signal direction + confidence score
REGIME:        Market regime at time of decision (one of 6 states)
CAUSAL CHAIN:  ID of validated causal relationship + active status
RISK SIZING:   Kelly fraction, position size, stop-loss, max loss $/%
CONSENSUS:     Final Orchestrator decision + full vote tally
OUTCOME:       Actual P&L and deviation from prediction (post-close)

0G Storage fields (appended when stored on-chain):
  storage_root_hash:   Content-addressed hash of the full receipt on 0G Storage
  vote_da_commitment:  0G DA commitment of the full agent vote tally
  inference_proof_ref: ZK proof reference from 0G Compute sealed inference (if used)

On-chain variant: Receipt minted as on-chain record with storage_root_hash
                  so any observer can retrieve and verify the full receipt
```

---

## 3.2 Conversation Depth Levels

| Depth | User Question | What the User Receives |
|---|---|---|
| **Depth 1 — What happened** | Why did we buy Apple? | "We bought Apple because Bloomberg reported Vision Pro sales beat estimates by 23%. All six agents agreed. Risk approved a 2.1% position." |
| **Depth 2 — Why each agent voted** | What did the Signal Agent see? | "FinBERT scored the article +0.73 with sarcasm probability 0.02. Velocity spike of +0.34 in 6 minutes. Technical Agent confirmed RSI at 58 with volume 2.3x average." |
| **Depth 3 — Counterfactuals** | Would we have traded without that news? | "Without the Bloomberg signal, sentiment confidence would have been 0.61 — below threshold. The trade would not have fired." |
| **Depth 4 — Portfolio impact** | What is our maximum loss? | "Maximum loss on this position is $420, representing 0.42% of portfolio. Current VaR headroom is 61%." |

---

## 3.3 User Profiles — Same Platform, Different Experience

| User Type | Mode | Daily Experience |
|---|---|---|
| Inexperienced investor | Autonomous | Deposits capital. Agents trade on their behalf. Every morning receives a plain-English brief. Asks follow-up questions in chat. Never touches a trade directly. |
| Intermediate trader | Assisted | Uses agents as a research desk. Full dossier prepared before any trade: sentiment vector, regime, causal chain, risk sizing, ML breakdown. Makes own decisions. |
| Experienced quant | Solo | Builds custom strategies via Python DSL or visual builder. Uses agents for on-demand research and backtesting. Retains full execution authority. |

---

# CHAPTER 4 — STRATEGY & INDICATOR ECOSYSTEM

## 4.1 Three Strategy Sources

| Source | Description | Available To |
|---|---|---|
| **Prebuilt Library** | Curated and validated strategies maintained by the platform. Backtested, regime-aware, safe for agent use. | All users and all agents |
| **Marketplace** | Community-created strategies. Private by default — published by choice. Live tracked performance from real agent use. Alpha Contribution Score per strategy. | All users. Agents in Autonomous mode (user-configurable). |
| **Personal Strategies** | User-built via visual builder or Python DSL. Private or published to marketplace. Includes access to live agent data streams. | Owner only (private) or all users once published. |

---

## 4.2 Strategy Builder — Two Creation Paths

### Visual Builder
Drag-and-drop interface for any skill level. Indicator blocks (RSI, MACD, EMA, Bollinger, ATR, Volume) combined with condition blocks (AND/OR, thresholds) and filter blocks (Regime gate, Sentiment filter). Exposes live agent data directly to visual strategies:

- `sentiment.score(ticker)` — live FinBERT score from the Signal Agent
- `regime.current()` — live regime classification from the Regime Agent
- `graph.impact(ticker)` — live relationship propagation score from the Graph Agent
- `institutional.flow(ticker)` — live dark pool and options sweep signals

### Code Editor (Advanced Path)
Python-based DSL for users who want full control. Strategies define a `compute_indicators()` function and a `signal()` function. Same live agent data available as importable platform modules. Syntax validation runs on save. Passing strategies can be backtested immediately.

---

## 4.3 Alpha Contribution Score

For every trade where a marketplace strategy participated, the system records what the outcome would have been without the strategy signal. Over 60+ live trades this produces a verified **net contribution number**. Strategies with consistently positive contribution earn a verified badge.

Marketplace listings show:
- Win rate, Sharpe ratio, maximum drawdown — from live agent trading, not simulation
- Number of trades executed by agents using this strategy
- Alpha Contribution Score vs the agent baseline
- Regime performance breakdown — performance in each of the 6 market regimes

> Backtests are shown separately and clearly labeled as historical simulation. The Alpha Contribution Score is always based on real agent trades.

---

# CHAPTER 5 — THE SIX AGENTS

## 5.0 Orchestrator — The Coordination Protocol

The Orchestrator is a coordination layer — not a separate agent — that collects votes, resolves conflicts, and writes the Decision Receipt.

| Vote Count | Outcome | Position Size |
|---|---|---|
| 6 of 6 agents agree | Strong signal — execute | Full calculated size |
| 5 of 6 agents agree | Normal signal — execute | Standard calculated size |
| 4 of 6 agents agree | Weak signal — execute cautiously | Reduced by 40% |
| 3 of 6 or fewer | No trade — signal logged | Zero — no entry |
| Risk Agent vetoes | Hard block | Zero — regardless of other votes |
| Regime Agent: Crisis | Full halt | Zero — all new entries blocked |

---

## 5.1 Agent 1 — Data Ingestion Agent
**The Eyes and Ears — 24/7 World Monitor**

**Inputs:** Exchange price feeds, news APIs (Reuters/Bloomberg), social media (Reddit/Twitter), SEC EDGAR alerts, options chain and dark pool feeds, macroeconomic data releases

**Outputs:** Normalized data packets with quality scores, freshness and reliability tags, anomaly alerts, entity-tagged text for downstream agents

**Key Behaviors:**
- Runs six parallel sub-agents internally: Price Feed, News Crawler, Social Media, SEC Watcher, Options & Dark Pool, Macro Data — all feeding into a single normalized output stream
- Assigns two scores to every data packet: **Freshness Score** `(FS = 1 - age/max_expected_age)` and **Reliability Weight** (pre-assigned per source, updated quarterly)
- **Combined Quality:** `CQ = Freshness × Reliability Weight` — applied when data enters any downstream model
- Detects data feed failures within 100ms and switches to backup sources automatically
- Pre-tags entities in text data (company names, ticker symbols) using a fast lookup index
- Detects coordinated information attacks: floods of near-identical social media posts trigger a manipulation flag before sentiment scoring begins

---

## 5.2 Agent 2 — Signal Agent
**The Brain — Sentiment + Technical + ML Combined**

**Inputs:** Normalized data from Data Agent, current regime from Regime Agent, relationship impact scores from Graph Agent, historical price data (rolling 5-year window), options chain data

**Outputs:** 8-dimensional sentiment vector per ticker, 50+ computed technical indicators, ML ensemble prediction with probability, uncertainty band, institutional flow detection alerts, combined trade signal with confidence score

### Sentiment Module
- Runs domain-adapted FinBERT on all incoming text
- Applies dual-head sarcasm correction: `s_final = (1-2λ) × s_raw` where λ is sarcasm probability from a secondary classifier
- Produces the 8-dimensional feature vector: `[St, ΔSt, σS,t, Nt, Dt, St-1, St-2, St-3]`
- Source weights: Bloomberg 0.93 > Reuters 0.91 > Analyst reports 0.80 > Reddit 0.55 > Twitter 0.50
- Maintains 7-day rolling sentiment baseline per ticker; detects sentiment divergence (price rising, sentiment falling = reversal signal)

### Technical Module
- Computes 50+ indicators across trend (SMA 20/50/200, EMA, MACD, ADX), momentum (RSI, Stochastic, CCI, Williams %R), volatility (Bollinger Bands, ATR, Keltner Channels), and volume (OBV, VWAP, MFI, CMF)
- Uses a trained CNN to detect classical chart patterns (Head & Shoulders, Double Top/Bottom, Flags, Wedges, Cup & Handle)
- Adjusts indicator trust based on regime — in trending markets trusts MACD/EMA; in choppy markets trusts RSI/Bollinger mean-reversion

### ML Module
- Runs six models in parallel: SARIMA (linear trend), XGBoost (non-linear + sentiment), Temporal Fusion Transformer (long-range multivariate), BiLSTM+Attention (sequence memory), Graph Neural Network (relationship propagation), Bayesian Neural Network (uncertainty quantification)
- A meta-learner XGBoost dynamically weights each model based on current regime
- Minimum prediction confidence threshold: **0.58 directional probability** — below this, no signal is published
- Feature vector extends from ~25 base price features to ~38 features after adding sentiment vector and relationship impact scores

### Institutional Flow Module
- Detects large player entries via dark pool prints (single print > 0.5% of ADV), options sweeps (large premium above ask), volume delta spikes (>2M aggressive imbalance in 5 minutes), and order book absorption patterns
- Publishes `institutional_flow_direction` signal with confidence score

### Causal Reasoning Module
- Maintains a library of 200+ known financial causal chains
- Before approving any signal, verifies the causal premise is still currently active
- Runs a counterfactual test: *"If we removed this signal, would the prediction still hold?"*
- Rejects signals where the causal mechanism has been structurally broken
- This module alone prevents an estimated 15–25% of false trades per week

---

## 5.3 Agent 3 — Graph & Relationship Agent
**The Network Analyst — Inter-Company Intelligence**

**Inputs:** SEC 13F/8-K filings, Bloomberg SPLC supply chain data, BoardEx board member overlaps, entity mentions from Data Agent

**Outputs:** Impact propagation scores for related tickers, supply chain contagion alerts (Tier 1 and Tier 2), ownership change alerts, knowledge graph updates, relationship impact scores for the Signal Agent's ML module

**Key Behaviors:**
- Maintains a live knowledge graph: nodes are Companies, Funds, Executives; typed edges represent: `supplies`, `owns`, `competes_with`, `acquired`, `board_member`, `customer_of`
- When a news event hits a company node, traverses the graph to identify and score all first-degree and second-degree connected companies within milliseconds

> **Example:** TSMC chip shortage arrives at T+0ms. By T+90ms the Graph Agent has scored: AAPL (-1.2%), NVIDIA (-0.8%), AMD (-0.6%), Qualcomm (-0.5%), Skyworks (-0.4%) — before most market participants have read the headline.

- Tier 1 impact (direct customer/supplier) = full propagation weight; Tier 2 = 40–60%; Tier 3 = 15–25%
- Uses GraphSAGE (Graph Neural Network) to learn which types of relationships produce the strongest price propagation
- Full graph rebuild runs nightly to incorporate all new regulatory filings from the prior day

---

## 5.4 Agent 4 — Regime Detection Agent
**The Weatherman — Market Environment Classifier**

**Inputs:** OHLCV price data, VIX index and term structure (VIX3M/VIX), yield curve data (10Y-2Y spread), credit spreads (HYG vs LQD), Advance/Decline ratio, sentiment aggregates from Signal Agent

**Outputs:** Current regime classification (1 of 6 states), regime confidence score (0–1), early transition warnings, behavior modification flags for all agents

**The 6 Regimes:**

| Regime | State | Agent Behavior |
|---|---|---|
| 1 | Low-vol Bull Trend | Aggressive trend-following; full position sizes |
| 2 | High-vol Bull Trend | Cautious trend-following; reduced sizes |
| 3 | Sideways / Choppy | Mean-reversion only; no trend signals |
| 4 | Low-vol Bear Trend | Short bias; protective positioning |
| 5 | High-vol Bear Trend | Defensive; mostly cash; minimal exposure |
| 6 | Crisis / Black Swan | **HALT all trading; alert human immediately** |

**Key Behaviors:**
- Uses a Hidden Markov Model with 6 hidden states
- Broadcasts current regime to **ALL other agents continuously** — this is the most important broadcast in the entire system
- Detects regime transitions 4–8 hours ahead of full confirmation using leading indicators (VIX term structure inversion, credit spread widening, breadth deterioration)
- Updates classification every 15 minutes; sends urgent alert if confidence drops below 0.60

---

## 5.5 Agent 5 — Risk Management Agent
**The Gatekeeper — Absolute Veto Authority**

**Inputs:** Approved signals from Signal Agent and Graph Agent, current portfolio state, VaR calculations and drawdown metrics, regime classification, correlation matrix of all held positions

**Outputs:** Position size (shares or contracts), stop-loss price level (ATR-based), take-profit level, final approved or rejected signal, portfolio-level risk metrics report

### Kelly Criterion Position Sizing
```
f* = (edge / odds) × kelly_fraction

edge           = expected return per trade
odds           = reward-to-risk ratio of the specific setup
kelly_fraction = 0.25  (quarter-Kelly for conservatism)

Example: 62% win probability, 2:1 target, 1:1 stop
f* = ((0.62 × 2) - (0.38 × 1)) / 2  ×  0.25  =  10.8% of available capital
```

### Hard Risk Rules — Cannot Be Overridden

| Rule | Limit | Consequence |
|---|---|---|
| Max risk per trade | 2% of total portfolio | Trade rejected; recalculated |
| Max sector concentration | 20% in any sector | Trade rejected until weight reduced |
| Max single position | 8% of portfolio | Order split or reduced |
| Daily drawdown circuit breaker | 5% in one day | All new entries halted; human alert |
| VaR daily limit | 2% at 99% confidence | Trade rejected if breach would occur |
| Liquidity filter | Order < 1% of avg daily volume | Trade rejected to prevent market impact |
| Correlation limit | > 0.85 between two positions | Treated as single position for sizing |
| VIX adjustment | VIX > 25: all sizes × 0.5 | Automatic — no override permitted |
| Overnight gap risk | Overnight positions reduced 50% | Applied automatically at close |
| Crisis mode | Regime Agent flags Crisis | All new trades blocked |

### Stop-Loss Management
- Every trade has a stop-loss set before entry — no exceptions
- Stops calculated at ATR × 1.5 to avoid noise-triggered exits
- Trailing stop activates once profitable: trails at ATR × 2.0 below current high
- Time-based stop: exit if thesis has not played out within expected horizon × 2

---

## 5.6 Agent 6 — Execution Agent
**The Hands — Smart Order Routing & Fill Optimization**

**Inputs:** Approved and sized orders from Risk Agent, real-time Level 2 order book, exchange latency and fill quality metrics, dark pool availability, Chain Adapter interface (per-chain)

**Outputs:** Executed orders with fill prices and timestamps, slippage reports vs theoretical entry, adverse selection alerts, fill quality scores, on-chain transaction receipts (in chain mode)

**Key Behaviors:**
- Never uses market orders — always limit orders with adaptive pricing based on current bid-ask spread

| Order Size | Execution Strategy |
|---|---|
| Small (< $10K) | Single limit order with 30-second timeout |
| Medium ($10K–$100K) | TWAP execution split over 5–15 minutes |
| Large (> $100K) | VWAP execution + dark pool routing |

- **Adverse selection detection:** if an order fills significantly faster than expected given current liquidity, pauses execution and alerts the Orchestrator
- **Smart routing:** routes every order to the venue with the best historical fill rate for that specific ticker at the current time of day
- **In chain mode:** interfaces with the Chain Adapter to sign transactions, interact with DeFi protocols, and mint the Decision Receipt as an on-chain NFT
- Records actual fill price vs theoretical entry, computes slippage, and feeds results back to the Signal Agent's memory module for ongoing cost modeling

---

# CHAPTER 6 — DATA SOURCES & INGESTION

## 6.1 Price & Market Microstructure Data
- Tick-level OHLCV at millisecond precision from exchange feeds
- Level 2 order book data — bid-ask depth at 10 price levels, updated in real time
- Trade-by-trade prints with timestamps for volume delta computation
- VWAP and TWAP reference prices for execution benchmarking
- Options chain data — implied volatility surface, put/call ratio, gamma exposure (GEX)
- Dark pool print alerts — large off-exchange block trades reported within 10 seconds

## 6.2 News & Text Sources

| Source | Data Type | Reliability Weight |
|---|---|---|
| SEC EDGAR (8-K, 13F, 10-K, Form 4) | Regulatory filings — on filing | 0.97 |
| Bloomberg | Financial news and analysis — real-time | 0.93 |
| Reuters | Financial news wire — real-time | 0.91 |
| PR Newswire | Company press releases — real-time | 0.85 |
| Seeking Alpha | Earnings call transcripts — post-earnings | 0.80 |
| Reddit (WSB, Investing) | Retail sentiment — real-time | 0.55 |
| Twitter/X | Market commentary — real-time | 0.50 |
| Telegram channels | Crypto and stock alerts — real-time | 0.40 |

## 6.3 Fundamental & Regulatory Data
- Quarterly earnings reports: EPS, revenue, profit margins, and forward guidance
- SEC Form 13F — institutional holdings (quarterly, 45-day lag)
- SEC Form SC 13D/G — ownership stake changes above 5% (filed within 10 days)
- SEC Form 4 — insider buying and selling transactions (filed within 2 business days)
- Bloomberg SPLC — supply chain relationship database
- Refinitiv and PitchBook — M&A deal announcements and completions
- BoardEx — board member overlaps and director networks

## 6.4 Macroeconomic Data
- Federal Reserve interest rate decisions and FOMC meeting minutes
- Consumer Price Index (CPI) and Producer Price Index (PPI) releases
- US GDP growth rate, unemployment claims, non-farm payrolls
- 10-year and 2-year Treasury yield spread — yield curve shape
- VIX index and VIX term structure (VIX3M vs VIX ratio)
- Credit spreads: HYG vs LQD (high yield vs investment grade)
- DXY Dollar Index and major currency exchange rates
- Federal Funds Futures — market-implied rate expectations

## 6.5 Alternative Data
- Satellite imagery — retail parking lot occupancy, oil tank levels, shipping activity
- Credit card transaction data — consumer spending patterns by company and sector
- Mobile app download trends — Sensor Tower and App Annie
- Web traffic and search trends — SimilarWeb, Google Trends
- Job posting trends — LinkedIn and Indeed (rapid hiring = growth signal)

## 6.6 Data Quality Framework

| Score | Definition | Formula |
|---|---|---|
| Freshness Score (FS) | How recent vs expected update cycle | `FS = 1 - (age / max_expected_age)` — decays to 0 |
| Reliability Weight (RW) | Historical accuracy of this source | Pre-assigned; updated quarterly |
| Combined Quality (CQ) | Final weight applied in any model | `CQ = Freshness Score × Reliability Weight` |

---

# CHAPTER 7 — DECISION-MAKING FRAMEWORK

## 7.1 Real-Time Data vs ML Predictions

| Situation | Primary Driver | Secondary | Reason |
|---|---|---|---|
| Breaking news event | Real-time (Sentiment + Graph) | ML models update | Speed is critical — process before market reacts |
| Normal trading hours | ML predictions dominate | Technical signals confirm | Pattern-based signals most reliable in steady state |
| Regime shift detected | Regime Agent overrides all | All agents adjust | Wrong-regime trading = #1 cause of systematic losses |
| Conflicting signals | Risk Agent reduces or blocks | Orchestrator no-trade | Uncertainty itself is information — do nothing |
| Large player detected | Institutional flow leads | ML and sentiment confirm | Large player entries carry elevated information advantage |
| Post-crisis recovery | Macro + ML recalibration | Sentiment confirms | Pre-crisis models may be unreliable |

## 7.2 Trade Decision Timeline — Normal Signal

| Time | Agent | Action |
|---|---|---|
| T + 0 ms | Data Ingestion Agent | Price tick or news headline arrives, normalized, entity-tagged, quality-scored |
| T + 5 ms | Signal Agent (Technical) | All 50+ indicators updated |
| T + 50 ms | Signal Agent (ML) | New prediction generated with updated feature vector |
| T + 80 ms | Signal Agent (Sentiment) | News scored by FinBERT with sarcasm correction |
| T + 90 ms | Graph Agent | Impact propagated to all connected tickers |
| T + 150 ms | Regime Agent | Regime confirmed or transition warning issued |
| T + 200 ms | Signal Agent (ML) | Signal updated with new sentiment and relationship scores |
| T + 280 ms | Signal Agent (Causal) | Causal chain validation performed |
| T + 320 ms | Risk Management Agent | Position size calculated, all hard limits checked |
| T + 380 ms | Orchestrator | All 6 votes collected, decision made, receipt written |
| T + 450 ms | Execution Agent | Order placed with optimal routing |

## 7.3 Trade Decision Timeline — News-Driven Signal

| Time | Agent | Action |
|---|---|---|
| T + 0 ms | Data Agent | News headline hits wire and is ingested |
| T + 10 ms | Data Agent | Entity tagging identifies affected tickers |
| T + 80 ms | Signal Agent (Sentiment) | FinBERT scores article with sarcasm correction |
| T + 90 ms | Graph Agent | All Tier 1 and Tier 2 affected companies scored |
| T + 150 ms | Regime Agent | Checks whether news changes regime classification |
| T + 200 ms | Signal Agent (ML) | Prediction recalculated with full updated feature set |
| T + 280 ms | Signal Agent (Causal) | Causal chain between news event and price outcome validated |
| T + 320 ms | Risk Agent | Position size calculated for each affected ticker |
| T + 380 ms | Orchestrator | Votes collected, receipts written for all triggered signals |
| T + 440 ms | Execution Agent | Orders placed for all approved positions simultaneously |

---

# CHAPTER 8 — RISK MANAGEMENT FRAMEWORK

## 8.1 Kelly Criterion Position Sizing

```
f* = (edge / odds) × kelly_fraction

kelly_fraction = 0.25  (quarter-Kelly for conservatism)

Example: 62% win probability, 2:1 target, 1:1 stop
f* = ((0.62 × 2) - (0.38 × 1)) / 2  ×  0.25  =  10.8% of available capital

The binding constraint — Kelly or hard rule — always wins.
```

## 8.2 Hard Risk Rules

| Rule | Limit | Consequence of Breach |
|---|---|---|
| Max risk per trade | 2% of total portfolio | Trade rejected; position recalculated |
| Max sector concentration | 20% in any sector | Trade rejected until weight reduced |
| Max single position | 8% of portfolio | Order split or reduced to comply |
| Daily drawdown circuit breaker | 5% in one calendar day | All entries halted; human alert sent |
| VaR daily limit | 2% at 99% confidence | Trade rejected if breach would occur |
| Liquidity filter | Order < 1% of avg daily volume | Trade rejected to prevent market impact |
| Correlation limit | > 0.85 between two positions | Treated as single position for sizing |
| VIX adjustment | VIX > 25: all sizes × 0.5 | Automatic — no override permitted |
| Overnight gap risk | Overnight positions reduced 50% | Applied automatically at market close |
| Crisis mode | Regime Agent flags Crisis | All new trades blocked |

## 8.3 Stop-Loss Management
- Every trade has a stop-loss set **before** entry — no exceptions
- Stops calculated at ATR × 1.5 to avoid noise-triggered exits
- Trailing stop activates once profitable: trails at ATR × 2.0 below current high
- Time-based stop: exit if thesis has not played out within expected horizon × 2
- Overnight positions reduced by 50% to account for gap risk at next open

---

# CHAPTER 9 — TECHNOLOGY STACK

## 9.1 Infrastructure

| Category | Technology | Purpose |
|---|---|---|
| Message Bus | Apache Kafka | Real-time inter-agent communication and event streaming |
| Cache & State Store | Redis | Shared knowledge store and low-latency state access |
| Time-Series DB | Arctic (Man Group) | High-performance OHLCV and indicator data storage |
| Graph Database | Neo4j | Knowledge graph for inter-company relationships |
| Relational Database | PostgreSQL | Trade records, audit logs, Decision Receipts, strategy registry |
| Workflow Orchestration | Apache Airflow | Scheduled retraining and data pipeline management |
| Monitoring | Grafana + Prometheus | Real-time system health and agent performance dashboards |
| Container Orchestration | Kubernetes | Agent deployment, scaling, and fault recovery |
| Secrets Management | HashiCorp Vault | API keys, credentials, and encryption key management |

## 9.2 Machine Learning Stack

| Model / Library | Technology | Used By |
|---|---|---|
| SARIMA | statsmodels (Python) | Signal Agent — linear trend and seasonality |
| XGBoost + SHAP | XGBoost library | Signal Agent — non-linear features + meta-learner |
| Temporal Fusion Transformer | PyTorch Forecasting | Signal Agent — long-range multivariate forecasting |
| BiLSTM + Attention | PyTorch | Signal Agent — sequence memory |
| GraphSAGE / GNN | PyTorch Geometric | Signal Agent + Graph Agent |
| Bayesian Neural Network | Pyro (Uber) | Signal Agent — uncertainty quantification |
| Reinforcement Learning (PPO) | RLlib (Ray) | Signal Agent — adaptive strategy subagent |
| FinBERT | HuggingFace Transformers | Signal Agent — sentiment classification |
| Sarcasm Detector | Custom fine-tuned BERT | Signal Agent — sarcasm correction |
| Hidden Markov Model | hmmlearn | Regime Detection Agent |
| Causal Discovery | DoWhy + CausalNex | Signal Agent — causal chain validation |
| LLM (Conversation) | **0G Compute** (qwen3-8b) *primary* / Claude API / GPT-4 API *fallback* | Conversation Layer |
| Sealed Inference (ZK) | **0G Compute** (qwen3.6-plus, GLM-5-FP8) | Signal Agent causal gate, Risk Agent pre-trade gate |

## 9.3 Execution & Data Feed Stack

| Component | Technology | Notes |
|---|---|---|
| Primary Broker API | Interactive Brokers (IBKR) | All asset classes; low-latency; supports FIX |
| Market Data Feed | Polygon.io / Refinitiv Elektron | Tick-level OHLCV and Level 2 order book |
| News Feed | Bloomberg API / Reuters TR | Real-time news with entity tagging |
| Order Protocol | FIX Protocol 4.4 | Industry standard for institutional routing |
| Dark Pool Access | IEX Exchange + BATS | Large order execution without signaling |
| Options Data | OPRA Feed via IBKR | Real-time options chain and IV surface |

## 9.4 Chain Adapter Stack

| Chain | Wallet Library | Execution Protocol | Receipt Format |
|---|---|---|---|
| **0G Newton Testnet** *(default)* | viem + wagmi v2 + RainbowKit | 0G DEX (UniswapV2-compatible) | On-chain contract + 0G Storage root hash |
| Ethereum / Base / Arbitrum | ethers.js + ERC-4337 | Uniswap v3, GMX, dYdX | ERC-721 NFT |
| Solana | @solana/web3.js + Keypair | Raydium, Jupiter, Drift | Metaplex NFT |
| Any future chain | Chain-native SDK | Chain-native DEX | Chain-native NFT standard |

**0G-specific adapter details:**
- Chain config: `lib/chain-registry/chains/zerog.ts` (chainId 16600, RPC `evmrpc-testnet.0g.ai`)
- Wallet provider: `connectWallet()` in `lib/agent-builder/zerog/provider.ts`
- Receipt storage: Postgres row + 0G Storage blob (root hash anchored on-chain)
- Swap router: `zerog_dex` / `zerog_dex_v2` (update in `zerog.ts` once live addresses are deployed)

---

# CHAPTER 10 — INSTITUTIONAL FLOW DETECTION

## 10.1 The Four Detection Methods

### Dark Pool Print Detection
Every dark pool trade must be reported to FINRA within 10 seconds. The Signal Agent monitors this feed for:
- Single print exceeding 0.5% of average daily volume = large player alert
- Print executed above the ask = urgency to get long (buyer initiated)
- Print executed below the bid = urgency to get short (seller initiated)
- Multiple large prints at the same price level within minutes = accumulation zone

### Options Flow Sweep Detection

| Characteristic | Retail Activity | Institutional Activity |
|---|---|---|
| Order type | Single limit order | Multi-leg sweep across exchanges |
| Fill speed | Slow and patient | Milliseconds — urgency premium willingly paid |
| Premium paid | At bid or below | Above ask |
| Contract size | 1 to 20 contracts | 500 to 50,000 contracts |
| Expiry chosen | Far-dated (months) | Near-dated (days to weeks) |
| Strike chosen | Deep OTM lottery | Near ATM or slightly OTM |

### Volume Delta & Order Flow Imbalance
```
Volume Delta = Aggressive Buy Volume − Aggressive Sell Volume

Aggressive buy  = trades that hit the ASK (buyer initiated)
Aggressive sell = trades that hit the BID (seller initiated)

Spike of +2M or more in 5 minutes = large institutional long entry
Spike of -2M or more in 5 minutes = large institutional short / exit
```

### Order Book Absorption Pattern
When a large player builds a position silently, they absorb every sell order at a specific level. This creates: **massive volume trading with minimal price movement** — a characteristic absorption signature the Signal Agent detects in real time.

---

## 10.2 The Slipstream Strategy — All Four Signals Combined

```
LONG ENTRY DETECTED when all of the following are simultaneously present:
  ✓ Dark pool print > 500K shares at or above ask
  ✓ Options sweep: large call volume above ask (institutional urgency)
  ✓ Volume delta: +2M or more in a 5-minute window
  ✓ Order book absorption pattern confirmed at same price level

ACTION:
  → Signal Agent flags: institutional_flow_direction = LONG (high confidence)
  → Orchestrator weights this signal at 1.5x standard signal strength
  → Stop-loss placed just below the detected institutional entry price

LOGIC:
  → If they are wrong, we are definitely wrong — exit immediately
  → If they are right, we ride the same move they created
  → Their entry price becomes our invalidation level
```

---

# CHAPTER 11 — LIMITATIONS & FAILURE MODES

## 11.1 Fundamental Limitations

**Market Efficiency**
As the system's strategies become known or replicated, alpha will erode. All edges have a finite lifespan. Continuous research is a core operational requirement.
*Mitigation: Signal Agent memory module tracks edge decay; regime-specific strategy performance reviewed quarterly*

**Black Swan Events**
Genuinely unprecedented events will not be correctly handled — the system is trained on historical data.
*Mitigation: Crisis mode halts all trading; human oversight mandatory for portfolio-wide protective actions*

**Latency Reality**
The 500ms pipeline target assumes GPU inference servers. FinBERT alone takes 200–400ms on CPU. Realistic full-pipeline latency on standard hardware: 2–5 seconds — still suitable for the 4-hour+ trade horizon this system targets.
*Mitigation: System explicitly targets swing to short-term horizons; sub-second latency not required*

**Data Dependency**
System quality is bounded by feed quality. Outages or corrupt feeds will degrade performance in non-obvious ways.
*Mitigation: Redundant sources per category; automatic failover; combined quality scoring on all data*

**Causal Chain Decay**
The causal chain library requires quarterly human review. Regulatory changes can invalidate previously reliable chains.
*Mitigation: Quarterly expert review; automatic accuracy tracking per chain with flagging*

## 11.2 Model-Specific Risks

| Risk | Affected Component | Severity | Mitigation |
|---|---|---|---|
| Overfitting to training period | Signal Agent ML models | High | Rolling window retraining; out-of-sample validation |
| Regime misclassification | Regime Detection Agent | High | Multiple indicators; conservative transitions; human alerts |
| Sentiment manipulation | Signal Agent Sentiment module | Medium | Bot detection; source reliability weighting |
| Causal chain invalidated | Signal Agent Causal module | Medium | Quarterly human review; automatic accuracy tracking |
| RL agent reward hacking | Signal Agent RL subagent | Medium | Constrained action space; 6-month paper trading before promotion |
| Graph data staleness | Graph Agent | Low-Medium | Real-time filing alerts; nightly full graph rebuild |
| LLM hallucination | Conversation Layer | Low | Conversation Layer reads receipts only — cannot invent data |

---

# CHAPTER 12 — DEPLOYMENT & OPERATIONS

## 12.1 Pre-Deployment Checklist
- Minimum 2 years of paper trading with documented performance before any live capital deployment
- Out-of-sample backtest on data completely unseen during development (minimum 3 years held-out)
- All 6 agents individually unit-tested and integration-tested as a complete system
- Risk management hard rules formally verified with stress tests — 2008 crisis, 2020 COVID crash, 2022 rate-hike scenarios
- Emergency halt procedure documented, tested, and accessible within 10 seconds at all times
- Marketplace strategies: 30-day paper trading requirement before any strategy can execute live capital in Autonomous mode
- Chain Adapter: full integration test suite against mainnet fork before any live on-chain execution
- Legal and regulatory review in the relevant jurisdiction before live operation with real capital

## 12.2 Human Oversight Requirements

| Trigger | Required Human Action | Time Limit |
|---|---|---|
| Daily drawdown > 5% | Review all positions; decide whether to resume | Within 30 minutes |
| Crisis mode activation | Assess market conditions; authorize or extend halt | Within 1 hour |
| Any trade > $500K notional | Pre-approval required before execution | Before execution |
| 3 consecutive losing days | Performance review; consider temporary halt | Within 24 hours |
| Model decay alert (any agent) | Review retrain proposal; authorize retraining | Within 48 hours |
| Anomaly flag from Conversation Layer | Read explanation; assess if behavior is acceptable | Within 24 hours |
| Causal chain confidence drops below 0.70 | Review affected chain for current validity | Within 72 hours |
| Weekly cadence | Read daily summary reports; check system health dashboard | Every week |

## 12.3 Continuous Improvement Cycle
- **Weekly:** Review Conversation Layer trade reports; identify recurring patterns in losses and near-misses
- **Monthly:** Run model performance attribution analysis; identify underperforming agents and signal modules
- **Quarterly:** Review and update causal chain library; validate regime definitions against recent market behavior
- **Quarterly:** Evaluate alternative data sources; audit marketplace strategy alpha contribution scores
- **Semi-annually:** Full system stress test against simulated crisis scenarios with live agents
- **Annually:** Complete architecture review; assess whether new ML techniques should replace existing models

---

# APPENDIX — GLOSSARY OF TERMS

| Term | Definition |
|---|---|
| Alpha | Return in excess of a benchmark (e.g. S&P 500). The 'edge' the system generates above passive investment. |
| Alpha Contribution Score | Verified measure of how much a marketplace strategy improved outcomes vs the agent baseline, computed over 60+ live trades. |
| ATR | Average True Range — measures market volatility over a rolling window. Used for stop-loss placement. |
| Causal Chain | A verified sequence of cause-and-effect relationships linking an economic event to a price outcome. |
| Chain Adapter | The chain-specific Layer 3 component. Handles wallet, transaction signing, and on-chain execution. Swappable per blockchain. |
| Combined Quality (CQ) | Data quality metric: `CQ = Freshness Score × Reliability Weight`. Applied when data enters any model. |
| Decision Receipt | A structured, immutable record of every trade decision — all agent votes, data sources, causal chain, risk sizing, and outcome. |
| Dark Pool | Off-exchange trading venue where large institutions execute block trades to minimize market impact. |
| FinBERT | A version of the BERT language model fine-tuned specifically on financial text for superior sentiment classification. |
| GEX | Gamma Exposure — measures how options market makers must hedge their books as underlying prices move. |
| HMM | Hidden Markov Model — statistical model used by the Regime Agent to classify hidden market states from observable data. |
| Kelly Criterion | Mathematical formula for optimal bet sizing: `f* = (edge / odds) × kelly_fraction`. Quarter-Kelly (0.25) used for safety. |
| Market Impact | The adverse price movement caused by a large order placed in the market. Avoided through dark pool routing and TWAP/VWAP. |
| Regime | A distinct, classifiable state of market behavior: Low-vol Bull, High-vol Bull, Choppy, Low-vol Bear, High-vol Bear, Crisis. |
| Sharpe Ratio | Return minus the risk-free rate divided by volatility. Measures return per unit of risk taken. |
| Slippage | The difference between the theoretical entry price and the actual executed fill price. |
| Supply Chain Contagion | The predictable propagation of price impact from one company through its supply chain to connected companies. |
| TWAP | Time-Weighted Average Price — execution strategy that spreads orders evenly over a time window. |
| VaR | Value at Risk — the maximum expected portfolio loss at a given confidence level and time horizon. |
| Volume Delta | Aggressive Buy Volume minus Aggressive Sell Volume. Positive = buyers in control; negative = sellers in control. |
| VWAP | Volume-Weighted Average Price — benchmark price weighted by trading volume. Used for institutional execution benchmarking. |

---

*Agentic Trading System — Technical Documentation v3.0 — Combined & Updated — April 2026*

*CONFIDENTIAL — FOR RESEARCH AND EDUCATIONAL USE*
