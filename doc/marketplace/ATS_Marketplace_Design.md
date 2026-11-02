# Agentic Trading System — Marketplace Design
## User Flow, Components & Content Specification

**Document Type:** Product Design Specification  
**Version:** 1.0 — April 2026  
**Scope:** Marketplace Module — Strategies & Indicators Ecosystem

---

## Table of Contents

1. [What the Marketplace Is](#1-what-the-marketplace-is)
2. [User Types](#2-user-types)
3. [User Flows](#3-user-flows)
4. [Marketplace Home Page](#4-marketplace-home-page)
5. [Strategy Card Component](#5-strategy-card-component)
6. [Strategy Detail Page](#6-strategy-detail-page)
7. [Indicator Detail Page](#7-indicator-detail-page)
8. [Creator Dashboard](#8-creator-dashboard)
9. [Strategy Builder](#9-strategy-builder)
10. [Leaderboard Page](#10-leaderboard-page)
11. [My Library Page](#11-my-library-page)
12. [Content Rules & Quality Gates](#12-content-rules--quality-gates)
13. [Badge System](#13-badge-system)
14. [Navigation Structure](#14-navigation-structure)
15. [Core Design Principle](#15-core-design-principle)

---

# 1. What the Marketplace Is

The Marketplace is a **living ecosystem** where developers and traders publish strategies and indicators. Agents in Autonomous mode use them on real trades. Performance is tracked live — not simulated. The marketplace is a meritocracy where strategies earn reputation from real results, not marketing.

### Two Types of Listings

| Type | Definition |
|---|---|
| **Strategy** | Complete trading logic — entry conditions, exit conditions, regime gates, and risk parameters |
| **Indicator** | Custom data signal that plugs into strategies or the visual builder as a reusable component |

### What Makes This Marketplace Different

Every performance number shown on the marketplace is earned from **real agent trades** — not from a backtest, not from a demo, not from marketing copy. When a strategy shows 61% win rate and +0.34 Alpha Score, that means real agents used it on real trades and it outperformed the baseline by that margin. Backtests are shown separately and always clearly labeled as historical simulation.

---

# 2. User Types

```
CREATORS      → Build and publish strategies / indicators
                Earn reputation + future monetization rights

CONSUMERS     → Browse, evaluate, and activate strategies
                Use in Autonomous or Assisted mode

AGENTS        → Programmatically activate strategies in Autonomous mode
                Generate live performance data that updates every listing

PLATFORM      → Curates the prebuilt library
                Enforces quality gates before any strategy goes public
```

---

# 3. User Flows

## 3.1 Consumer — Browse & Activate a Strategy

```
MARKETPLACE HOME
        ↓
Browse / Search / Filter grid
        ↓
Strategy Card (preview)
        ↓
Strategy Detail Page
  → Review live performance data
  → Review regime breakdown
  → Review risk profile
  → Review creator profile
  → Read sample Decision Receipts
        ↓
        ├── "Activate in Autonomous Mode"
        │         ↓
        │   Configure activation settings:
        │     → Capital allocation % 
        │     → Regime gate overrides
        │     → Max trades per day
        │         ↓
        │   Mandatory 30-day paper trading period begins
        │         ↓
        │   Paper results shown to user after 30 days
        │         ↓
        │   User reviews → Approves → Strategy goes live
        │
        └── "Add to Assisted Research"
                  ↓
            Strategy appears in Assisted mode research dossier
            Agent uses it for analysis but not execution
            No paper trading period required for research use
```

---

## 3.2 Creator — Build & Publish a Strategy

```
CREATOR DASHBOARD
        ↓
"Create New Strategy"
        ↓
Choose Creation Path:
  ├── Visual Builder  (drag and drop — any skill level)
  └── Code Editor     (Python DSL — advanced users)
        ↓
Build the Strategy:
  → Define entry conditions
  → Define exit conditions
  → Set regime gates (which of the 6 regimes activate this?)
  → Set risk parameters (max position %, stop-loss type)
        ↓
Backtest:
  → Select date range and tickers
  → Review historical simulation results
  → Results clearly labeled: "SIMULATION — NOT LIVE PERFORMANCE"
  → Adjust and iterate until satisfied
        ↓
Automated Platform Validation:
  ✓ Does it compile without errors?
  ✓ Does it have at least one regime gate defined?
  ✓ Does it have a defined stop-loss mechanism?
  ✓ Does it produce minimum 100 historical instances in backtest?
  ✓ Is the description human-readable?
        ↓
Publish Decision:
  ├── Keep Private
  │     → Only accessible by creator and their own agents
  │     → No listing on marketplace
  │
  └── Publish to Marketplace
            ↓
          Set: Name, description, tags, regime compatibility labels
          Set: Visibility (free — paid tier is a future feature)
            ↓
          30-day paper trading period begins automatically
          Strategy appears with "NEW — Paper Trading" badge
            ↓
          After 60 live agent trades → Alpha Contribution Score appears
            ↓
          Consistent positive score over time → "VERIFIED" badge earned
```

---

## 3.3 Agent — Activating a Marketplace Strategy (Autonomous Mode)

```
User in Autonomous Mode selects strategy mix from marketplace
        ↓
Agent checks: Is this strategy regime-compatible with current market?
        ↓
IF regime is compatible AND paper period is complete:
  Strategy signal becomes one input in the Orchestrator vote
  Signal weight is proportional to the strategy's Alpha Contribution Score
  Decision Receipt logs: "Marketplace Strategy: [Name] voted [direction]
                          with confidence [X] — Alpha Score: [Y]"
        ↓
After trade closes:
  Strategy's contribution to the outcome is measured
  Alpha Contribution Score updated in real time
  Creator profile stats updated
  Listing performance numbers refreshed
```

---

## 3.4 Creator — Publishing a Custom Indicator

```
CREATOR DASHBOARD → "Create New Indicator"
        ↓
Define indicator:
  → Name and description
  → Input data sources (price, sentiment, graph impact, etc.)
  → Computation logic (visual or code)
  → Output type (scalar / boolean / vector)
  → Update frequency (tick / minute / daily)
        ↓
Test indicator against historical data
        ↓
Automated validation:
  ✓ Does it produce valid output on test data?
  ✓ Is output clearly typed and documented?
        ↓
Publish to Indicator Marketplace
  → Other creators can import it into their strategies
  → Usage count tracked per indicator
  → Creator credited on every strategy that uses their indicator
```

---

# 4. Marketplace Home Page

## 4.1 Page Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  NAVBAR                                                          │
│  [Logo]  Strategies  Indicators  Leaderboard  My Library         │
│                                   [+ Create]  [Connect Wallet]   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  HERO SEARCH BAR                                                 │
│  ┌────────────────────────────────────────────────────────┐      │
│  │  Search strategies, indicators, creators...        🔍  │      │
│  └────────────────────────────────────────────────────────┘      │
│                                                                  │
│  Trending:  [Momentum]  [Mean Reversion]  [News Catalyst]        │
│             [Supply Chain]  [Short Squeeze]  [Macro]             │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────┬────────────────────────────────────────────────┐
│  FILTER PANEL   │  STRATEGY GRID (3 columns)                     │
│                 │                                                │
│  Category       │  [Card]  [Card]  [Card]                        │
│  ○ All          │  [Card]  [Card]  [Card]                        │
│  ○ Strategies   │  [Card]  [Card]  [Card]                        │
│  ○ Indicators   │                                                │
│                 │  [Load More]                                   │
│  Regime         │                                                │
│  □ Bull Trend   │                                                │
│  □ Bear Trend   │                                                │
│  □ Sideways     │                                                │
│  □ All Regimes  │                                                │
│                 │                                                │
│  Status         │                                                │
│  □ Verified     │                                                │
│  □ Top Rated    │                                                │
│  □ Platform Pick│                                                │
│  □ New          │                                                │
│                 │                                                │
│  Sort By        │                                                │
│  ○ Alpha Score  │                                                │
│  ○ Win Rate     │                                                │
│  ○ Most Active  │                                                │
│  ○ Newest       │                                                │
│                 │                                                │
│  Asset Class    │                                                │
│  □ Equities     │                                                │
│  □ Crypto       │                                                │
│  □ Options      │                                                │
│  □ Macro        │                                                │
│                 │                                                │
│  [Clear Filters]│                                                │
└─────────────────┴────────────────────────────────────────────────┘
```

## 4.2 Featured Sections (Below the Grid)

| Section | Description | Sort Logic |
|---|---|---|
| **Platform Picks** | Curated by the platform team | Manual curation |
| **Trending This Week** | Highest activation count spike in 7 days | Usage velocity |
| **New & Promising** | Recently published with positive early paper results | Publish date + paper performance |
| **Top Creators** | Highest cumulative alpha contribution across all published strategies | Sum of alpha scores × trade count |
| **Best for Sideways Markets** | Top strategies filtered to Choppy regime only | Alpha Score in Choppy regime |

---

# 5. Strategy Card Component

## 5.1 Card Layout

```
┌──────────────────────────────────────────────┐
│  ✅ VERIFIED          [Bull] [High-vol Bull]  │
│                                              │
│  Supply Chain Contagion v2                   │
│  by @quantdev_anik                           │
│                                              │
│  Graph-based propagation signal that detects │
│  cross-company impact from supply disruption │
│  news events in real-time via knowledge graph│
│                                              │
│  ──────────────────────────────────────────  │
│  Alpha Score      Win Rate      Trade Count  │
│    +0.34 ↑          61%            847       │
│  ──────────────────────────────────────────  │
│                                              │
│  [Activate]                  [View Details]  │
└──────────────────────────────────────────────┘
```

## 5.2 Card Elements — Specification

| Element | Content | Rules |
|---|---|---|
| **Badge** | Verified / New / Unverified / Top Rated / Platform Pick / Watch / Delisted | One badge per card; highest earned badge shown |
| **Regime Pills** | Up to 3 active regime labels shown; "+ N more" if more than 3 | Show only active regimes, not inactive ones |
| **Strategy Name** | User-defined name | Max 60 characters |
| **Creator Handle** | @handle with link to creator profile | Always shown |
| **Description** | One-line summary | Max 120 characters; truncated with ellipsis |
| **Alpha Score** | Live from real agent trades | Arrow up (↑) if trending positive; arrow down (↓) if declining |
| **Win Rate** | Live from real agent trades | Shown as percentage; grey if fewer than 60 trades |
| **Trade Count** | Total live agent trades using this strategy | Shows "Paper" label if still in paper period |
| **Activate CTA** | Opens activation modal | Disabled if strategy is in paper period |
| **View Details** | Opens full strategy detail page | Always enabled |

---

# 6. Strategy Detail Page

## 6.1 Header Section

```
Supply Chain Contagion v2                                ✅ VERIFIED
by @quantdev_anik  |  847 agent trades  |  Active in 1,243 portfolios

Tags: [Supply Chain]  [Graph Agent]  [News Catalyst]  [Short]

[Activate in Autonomous Mode]   [Add to Research]   [Bookmark]
```

---

## 6.2 Live Performance Section

```
LIVE PERFORMANCE
Data sourced exclusively from real agent trades — not historical simulation
────────────────────────────────────────────────────────────────────
Alpha Contribution Score        +0.34  ↑  (vs agent baseline per trade)
Win Rate                         61%
Average Win / Average Loss       1.72 : 1
Total Agent Trades               847
Portfolios Currently Active      1,243
Active Since                     November 2025
Last Trade                       April 27, 2026 — 09:47 AM

Performance over time: [30D]  [90D]  [6M]  [All Time]
  [Chart — Alpha Score trend over selected period]
────────────────────────────────────────────────────────────────────
⚠ Backtest results are shown separately in Section 6.6 below
  and are always labeled as historical simulation
```

---

## 6.3 Regime Performance Breakdown

```
PERFORMANCE BY MARKET REGIME
──────────────────────────────────────────────────────────
Regime               Status      Win Rate    Avg Alpha
Low-vol Bull         ✅ ACTIVE     64%          +0.41
High-vol Bull        ✅ ACTIVE     58%          +0.29
Sideways / Choppy    ❌ INACTIVE   —            —
Low-vol Bear         ✅ ACTIVE     51%          +0.14
High-vol Bear        ❌ INACTIVE   —            —
Crisis / Black Swan  ❌ INACTIVE   —            —
──────────────────────────────────────────────────────────
This strategy self-deactivates in Choppy, High-vol Bear,
and Crisis regimes. Regime gate is enforced automatically.
```

---

## 6.4 Strategy Logic — Human Readable

```
HOW THIS STRATEGY WORKS
────────────────────────────────────────────────────────────────────
ENTRY CONDITION
  A company in the knowledge graph receives a supply disruption
  news event scored by the Signal Agent below -0.50 sentiment.
  The Graph Agent identifies Tier 1 affected companies with
  propagation impact score above 0.40. Signal Agent technical
  module confirms RSI is below 55 on the affected ticker.

EXIT CONDITION
  → Price reaches take-profit target (1.8% from entry)     OR
  → Stop-loss triggered at ATR × 1.5 below entry price     OR
  → Time stop: 48 hours after entry regardless of P&L

RISK PROFILE
  Average position size:        1.8% of portfolio
  Max strategy drawdown:        6.2% (live data)
  Typical trade duration:       4 to 18 hours
  Max simultaneous positions:   3

DATA DEPENDENCIES
  → Graph Agent (required — strategy cannot run without it)
  → Signal Agent Sentiment module (required)
  → Signal Agent Technical module (required)
  → Regime Agent (required — for regime gate)
────────────────────────────────────────────────────────────────────
[View Full Code]       [Open in Visual Builder]       [Fork Strategy]
```

---

## 6.5 Sample Decision Receipts

```
SAMPLE DECISION RECEIPTS
Real past trades where this strategy participated — read-only
────────────────────────────────────────────────────────────────────

TRADE #847  |  AAPL SHORT  |  Apr 01 2026 09:47 AM  |  P&L: +1.4%  ✅

  Trigger:          TSMC chip shortage warning — Bloomberg
  Sentiment Score:  -0.71 (strongly negative)
  Graph Impact:     AAPL scored -1.2% propagation from TSMC node
  This Strategy:    Voted SHORT — confidence 0.71
  Other Agents:     Signal Agent (SHORT 0.68), Regime (Low-vol Bull)
  Orchestrator:     6 of 6 agents agreed — STRONG SIGNAL
  Risk Sizing:      1.9% of portfolio — stop at $209.80
  Outcome:          Exited at target in 6.2 hours
                    [View Full Receipt]

────────────────────────────────────────────────────────────────────

TRADE #831  |  NVDA SHORT  |  Mar 28 2026 11:22 AM  |  P&L: -0.8%  ❌

  Trigger:          Same TSMC shortage — secondary Tier 2 propagation
  Graph Impact:     NVDA scored -0.6% propagation (Tier 2 — lower weight)
  This Strategy:    Voted SHORT — confidence 0.58 (near threshold)
  Other Agents:     Signal Agent (NEUTRAL 0.51), Regime (High-vol Bull)
  Orchestrator:     4 of 6 agents agreed — WEAK SIGNAL (reduced size)
  Risk Sizing:      1.1% of portfolio (reduced by Orchestrator)
  Outcome:          Stopped out at ATR × 1.5 — thesis did not hold
                    [View Full Receipt]

────────────────────────────────────────────────────────────────────
[See All Receipts for This Strategy]
```

---

## 6.6 Backtest Results

```
⚠  HISTORICAL SIMULATION — THIS IS NOT LIVE PERFORMANCE DATA
────────────────────────────────────────────────────────────────────
Backtest Period:     January 2020 — October 2025
Universe Tested:     S&P 500 constituent stocks
Total Instances:     1,847 historical setups identified

Win Rate (simulated):           64%
Max Drawdown (simulated):       8.1%

NOTE: Simulated results use historical data and cannot account for
real-world slippage, market impact, feed latency, or regime shifts
that occur during live trading. Live Alpha Contribution Score is
always the primary metric for evaluating this strategy.
────────────────────────────────────────────────────────────────────
[View Full Backtest Report]
```

---

## 6.7 Creator Profile (Inline)

```
CREATOR
────────────────────────────────────────────────────────────────────
@quantdev_anik

Published Strategies:     4
Total Live Agent Trades:  2,847  (across all strategies)
Avg Alpha Contribution:   +0.26  (across all strategies)
Joined:                   September 2025

Other strategies by this creator:
  → News Velocity Breakout        ✅  Alpha: +0.22  |  412 trades
  → Earnings Drift v3             ✅  Alpha: +0.18  |  234 trades
  → Short Squeeze Detector        🆕  Paper Trading  |  12 paper trades

[View Full Creator Profile]
────────────────────────────────────────────────────────────────────
```

---

## 6.8 Activation Configuration Panel

```
ACTIVATE IN AUTONOMOUS MODE
────────────────────────────────────────────────────────────────────
Portfolio Allocation:
  [  2.0  ]%  of available capital per trade

Regime Gate Overrides:
  ✅ Low-vol Bull       ✅ High-vol Bull
  ✅ Low-vol Bear       ❌ Sideways/Choppy
  ❌ High-vol Bear      ❌ Crisis
  (defaults match creator's recommended settings)

Max Trades Per Day:   [  3  ]

Paper Trading Period:
  ✅ Required — 30 days mandatory before live activation
  Your paper trading will begin immediately after confirming.
  You will be notified when paper period ends and live
  activation is available.

[Confirm & Start Paper Trading]
────────────────────────────────────────────────────────────────────
OR

ADD TO ASSISTED RESEARCH
  Strategy will appear in your research dossier when relevant
  setups are detected. No paper period required for research use.

[Add to Research Mode]
```

---

# 7. Indicator Detail Page

## 7.1 Header

```
Sentiment Velocity Score                              ✅ VERIFIED
by @quantdev_anik  |  Used in 34 strategies  |  Powers 847+ monthly trades

[Import to My Strategy]   [View in Visual Builder]   [Bookmark]
```

## 7.2 Indicator Description

```
WHAT THIS INDICATOR MEASURES
────────────────────────────────────────────────────────────────────
Sentiment Velocity Score measures the rate of change in sentiment
across all news sources for a given ticker over a rolling 6-minute
window. A spike in velocity — positive or negative — precedes
significant price moves in 71% of historical cases.

Output Type:    Scalar  (-1.0 to +1.0)
Update Rate:    Every tick when news arrives; otherwise every minute
Input Sources:  Signal Agent Sentiment module (Bloomberg, Reuters,
                Reddit, Twitter — all sources weighted by reliability)

USAGE IN STRATEGIES
  High positive velocity ( > +0.30 )  → Bullish momentum confirmation
  High negative velocity ( < -0.30 )  → Bearish momentum confirmation
  Near zero velocity ( -0.05 to +0.05 ) → Market indifference signal
────────────────────────────────────────────────────────────────────
[View Computation Code]
```

## 7.3 Usage Statistics

```
USAGE STATS
────────────────────────────────────────────────────────────────────
Strategies using this indicator:    34
Combined agent trades powered:      12,847
Creator attribution:                @quantdev_anik credited on all
                                    34 dependent strategy pages
────────────────────────────────────────────────────────────────────
Strategies currently using this indicator:
  → Supply Chain Contagion v2       by @quantdev_anik
  → Institutional Slipstream        by @tradecraft
  → News Velocity Breakout          by @quantdev_anik
  → [31 more...]
```

---

# 8. Creator Dashboard

## 8.1 Overview Panel

```
CREATOR DASHBOARD — @quantdev_anik
────────────────────────────────────────────────────────────────────
This Month:
  Total agent trades from my strategies:   156
  Cumulative alpha contributed:            +0.31 per trade average
  New activations:                         47 new portfolios
  Current active portfolios:              1,243
────────────────────────────────────────────────────────────────────
```

## 8.2 My Strategies Table

```
MY STRATEGIES
────────────────────────────────────────────────────────────────────
Name                    Status         Alpha Score  Trades   Action
Supply Chain v2         ✅ Live          +0.34        847      [Edit] [Stats]
News Velocity           ✅ Live          +0.22        412      [Edit] [Stats]
Earnings Drift v3       ✅ Live          +0.18        234      [Edit] [Stats]
Short Squeeze Detect    📄 Paper (D18)    —            12p     [Edit] [View]
────────────────────────────────────────────────────────────────────
[+ Create New Strategy]
```

## 8.3 My Indicators Table

```
MY INDICATORS
────────────────────────────────────────────────────────────────────
Name                    Status    Used In    Monthly Trades Powered
Sentiment Velocity      ✅ Live    34 strats  12,847
Supply Impact Score     ✅ Live    18 strats   6,234
────────────────────────────────────────────────────────────────────
[+ Create New Indicator]
```

## 8.4 Performance Analytics

```
PERFORMANCE ANALYTICS
────────────────────────────────────────────────────────────────────
[Chart: Alpha Score trend per strategy — last 90 days]

[Chart: Trade volume per strategy — last 90 days]

Regime breakdown for all my strategies combined:
  Low-vol Bull:    Best performing (avg +0.38 alpha)
  High-vol Bull:   Good (+0.27)
  Low-vol Bear:    Moderate (+0.14)
  Choppy:          Not active (regime gate blocks all)
  Crisis:          Not active
────────────────────────────────────────────────────────────────────
```

---

# 9. Strategy Builder

## 9.1 Visual Builder Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  STRATEGY BUILDER — Visual Mode                                  │
│  Strategy Name: [Untitled Strategy]            [Save] [Backtest] │
├──────────────────────────────────────────────────────────────────┤
│  BLOCK LIBRARY          │  CANVAS                                │
│                         │                                        │
│  INDICATORS             │  ┌──────────────┐                      │
│  [RSI]                  │  │  RSI Block   │──────┐               │
│  [MACD]                 │  │  Period: 14  │      ↓               │
│  [Bollinger]            │  └──────────────┘  ┌──────────────┐    │
│  [ATR]                  │                    │  AND Gate    │    │
│  [Volume]               │  ┌──────────────┐  │              │──→ ENTRY │
│  [VWAP]                 │  │  Sentiment   │──┘  └──────────────┘    │
│                         │  │  Score Block │                         │
│  AGENT DATA             │  │  Source: All │                         │
│  [sentiment.score()]    │  └──────────────┘                         │
│  [regime.current()]     │                                           │
│  [graph.impact()]       │  ┌──────────────┐                         │
│  [institutional.flow()] │  │  Regime Gate │                         │
│                         │  │  Bull only   │                         │
│  CONDITIONS             │  └──────────────┘                         │
│  [AND Gate]             │                                           │
│  [OR Gate]              │  EXIT:                                    │
│  [Threshold]            │  ┌──────────────┐  ┌──────────────┐      │
│  [Regime Gate]          │  │  ATR Stop    │  │  Time Stop   │      │
│                         │  │  × 1.5       │  │  48 hours    │      │
│  RISK                   │  └──────────────┘  └──────────────┘      │
│  [ATR Stop]             │                                           │
│  [Fixed Stop]           │                                           │
│  [Trailing Stop]        │                                           │
│  [Time Stop]            │                                           │
│  [Take Profit]          │                                           │
└─────────────────────────┴──────────────────────────────────────────┘

REGIME CONFIGURATION (below canvas)
────────────────────────────────────────────────────────────────────
Activate this strategy in:
  ✅ Low-vol Bull   ✅ High-vol Bull   ❌ Choppy
  ❌ Low-vol Bear   ❌ High-vol Bear   ❌ Crisis
────────────────────────────────────────────────────────────────────
```

## 9.2 Code Editor Layout

```python
# ATS Strategy — Python DSL
# Strategy: My Custom Strategy
# Author: @username

from ats.agents import sentiment, regime, graph, institutional
from ats.indicators import rsi, macd, atr, volume
from ats.risk import stop_loss, take_profit, time_stop

# ── Regime Gate ────────────────────────────────────────────────────
ACTIVE_REGIMES = [
    regime.LOW_VOL_BULL,
    regime.HIGH_VOL_BULL,
]

# ── Entry Signal ───────────────────────────────────────────────────
def compute_indicators(ticker, timeframe="1D"):
    return {
        "rsi":           rsi(ticker, period=14),
        "sentiment":     sentiment.score(ticker),
        "sent_velocity": sentiment.velocity(ticker, window="6min"),
        "graph_impact":  graph.impact(ticker),
        "inst_flow":     institutional.flow(ticker),
    }

def signal(indicators):
    """
    Returns: "LONG" | "SHORT" | "NEUTRAL"
    Confidence: float between 0.0 and 1.0
    """
    bullish = (
        indicators["sentiment"] > 0.40 and
        indicators["sent_velocity"] > 0.25 and
        indicators["rsi"] < 65 and
        indicators["inst_flow"] == "LONG"
    )
    if bullish:
        confidence = (
            indicators["sentiment"] * 0.40 +
            indicators["sent_velocity"] * 0.35 +
            (1 - indicators["rsi"] / 100) * 0.25
        )
        return "LONG", min(confidence, 1.0)

    return "NEUTRAL", 0.0

# ── Exit Rules ─────────────────────────────────────────────────────
EXIT_RULES = [
    stop_loss(atr_multiple=1.5),
    take_profit(target_pct=1.8),
    time_stop(hours=48),
]

# ── Risk Parameters ────────────────────────────────────────────────
MAX_POSITION_PCT    = 2.0   # % of portfolio per trade
MAX_SIMULTANEOUS    = 3     # max open positions from this strategy
```

## 9.3 Backtest Interface

```
BACKTEST CONFIGURATION
────────────────────────────────────────────────────────────────────
Date Range:     [Jan 01 2020]  to  [Dec 31 2024]
Universe:       ○ S&P 500   ○ NASDAQ 100   ○ Custom list
                [Paste tickers...]
────────────────────────────────────────────────────────────────────
[Run Backtest]

⚠ SIMULATION RESULTS — NOT LIVE PERFORMANCE
────────────────────────────────────────────────────────────────────
Total Instances Found:    1,847
Win Rate (simulated):     64%
Max Drawdown:             8.1%
────────────────────────────────────────────────────────────────────
[View Trade-by-Trade Log]   [Download CSV]   [Proceed to Publish]
```

---

# 10. Leaderboard Page

## 10.1 Strategy Leaderboard

```
MARKETPLACE LEADERBOARD

[Last 30 Days]  [Last 90 Days]  [6 Months]  [All Time]

STRATEGIES — Ranked by Alpha Contribution Score
────────────────────────────────────────────────────────────────────
Rank  Strategy                       Creator           Alpha  Trades
────────────────────────────────────────────────────────────────────
#1    Supply Chain Contagion v2       @quantdev_anik   +0.34   847
#2    Institutional Slipstream        @tradecraft      +0.29  1,204
#3    News Velocity Breakout          @quantdev_anik   +0.22   412
#4    Earnings Drift Pro              @alphalab        +0.19   688
#5    Short Squeeze Radar             @momtrader       +0.17   334
#6    Fed Decision Fade               @macrotrader     +0.15   221
#7    Sector Rotation v4              @cyclical        +0.13   567
#8    PEAD Continuation               @earningspro     +0.11   445
────────────────────────────────────────────────────────────────────
[Load More]
```

## 10.2 Creator Leaderboard

```
CREATORS — Ranked by cumulative alpha across all published strategies
────────────────────────────────────────────────────────────────────
Rank  Creator            Strategies   Avg Alpha   Total Trades
────────────────────────────────────────────────────────────────────
#1    @tradecraft             6          +0.31       4,201
#2    @quantdev_anik          4          +0.26       2,847
#3    @alphalab               9          +0.21       5,112
#4    @momtrader              3          +0.19       1,234
#5    @macrotrader            5          +0.16       2,109
────────────────────────────────────────────────────────────────────
[Load More]
```

## 10.3 Indicator Leaderboard

```
INDICATORS — Ranked by usage across strategies
────────────────────────────────────────────────────────────────────
Rank  Indicator                Creator            Used In  Trades Powered
────────────────────────────────────────────────────────────────────
#1    Sentiment Velocity Score  @quantdev_anik     34 strats  12,847
#2    Dark Pool Intensity       @tradecraft        28 strats   9,234
#3    Supply Tier Impact        @quantdev_anik     18 strats   6,234
#4    Options Sweep Detector    @alphalab          22 strats   8,101
────────────────────────────────────────────────────────────────────
```

---

# 11. My Library Page

```
MY LIBRARY

ACTIVE IN AUTONOMOUS MODE
────────────────────────────────────────────────────────────────────
Strategy                   Allocation   Status       Alpha (My Trades)
Supply Chain Contagion v2     2.0%      ✅ Live         +0.31
News Velocity Breakout        1.5%      ✅ Live         +0.19
Short Squeeze Radar           1.0%      📄 Paper (D18)   —
────────────────────────────────────────────────────────────────────

IN RESEARCH MODE (Assisted)
────────────────────────────────────────────────────────────────────
Strategy                   Added        Last Used
Institutional Slipstream   Mar 12 2026  Today
Earnings Drift Pro         Feb 08 2026  Yesterday
────────────────────────────────────────────────────────────────────

BOOKMARKED (Not Yet Activated)
────────────────────────────────────────────────────────────────────
Strategy                   Creator          Alpha Score
Fed Decision Fade          @macrotrader     +0.15
Sector Rotation v4         @cyclical        +0.13
────────────────────────────────────────────────────────────────────

MY CUSTOM INDICATORS (Imported)
────────────────────────────────────────────────────────────────────
Indicator                  Creator          Used In My Strategies
Sentiment Velocity Score   @quantdev_anik   Supply Chain v2, custom strategy
────────────────────────────────────────────────────────────────────
```

---

# 12. Content Rules & Quality Gates

## 12.1 Mandatory Requirements to Publish

| Requirement | Rule | Enforcement |
|---|---|---|
| Regime gate | At least one regime must be explicitly set — cannot be "active in all regimes" | Automated — blocks publish if missing |
| Stop-loss | Every strategy must define at least one exit condition with loss protection | Automated — blocks publish if missing |
| Backtest coverage | Minimum 100 historical instances must be found in backtest | Automated — blocks publish if not met |
| Description | Must be human-readable, not raw code or jargon only | Manual review for flagged submissions |
| Connected wallet | Creator must have a connected wallet before publishing | Automated gate at publish step |
| Naming | No impersonation of platform-curated strategies, no misleading names | Manual review if flagged by other users |

## 12.2 Ongoing Monitoring Rules

| Condition | Action |
|---|---|
| Alpha Score goes negative over 60 trades | Strategy receives ⚠ WATCH badge automatically |
| Alpha Score stays negative for 90 days | Strategy reviewed for DELISTED status |
| Strategy produces 3+ trades with > 5x expected loss in 30 days | Automatic pause + creator notification |
| Creator deletes a strategy with > 100 active portfolios | 30-day notice period enforced before deletion |
| User reports misleading description | Manual review within 48 hours |

---

# 13. Badge System

| Badge | Label | Criteria |
|---|---|---|
| 🆕 | **NEW — Paper Trading** | Published; mandatory paper trading period active (0–60 live trades) |
| ⚪ | **UNVERIFIED** | 60+ live trades completed; Alpha Score neutral or negative |
| ✅ | **VERIFIED** | 60+ live trades with consistently positive Alpha Contribution Score |
| ⭐ | **TOP RATED** | Top 10% Alpha Score sustained over 6+ consecutive months |
| 🏆 | **PLATFORM PICK** | Manually curated by platform team; exceptional risk-adjusted performance |
| ⚠️ | **WATCH** | Previously verified; Alpha Score has declined significantly in last 90 days |
| ❌ | **DELISTED** | Removed due to sustained negative alpha, policy violation, or creator request |

> **No badge can be purchased. Every badge is earned from real trade outcomes.**

---

# 14. Navigation Structure

```
MARKETPLACE
├── Home                    (browse + search + featured)
├── Strategies              (filtered view — strategies only)
├── Indicators              (filtered view — indicators only)
├── Leaderboard
│   ├── Strategies
│   ├── Creators
│   └── Indicators
├── My Library
│   ├── Active (Autonomous)
│   ├── Research Mode
│   ├── Bookmarked
│   └── My Indicators
└── Creator Dashboard       (visible only to users who have published)
    ├── My Strategies
    ├── My Indicators
    ├── Analytics
    └── Strategy Builder
        ├── Visual Builder
        └── Code Editor
```

---

# 15. Core Design Principle

> **The marketplace is a meritocracy.** Every performance number — Alpha Score, Win Rate, Trade Count — is derived exclusively from real agent trades on real capital. A strategy cannot buy a better ranking. It cannot pay for a verified badge. It cannot advertise its way to the top of the leaderboard.
>
> A strategy rises in the marketplace by doing exactly one thing: **producing positive outcomes when real agents use it on real trades**.
>
> This trust is the entire product. The moment performance numbers are allowed to be gamed or inflated — by cherry-picked backtests, by fake trade injection, by paid promotion — the marketplace loses its reason to exist. Every design decision in this specification exists to protect that one principle.

---

*Agentic Trading System — Marketplace Design Specification v1.0 — April 2026*  
*CONFIDENTIAL — FOR RESEARCH AND EDUCATIONAL USE*
