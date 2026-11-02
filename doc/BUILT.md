# BUILT — STRATEGY BUILDER MODULE
## What We've Already Built — Detailed Technical Breakdown

**Module:** Strategy Engine & Visual Builder  
**System:** Agentic Trading System v3.0  
**Status:** ✅ Built & Functional  
**Scope:** Strategy creation, indicator assembly, agent-assisted design, and backtesting

---

> This document describes the **Strategy Builder** — a fully operational subsystem inside the Agentic Trading System. Think of it as a **n8n-style visual workflow builder, but powered entirely by our own proprietary strategy engine.** Every block in the canvas, every condition node, every filter — they are not generic programming constructs. They are financial instruments, live agent data streams, and market-logic primitives that our engine understands natively.

---

## SECTION 1 — WHAT THE STRATEGY BUILDER IS

The Strategy Builder is the creative workspace of the platform. It sits inside **Chapter 4 of our system architecture** — the Strategy & Indicator Ecosystem — and it is the component that turns the platform from a closed algorithmic box into an **open, user-extensible trading intelligence layer.**

The analogy to n8n is intentional and precise:

| n8n Concept | Our Strategy Builder Equivalent |
|---|---|
| Workflow canvas | Strategy canvas — visual drag-and-drop board |
| Trigger node | Market event trigger (price tick, news arrival, filing alert) |
| Action node | Signal output block (BUY / SELL / HOLD with confidence score) |
| Filter / condition node | Condition block (threshold gates, AND/OR logic, regime gate) |
| Integration node | Live agent data block (pull real-time data from any of our 6 agents) |
| Code node | Python DSL editor (advanced path — full `compute_indicators()` + `signal()`) |
| Test / debug run | Strategy Backtester (validate on historical data before going live) |
| Publish to marketplace | Publish strategy → gets Alpha Contribution Score from live agent trades |

The critical difference: **in n8n, nodes connect to external APIs. In our builder, nodes connect to the living brain of our 6-agent system.** A user dragging in a "Sentiment Filter" block is not calling a static function — they are pulling the live FinBERT output stream from the Signal Agent in real time.

---

## SECTION 2 — THE CANVAS ARCHITECTURE

### 2.1 What the Canvas Looks Like

The canvas is a directed acyclic graph (DAG) of nodes connected by edges. Data flows left to right: from Trigger nodes through Indicator nodes through Condition/Filter nodes to the final Signal Output node.

```
[TRIGGER NODE] → [INDICATOR BLOCKS] → [CONDITION BLOCKS] → [FILTER BLOCKS] → [SIGNAL OUTPUT]
     │                  │                     │                    │                 │
 Market event      50+ indicators         Threshold +          Regime gate /    BUY / SELL /
 (tick, news,      computed from          AND/OR logic         Sentiment gate   HOLD + confidence
  filing, time)    OHLCV + agent          trees                / Risk gate      score
                   live streams
```

Every node has a **Live Preview Panel** on the right rail that shows what that node would have output during a selected historical window. This means the user can visually see how their logic behaves before committing to a full backtest.

### 2.2 Node Categories

#### Category 1 — TRIGGER NODES
These define what event kicks off the strategy evaluation. One trigger per strategy.

| Trigger Block | What It Fires On |
|---|---|
| **Price Tick** | Every new OHLCV bar (1m, 5m, 15m, 1h, 4h, daily selectable) |
| **News Event** | Any new text ingested by the Data Ingestion Agent matching a ticker |
| **Filing Alert** | SEC EDGAR 8-K, 13F, Form 4 submission for a watchlist ticker |
| **Sentiment Spike** | Signal Agent's FinBERT score moves more than a user-defined threshold |
| **Regime Change** | Regime Detection Agent broadcasts a regime transition |
| **Volume Anomaly** | Volume on a ticker exceeds N × its rolling 20-day average |
| **Institutional Flow** | Dark pool print or options sweep alert from Signal Agent |
| **Graph Propagation** | Graph Agent detects a Tier 1 or Tier 2 supply chain event affecting a ticker |
| **Scheduled** | Time-based trigger — e.g. "Run at 9:35 AM every market day" |
| **Custom (Python)** | User-defined trigger logic in the DSL code editor |

---

#### Category 2 — INDICATOR BLOCKS
Pre-built blocks for every major technical indicator. No code needed to use them. Drag onto the canvas, wire to any downstream condition block, done.

**Trend Indicators**
- SMA (Simple Moving Average) — configurable period
- EMA (Exponential Moving Average) — configurable period
- MACD — configurable fast, slow, signal periods
- ADX (Average Directional Index) — trend strength
- Ichimoku Cloud — full 5-line implementation
- Supertrend — ATR-based trend direction
- Parabolic SAR — trailing stop / trend direction
- Linear Regression Channel — with upper / lower deviation bands

**Momentum Indicators**
- RSI (Relative Strength Index) — configurable period, overbought/oversold levels
- Stochastic Oscillator — %K and %D lines
- CCI (Commodity Channel Index)
- Williams %R
- Rate of Change (ROC)
- Momentum (MOM)

**Volatility Indicators**
- Bollinger Bands — configurable period and standard deviation multiplier
- ATR (Average True Range) — used across stop-loss calculations system-wide
- Keltner Channels
- Donchian Channels
- Historical Volatility (HV) — rolling window configurable
- Implied Volatility (IV) — pulled from live options chain data

**Volume Indicators**
- OBV (On Balance Volume)
- VWAP (Volume Weighted Average Price) — intraday and anchored variants
- MFI (Money Flow Index)
- CMF (Chaikin Money Flow)
- Volume Delta — Aggressive Buy Volume minus Aggressive Sell Volume
- Accumulation / Distribution Line

**Pattern Recognition Blocks** *(CNN-powered, not rule-based)*
- Head & Shoulders / Inverse Head & Shoulders
- Double Top / Double Bottom
- Ascending / Descending / Symmetric Triangle
- Bull / Bear Flag
- Wedge (Rising / Falling)
- Cup & Handle

> **Note:** Pattern Recognition blocks use the trained CNN model from the Signal Agent's Technical Module. These are not textbook rule approximations — they are inference calls to a model that learned pattern geometry directly from historical price data.

---

#### Category 3 — LIVE AGENT DATA BLOCKS
This is what makes our builder categorically different from any other strategy builder on the market. These blocks tap directly into the live output of our 6-agent system. When a strategy runs — in backtest or live — these blocks call the agent's current output in real time.

| Block Name | Agent Source | Data Pulled |
|---|---|---|
| **Sentiment Score** | Signal Agent | `sentiment.score(ticker)` — FinBERT score with sarcasm correction applied. Returns value in [-1, +1] |
| **Sentiment Delta** | Signal Agent | `sentiment.delta(ticker)` — change in sentiment score over the last N bars |
| **Sentiment Velocity** | Signal Agent | `sentiment.velocity(ticker)` — rate of change of sentiment, useful for detecting breakout news |
| **Current Regime** | Regime Detection Agent | `regime.current()` — returns one of 6 regime labels with confidence score |
| **Regime Confidence** | Regime Detection Agent | `regime.confidence()` — numeric 0–1; use to gate strategy on regime certainty |
| **Graph Impact Score** | Graph & Relationship Agent | `graph.impact(ticker)` — propagation score for this ticker from a connected company event |
| **Supply Chain Tier** | Graph & Relationship Agent | `graph.tier(ticker)` — whether this ticker is Tier 1, 2, or 3 relative to the event source |
| **Institutional Flow Direction** | Signal Agent | `institutional.flow(ticker)` — dark pool + options sweep signal. Returns LONG / SHORT / NEUTRAL |
| **Institutional Flow Confidence** | Signal Agent | `institutional.confidence(ticker)` — confidence score for the detected institutional bias |
| **ML Ensemble Prediction** | Signal Agent | `ml.prediction(ticker)` — the ML module's probability-weighted directional prediction |
| **ML Uncertainty Band** | Signal Agent | `ml.uncertainty(ticker)` — ± band around the ML prediction; useful for volatility-adaptive sizing |
| **News Source Count** | Data Ingestion Agent | `data.source_count(ticker, window)` — number of distinct sources covering a ticker in N minutes |
| **Data Quality Score** | Data Ingestion Agent | `data.quality(ticker)` — Combined Quality score CQ = Freshness × Reliability Weight |

**Using Live Agent Blocks in Visual Strategies — Example:**
```
A user drags in:
  [Price Tick Trigger → 4h bar]
       ↓
  [RSI Block → period 14, output: RSI value]
       ↓
  [Condition Block: RSI < 35 AND]
  [Sentiment Score Block: sentiment.score() > 0.4 AND]
  [Regime Block: regime.current() = "Low-vol Bull Trend"]
       ↓
  [Signal Output: BUY, confidence = 0.72]

Result: The strategy fires a BUY signal only when RSI is oversold,
sentiment is meaningfully positive, and the market is in a favorable regime.
Classic mean-reversion + sentiment confirmation + regime gate.
Three powerful conditions. Zero lines of code.
```

---

#### Category 4 — CONDITION & LOGIC BLOCKS
These are the decision gates between indicator outputs and the final signal.

| Block | Function |
|---|---|
| **Threshold Gate** | Output passes if input is above / below / between defined levels |
| **AND Gate** | All connected inputs must pass for signal to proceed |
| **OR Gate** | Any connected input passing is sufficient |
| **NOT Gate** | Inverts the boolean output of a connected block |
| **Crossover Detector** | Fires when Line A crosses Line B (e.g. EMA 20 crosses EMA 50) |
| **Divergence Detector** | Flags when price and an indicator move in opposite directions |
| **Lookback Window** | "This condition must have been true for N of the last M bars" |
| **Cooldown Timer** | Prevents re-firing within N bars/minutes of a previous signal |
| **Confidence Combiner** | Aggregates multiple confidence scores using weighted average |
| **Boolean Sequencer** | "Condition A must occur, then Condition B within N bars" — detects ordered setups |

---

#### Category 5 — FILTER BLOCKS
Filter blocks are the last layer before the signal output. They prevent signals from firing in unfavorable contexts — even if all upstream conditions are met.

| Filter Block | What It Gates On |
|---|---|
| **Regime Gate** | Only allow signal if current regime matches user-selected list |
| **Sentiment Filter** | Block signal if sentiment score is outside user-defined range |
| **Volatility Filter** | Block signal if ATR or IV is above / below threshold |
| **Volume Filter** | Block signal if volume is below minimum threshold (low liquidity gate) |
| **Time-of-Day Filter** | Block signal outside user-defined market hours window |
| **Earnings Blackout Filter** | Suppress signals N days before and after an earnings date |
| **Risk Headroom Filter** | Block signal if current portfolio VaR is above user-defined threshold |
| **Data Quality Filter** | Block signal if CQ score from Data Ingestion Agent is below threshold |
| **Correlation Filter** | Block signal if the target ticker is already correlated > 0.85 with a held position |
| **Institutional Consensus Filter** | Only allow signal if `institutional.flow()` agrees with signal direction |

---

#### Category 6 — OUTPUT BLOCK
Every strategy ends at one Signal Output block.

```
OUTPUT BLOCK FIELDS:
─────────────────────────────────────────────
Direction:      BUY / SELL / SHORT / COVER / HOLD
Confidence:     0.0 – 1.0  (calculated from upstream nodes or user-defined formula)
Ticker:         Can be fixed (single-ticker strategy) or dynamic (multi-ticker scanner)
Horizon:        Expected hold period (scalp / intraday / swing / position)
Stop-Loss:      Optional — can override system Risk Agent default
Take-Profit:    Optional — can override system Risk Agent default
Note:           Free-text label that appears in the Decision Receipt for this strategy's contribution
```

---

## SECTION 3 — TWO CREATION PATHS

### Path A — Visual Builder (All Skill Levels)

The visual builder requires **zero coding knowledge.** The user assembles a strategy by:

1. Dragging blocks from the left panel onto the canvas
2. Wiring outputs to inputs via connector lines
3. Configuring each block's parameters in the right-side property panel
4. Checking the Live Preview Panel to see historical behavior
5. Hitting **Run Backtest** to validate performance before going live

The canvas auto-validates the DAG structure — if a user connects an output type that is incompatible with the downstream input (e.g. wiring a continuous numeric output into a boolean gate without a Threshold block in between), the canvas surfaces an error inline with a suggested fix.

**Strategy Builder UI — Component Layout:**

```
┌────────────────────────────────────────────────────────────────────────────┐
│  HEADER: Strategy Name | Ticker(s) | Timeframe | [Backtest] [Save] [Publish]│
├───────────────┬────────────────────────────────────┬───────────────────────┤
│  BLOCK PANEL  │          CANVAS (DAG view)          │   PROPERTY PANEL      │
│               │                                    │   (selected node)     │
│  ▸ Triggers   │   [Trigger] → [RSI] → [AND Gate]  │                       │
│  ▸ Indicators │               ↗                    │   RSI Settings        │
│  ▸ Agent Data │   [Sentiment]→               → [OUTPUT] │ Period: 14       │
│  ▸ Conditions │               ↘                    │   Overbought: 70      │
│  ▸ Filters    │   [Regime Gate]→ [AND Gate]         │   Oversold: 30        │
│  ▸ Output     │                                    │                       │
│               │                                    │   Preview: RSI chart  │
│  [Search...]  │                                    │   (last 90 days)      │
└───────────────┴────────────────────────────────────┴───────────────────────┘
│  BACKTEST PANEL (collapsed by default, expands on "Run Backtest")           │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### Path B — Python DSL Code Editor (Advanced / Quant Path)

For users who need full programmatic control, the builder exposes a Python-based Domain Specific Language. The code editor sits as an alternative view of the same strategy — switch between Visual and Code views at any time. Changes in either view reflect in the other.

**DSL Structure — Every Strategy is Two Functions:**

```python
from platform import indicators, agents, filters
import numpy as np

# ─── METADATA ────────────────────────────────────────────────────────────────
STRATEGY_NAME    = "RSI Oversold + Sentiment Reversal"
TICKER           = "AAPL"          # or list for multi-ticker
TIMEFRAME        = "4h"
HORIZON          = "swing"         # scalp | intraday | swing | position

# ─── STEP 1: COMPUTE INDICATORS ──────────────────────────────────────────────
def compute_indicators(bar: Bar, history: History) -> dict:
    """
    Called on every new bar. Returns a dict of values that signal() will use.
    `bar`     → current OHLCV bar
    `history` → rolling history of previous bars (length configurable, default 200)
    """
    rsi     = indicators.rsi(history.close, period=14)
    bb      = indicators.bollinger(history.close, period=20, std=2.0)
    sent    = agents.sentiment.score(TICKER)       # live FinBERT score
    regime  = agents.regime.current()             # live regime label
    inst    = agents.institutional.flow(TICKER)   # live dark pool signal

    return {
        "rsi"           : rsi[-1],
        "bb_lower"      : bb.lower[-1],
        "bb_upper"      : bb.upper[-1],
        "sentiment"     : sent.score,
        "sentiment_vel" : sent.velocity,
        "regime"        : regime.label,
        "regime_conf"   : regime.confidence,
        "inst_flow"     : inst.direction,
    }


# ─── STEP 2: GENERATE SIGNAL ─────────────────────────────────────────────────
def signal(data: dict) -> Signal:
    """
    Called immediately after compute_indicators().
    Returns a Signal object or Signal.HOLD.
    """

    # Gate 1: Only run in favorable regimes
    if data["regime"] not in ["Low-vol Bull Trend", "High-vol Bull Trend"]:
        return Signal.HOLD

    # Gate 2: Data quality check (optional but recommended)
    if agents.data.quality(TICKER) < 0.60:
        return Signal.HOLD

    # Gate 3: Regime confidence must be high enough to act on
    if data["regime_conf"] < 0.70:
        return Signal.HOLD

    # Core signal logic: RSI oversold + price at lower Bollinger + positive sentiment
    rsi_oversold     = data["rsi"] < 35
    at_support       = bar.close <= data["bb_lower"] * 1.01   # within 1% of lower band
    sentiment_pos    = data["sentiment"] > 0.35
    sentiment_rising = data["sentiment_vel"] > 0

    # Optional: boost confidence if institutional flow agrees
    inst_confirms    = data["inst_flow"] == "LONG"

    if rsi_oversold and at_support and sentiment_pos and sentiment_rising:
        base_confidence = 0.68
        final_confidence = base_confidence + (0.12 if inst_confirms else 0.0)
        return Signal(
            direction  = "BUY",
            confidence = min(final_confidence, 1.0),
            horizon    = HORIZON,
            note       = "RSI oversold at Bollinger support. Sentiment positive and rising."
                         + (" Institutional flow confirms LONG." if inst_confirms else "")
        )

    return Signal.HOLD
```

**DSL Available Modules:**
```python
indicators.*          # All 50+ built-in technical indicators
agents.sentiment.*    # Live FinBERT output: .score(), .delta(), .velocity()
agents.regime.*       # Live regime: .current(), .confidence()
agents.graph.*        # Live graph: .impact(), .tier()
agents.institutional.*# Live dark pool: .flow(), .confidence()
agents.ml.*           # Live ML module: .prediction(), .uncertainty()
agents.data.*         # Live data quality: .quality(), .source_count()
filters.*             # Programmatic access to all filter blocks
risk.*                # Read-only access to current portfolio risk state
```

**Code Editor Features:**
- Syntax validation on every keystroke — catches type mismatches before save
- Autocomplete with inline documentation for all platform modules
- Side-by-side diff viewer when editing an existing strategy
- One-click switch to Visual view (canvas auto-renders from the code)
- Inline error highlighting with suggested fixes from the Strategy Agent

---

## SECTION 4 — AGENT-ASSISTED STRATEGY CREATION

This is the mode where users build strategies **with the help of AI agents** rather than solo. The Strategy Agent — a specialized sub-agent embedded within the builder — assists throughout the creation process.

### 4.1 How Agent Assistance Works

The user opens a **conversation panel** inside the builder. They describe in plain English what they are trying to capture:

```
User: "I want to catch stocks that are oversold technically but 
       where institutional money is quietly accumulating. I only 
       want this to fire in non-crisis regimes."

Strategy Agent: "Understood. Here's the logic I recommend:

  Trigger: 4h price bar
  
  Indicator Layer:
  - RSI(14) below 38 — technically oversold territory
  - Price near or below VWAP — indicates intraday selling pressure
  - OBV rising while price falling — classic accumulation divergence
  
  Agent Data Layer:
  - institutional.flow() = LONG and confidence > 0.65
  - sentiment.score() > 0.20 (not deeply negative)
  
  Filter Layer:
  - Regime gate: exclude Crisis and High-vol Bear Trend
  - Volume filter: volume must be > 1.2x 20-day average (confirm interest)
  - Earnings blackout: suppress 3 days before and after earnings
  
  Estimated historical Sharpe (AAPL, 2020–2024): ~1.42
  Estimated win rate: 61%
  
  Shall I build this on the canvas, or would you like to adjust 
  any parameters first?"

User: "Build it. But make the RSI threshold 40 instead of 38."

Strategy Agent: [Canvas auto-populates with all nodes wired correctly]
               "Done. RSI threshold set to 40. Ready to backtest."
```

### 4.2 What the Strategy Agent Can Do

| Capability | Description |
|---|---|
| **Natural language → strategy** | Convert plain English descriptions into a fully wired canvas DAG or DSL code |
| **Parameter recommendation** | Suggest optimal thresholds based on the ticker's historical behavior |
| **Block suggestion** | Recommend which indicator or agent data blocks are most relevant for a stated goal |
| **Logic review** | Audit an existing strategy for contradictions, redundant conditions, or known failure modes |
| **Regime analysis** | Explain which market regimes a given strategy performs best / worst in, with data |
| **Risk feedback** | Flag strategies that would produce oversized signals given current portfolio state |
| **Backtest interpretation** | After a backtest, explain which conditions drove the worst drawdowns and suggest fixes |
| **Comparison mode** | Run two strategy variants side by side and explain the performance difference |

### 4.3 Agent Assistance Modes Within the Builder

| Mode | How It Works |
|---|---|
| **Draft Mode** | Describe goal in chat → Agent builds full strategy from scratch |
| **Review Mode** | User builds solo → Agent audits and suggests improvements |
| **Tune Mode** | Existing strategy underperforming → Agent proposes parameter adjustments backed by backtest data |
| **Explain Mode** | Ask "why did this strategy fire on date X?" → Agent walks through every node's state at that moment |
| **Translate Mode** | Paste a TradingView Pine Script or pseudocode → Agent converts it to our DSL or visual blocks |

---

## SECTION 5 — THE BACKTESTING ENGINE

### 5.1 Purpose

After building a strategy — solo or with agent help — the user validates it through the Backtester before it goes anywhere near live capital. The Backtester is not a simple simulation. It is a **full replay engine** that re-runs the entire signal generation pipeline against historical data, including live agent data that has been logged and timestamped.

> **Critical Design Decision:** Backtests use *historically logged* agent outputs — not re-computed present values. When the backtest replays a bar from January 15 2023, it feeds the strategy the sentiment score, regime classification, and institutional flow direction that our agents *actually produced at that exact moment* — not what they would produce today. This prevents look-ahead bias from corrupting backtest results.

### 5.2 Backtest Configuration

```
BACKTEST SETTINGS
─────────────────────────────────────────────
Ticker(s):          Single ticker or multi-ticker universe
Date Range:         Start date → End date (historical data available from 2010)
Timeframe:          Must match strategy trigger timeframe
Initial Capital:    $X (default: $100,000)
Position Sizing:    [Agent Kelly Sizing] or [Fixed %] or [Fixed $]
Commission Model:   Configurable per-share or per-trade
Slippage Model:     None / Linear (x bps per trade) / Realistic (volume-weighted)
Benchmark:          SPY / QQQ / None (for Sharpe / Alpha calculation)
Regime Filter:      Run in all regimes / Selected regimes only
```

### 5.3 Backtest Output — The Strategy Report Card

After running, the Backtester generates a full report with the following sections:

**Section A — Summary Metrics**

| Metric | Description |
|---|---|
| Total Return | Cumulative return over the backtest period |
| Annualized Return | Compounded annual growth rate |
| Benchmark Return | Benchmark (SPY/QQQ) return over same period |
| Alpha | Annualized excess return over benchmark |
| Sharpe Ratio | Risk-adjusted return (annualized) |
| Sortino Ratio | Downside-only risk-adjusted return |
| Max Drawdown | Largest peak-to-trough decline |
| Max Drawdown Duration | Days from peak to recovery |
| Win Rate | % of trades that closed profitably |
| Average Win / Average Loss | Payoff ratio |
| Profit Factor | Gross profit ÷ gross loss |
| Total Trades | Number of signals executed in the test window |
| Average Holding Period | Mean time in a position |
| VaR (99%, 1-day) | Maximum expected 1-day loss at 99% confidence |
| Calmar Ratio | Annual return ÷ Max Drawdown |

**Section B — Regime Performance Breakdown**

| Regime | Trades | Win Rate | Sharpe | Avg Return/Trade |
|---|---|---|---|---|
| Low-vol Bull Trend | N | x% | x.xx | x% |
| High-vol Bull Trend | N | x% | x.xx | x% |
| Sideways / Choppy | N | x% | x.xx | x% |
| Low-vol Bear Trend | N | x% | x.xx | x% |
| High-vol Bear Trend | N | x% | x.xx | x% |
| Crisis | N | x% | x.xx | x% |

This table shows the user exactly where the strategy works and where it breaks. A strategy that looks great in aggregate but has a -40% Sharpe in Choppy regimes needs a Regime Gate filter added before it is deployed.

**Section C — Equity Curve & Drawdown Chart**

Interactive chart showing:
- Portfolio value over time (strategy vs benchmark)
- Drawdown chart below equity curve
- Individual trade markers (green for profitable, red for loss)
- Regime background coloring (6 colors, one per regime)

**Section D — Trade Log**

Full table of every trade the strategy would have executed:

```
Date/Time | Ticker | Direction | Entry | Exit | P&L | Hold Time | 
Signal Confidence | Regime at Entry | Sentiment at Entry | 
Institutional Flow | Exit Reason (Stop / Target / Timeout / Regime Change)
```

**Section E — Signal Source Attribution**

Which blocks contributed most to profitable vs unprofitable trades:

```
Example attribution (100 trades analyzed):

Sentiment Score > 0.35       → Present in 87% of winning trades, 41% of losing trades
                               → HIGH SIGNAL VALUE — keep this condition

Institutional Flow = LONG    → Present in 73% of winning trades, 28% of losing trades
                               → HIGH SIGNAL VALUE — keep this condition

RSI < 40                     → Present in 91% of winning trades, 88% of losing trades
                               → LOW DISCRIMINATING POWER — this condition alone is not selective enough
                               → Recommendation: tighten to RSI < 35 for higher precision

Regime = Low-vol Bull        → Present in 100% of top-quartile trades
                               → STRONG FILTER — removing this would significantly hurt performance
```

This section is generated by the Strategy Agent and written in plain English — not just tables.

**Section F — Stress Test Results**

The Backtester automatically re-runs the strategy against pre-defined stress scenarios:

| Stress Scenario | Period | Strategy Return | Max Drawdown |
|---|---|---|---|
| 2008 Global Financial Crisis | Aug 2008 – Mar 2009 | x% | x% |
| 2020 COVID Crash | Feb 2020 – Mar 2020 | x% | x% |
| 2022 Rate Hike Cycle | Jan 2022 – Dec 2022 | x% | x% |
| 2010 Flash Crash | May 6, 2010 | x% | x% |
| 2015 China Volatility | Aug 2015 | x% | x% |

If the strategy has no Crisis Regime gate and shows a -60% drawdown in the 2008 test, the Strategy Agent flags this with a recommended fix before the user can publish or deploy.

### 5.4 Walk-Forward Validation

For strategies that pass the initial backtest, the user can run a **Walk-Forward Test** — a more rigorous validation that prevents in-sample overfitting:

```
Walk-Forward Configuration:
  Training Window:    24 months
  Test Window:        6 months  
  Step:               6 months
  Runs:               N sequential windows (auto-calculated from date range)

Output: 
  - Performance in each out-of-sample window
  - Consistency score (how stable are results across windows?)
  - Decay curve (is performance declining in more recent windows?)
  - Final verdict: STABLE / UNSTABLE / DECLINING
```

A strategy with UNSTABLE or DECLINING walk-forward results gets a **mandatory warning label** if published to the marketplace, visible to all users considering it.

### 5.5 From Backtest to Live — The Gating Process

```
Strategy passes backtest
         ↓
Strategy Agent review (automated)
  → Checks for: look-ahead bias indicators, insufficient trade count (<30 trades), 
    unrealistic Sharpe (>5 without explanation), missing regime gate
         ↓
Paper Trading Mode (optional but recommended)
  → Strategy runs in real time but no capital is deployed
  → 30 days minimum for marketplace publication eligibility
         ↓
Live Deployment Options:
  Option A → Personal use only (Assisted or Autonomous mode on your own capital)
  Option B → Publish to Marketplace (30-day paper trading mandatory first)
```

---

## SECTION 6 — HOW THE STRATEGY BUILDER FITS INTO THE FULL SYSTEM

The Strategy Builder is not a standalone tool. It is deeply integrated with every layer of the Agentic Trading System:

```
USER BUILDS STRATEGY IN BUILDER
           ↓
STRATEGY STORED IN PERSONAL LIBRARY
           ↓  
IN AUTONOMOUS MODE → Orchestrator can select this strategy 
                     as one of its active trading approaches.
                     Full 6-agent consensus still applies before 
                     any signal from this strategy triggers a real trade.

IN ASSISTED MODE  → Strategy runs in background. 
                     Outputs appear in the user's research dossier.
                     User makes final call.

IN SOLO MODE      → Strategy runs for research/alerting only.
                     No agent voting. User executes manually.
                     Outcomes still logged for performance comparison.
           ↓
IF PUBLISHED → Marketplace listing created.
               Strategy gets assigned an Alpha Contribution Score 
               based on real agent trade outcomes (not backtests).
               Performance breakdown by regime shown to all users.
```

Every signal a user-built strategy generates feeds directly into the **Decision Receipt** — labeled with the strategy name and the confidence score from the output block. If the Orchestrator acts on it, the receipt shows exactly which user strategy contributed which signal at what confidence, alongside all other agent votes.

---

## SECTION 7 — WHAT'S BUILT VS WHAT'S NEXT

### ✅ Already Built — Strategy Builder Module

- Visual canvas with all 6 block categories (Trigger, Indicator, Agent Data, Condition, Filter, Output)
- All 50+ indicator blocks implemented and tested
- All Live Agent Data blocks wired to real-time agent outputs
- Python DSL editor with autocomplete, validation, and visual sync
- Canvas auto-validation (type checking, DAG structure, disconnected node detection)
- Live Preview Panel (historical node output visible per block without full backtest)
- Strategy Agent — Draft, Review, Tune, Explain, Translate modes
- Backtesting Engine — full replay against historically logged agent outputs
- Strategy Report Card — all 6 sections (Summary, Regime Breakdown, Equity Curve, Trade Log, Signal Attribution, Stress Test)
- Walk-Forward Validation engine
- Gating process from backtest → paper → live
- Marketplace listing creation flow with mandatory paper trading gate
- Alpha Contribution Score tracking infrastructure

### 🔜 Next Phases

- Multi-ticker scanner mode (run strategy across a watchlist universe, rank by signal strength)
- Strategy combiner (merge two strategies into one weighted signal output)
- Genetic optimizer (auto-tune parameters using walk-forward fitness function — guarded against overfitting)
- Community strategy reviews and commentary inside marketplace listings
- Strategy version history and rollback
- Mobile canvas viewer (read-only on mobile; full editing on desktop)

---

*Strategy Builder — BUILT.md — Agentic Trading System v3.0 — April 2026*  
*CONFIDENTIAL — FOR RESEARCH AND EDUCATIONAL USE*
