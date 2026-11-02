# ATS Marketplace - Full Implementation Blueprint

**Document Type:** Product and Engineering Implementation Spec  
**Scope:** Full marketplace for strategies, indicators, activation, execution, receipts, scoring, reputation, and governance  
**Status:** Planning document  

---

# 1. Product Thesis

The ATS marketplace is a trust layer for reusable trading intelligence.

Creators publish strategies and indicators. Users browse them, inspect their logic, review performance, configure risk, and activate them. Activated strategies can participate in paper trading, assisted research, or controlled live execution. Every execution creates a Decision Receipt that explains what happened, what strategy version was used, what the risk settings were, and what the outcome became.

The marketplace is not just a catalog. It is a performance and provenance system.

## 1.1 What The Marketplace Must Enable

- Creators can build strategies with a visual builder or code editor.
- Creators can build reusable indicators.
- Creators can keep strategies private or publish them.
- Users can browse strategies and indicators.
- Users can inspect strategy logic in human-readable form.
- Users can activate any eligible marketplace strategy.
- Users can use activated marketplace strategies to execute trades.
- Users can configure allocation, risk limits, max trades, and execution mode.
- The system validates strategy safety before publishing and before execution.
- The system records every strategy execution in a Decision Receipt.
- The system separates backtest, paper, and live performance.
- The system tracks creator reputation from real usage.

## 1.2 Execution Flow Boundary

The marketplace must not replace the current strategy-builder-to-DEX execution flow.

The marketplace is an orchestration and trust layer around the existing flow:

- It stores published strategies and indicators.
- It lets users discover and activate marketplace strategies.
- It applies activation permissions and marketplace safety gates.
- It records receipts and performance.

When an activated marketplace strategy produces a valid signal, the final trade should be passed into the same DEX execution path already used when a user builds a strategy directly in the app. Marketplace implementation should not rewrite quote routing, swap execution, wallet signing, or DEX transaction submission unless a future execution refactor is explicitly planned.

## 1.3 Marketplace Modes

| Mode | Meaning | Execution Allowed |
|---|---|---|
| Research | Strategy can be used inside assisted analysis and reports. | No |
| Paper | Strategy runs on live market data with simulated fills. | Simulated only |
| Live | Strategy can submit real trades after user activation and platform approval. | Yes |
| Disabled | Strategy is paused, delisted, or blocked by policy. | No |

## 1.4 User Types

| User | Primary Jobs |
|---|---|
| Consumer | Browse, evaluate, activate, execute, review receipts. |
| Creator | Build, test, publish, maintain, fork, and monitor strategies and indicators. |
| Agent/System | Validate, score, hand approved marketplace signals to the existing DEX execution flow, record receipts, update performance. |
| Admin/Reviewer | Review flagged content, pause unsafe strategies, resolve disputes, curate platform picks. |

---

# 2. Marketplace Objects

## 2.1 Strategy

A strategy is complete trading logic. It must define:

- Name, description, tags, asset universe, and creator.
- Entry conditions.
- Exit conditions.
- Direction support: long, short, both, or swap-only depending on venue.
- Regime gates.
- Risk parameters.
- Indicator dependencies.
- Execution constraints.
- Human-readable explanation.
- Machine-readable strategy definition.
- Version history.

## 2.2 Indicator

An indicator is a reusable signal component. It can be used by one or more strategies.

It must define:

- Name and description.
- Creator.
- Input data requirements.
- Output type.
- Calculation logic.
- Update frequency.
- Valid value range.
- Example output.
- Version history.

## 2.3 Strategy Version

Strategies must be immutable after publication. Editing a published strategy creates a new version.

Each version stores:

- Strategy source or visual graph snapshot.
- Compiled execution artifact.
- Validation result.
- Backtest result references.
- Paper result references.
- Approval status.
- Created timestamp.
- Changelog from previous version.

Receipts always reference a specific strategy version.

## 2.4 Activation

An activation is a user's decision to use a strategy.

Activation stores:

- User ID or wallet address.
- Strategy ID and version ID.
- Mode: research, paper, or live.
- Capital allocation.
- Max position size.
- Max trades per day.
- Max daily loss.
- Allowed assets or pools.
- Allowed regimes.
- Execution venue.
- Status.

## 2.5 Decision Receipt

A Decision Receipt is the audit record of a strategy signal and execution.

It stores:

- Strategy ID and version ID.
- User activation ID.
- Trigger source.
- Input snapshot.
- Indicator values.
- Strategy decision.
- Agent or risk checks.
- Execution request.
- Fill or simulated fill.
- Fees and slippage.
- PnL after close.
- User-visible explanation.
- Status and failure reason, if any.

---

# 3. Core User Flows

## 3.1 Creator Builds And Publishes A Strategy

1. Creator opens Builder.
2. Creator chooses Visual Builder or Code Editor.
3. Creator defines entry logic.
4. Creator defines exit logic.
5. Creator selects supported assets or pools.
6. Creator selects allowed regimes.
7. Creator defines risk limits.
8. Creator imports existing indicators or creates new ones.
9. Creator runs compile validation.
10. Creator runs historical backtest.
11. Creator reads warnings and fixes issues.
12. Creator chooses private or marketplace publish.
13. Platform creates immutable version `v1`.
14. If published, the strategy enters Paper status.
15. After required paper activity, the strategy becomes eligible for Live activation.

## 3.2 Creator Publishes An Indicator

1. Creator opens Indicator Builder.
2. Creator defines inputs, output type, and calculation logic.
3. Creator tests the indicator on sample historical and live data.
4. Platform validates type consistency, runtime safety, and documentation.
5. Creator publishes the indicator.
6. Other creators can import it into strategies.
7. Indicator usage appears on the indicator detail page.

## 3.3 User Activates A Marketplace Strategy

1. User opens Marketplace.
2. User filters by asset, regime, risk level, status, creator, and performance.
3. User opens Strategy Detail.
4. User reviews:
   - Strategy description.
   - Human-readable logic.
   - Risk profile.
   - Required indicators.
   - Backtest results.
   - Paper results.
   - Live results, if available.
   - Sample Decision Receipts.
5. User clicks Activate.
6. User chooses mode: Research, Paper, or Live if eligible.
7. User sets allocation and risk controls.
8. Platform validates the activation.
9. Activation appears in My Library.
10. Strategy begins generating signals for that user.

## 3.4 User Executes A Trade With A Marketplace Strategy

1. Strategy receives market data or user-triggered evaluation.
2. Strategy computes indicators.
3. Strategy emits one of:
   - Long.
   - Short.
   - Swap.
   - Exit.
   - Hold.
   - No trade.
4. Risk engine checks the signal against user limits.
5. Regime gate checks current market state.
6. Existing DEX execution flow checks liquidity, route, fees, slippage, and wallet readiness.
7. If all checks pass:
   - Paper mode creates simulated execution.
   - Live mode submits real execution through the existing app execution path.
8. Receipt is written immediately.
9. User sees trade status in My Library and Receipts.
10. Outcome is updated after close or exit.

---

# 4. Marketplace Pages

## 4.1 Marketplace Home

Purpose: browse and discover strategies and indicators.

Required sections:

- Search bar.
- Strategy/indicator tabs.
- Filter panel.
- Sort controls.
- Featured strategies.
- Verified strategies.
- New in paper trading.
- Top creators.
- Recently updated.

Filters:

- Type: strategy or indicator.
- Status: paper, live eligible, verified, watch, delisted hidden by default.
- Asset class or venue.
- Regime compatibility.
- Risk level.
- Strategy direction.
- Creator.
- Tags.
- Minimum trade count.
- Minimum paper period.

## 4.2 Strategy Card

Every strategy card shows:

- Badge.
- Strategy name.
- Creator handle.
- Short description.
- Supported assets or pools.
- Regime tags.
- Risk level.
- Paper/live status.
- Trade count.
- Win rate or paper win rate.
- Alpha Contribution Score when available.
- Activate button.
- View details button.

## 4.3 Strategy Detail

Required sections:

- Header.
- Status and eligibility.
- Activate panel.
- Live/paper/backtest performance separated into different tabs.
- Human-readable strategy logic.
- Risk profile.
- Regime compatibility.
- Indicator dependencies.
- Execution requirements.
- Version history.
- Sample receipts.
- Creator profile.
- Fork button.
- Report button.

## 4.4 Indicator Detail

Required sections:

- Header.
- Output type.
- Inputs.
- Update frequency.
- Formula or logic summary.
- Example values.
- Strategies using this indicator.
- Creator.
- Version history.
- Import button.

## 4.5 Builder

The builder has two creation paths.

### Visual Builder

Must support:

- Indicator blocks.
- Comparison blocks.
- Boolean blocks.
- Regime gate blocks.
- Risk blocks.
- Entry and exit blocks.
- Preview of human-readable logic.
- Validation panel.
- Backtest button.
- Save draft.
- Publish.

### Code Editor

Must support:

- Strategy DSL.
- Syntax validation.
- Type checking.
- Runtime sandboxing.
- Sample data preview.
- Backtest button.
- Save draft.
- Publish.

## 4.6 Creator Dashboard

Required sections:

- Draft strategies.
- Published strategies.
- Paper strategies.
- Live eligible strategies.
- Paused strategies.
- Indicators.
- Performance analytics.
- Strategy version changes.
- User reports and admin notices.

## 4.7 My Library

Required sections:

- Active live strategies.
- Paper strategies.
- Research-only strategies.
- Bookmarks.
- Imported indicators.
- Recent receipts.
- Strategy-level allocation controls.
- Pause/disable buttons.

## 4.8 Receipts

Required views:

- Receipt list.
- Receipt detail.
- Filters by strategy, user activation, asset, date, status, mode.
- Export to CSV/JSON.
- Link back to strategy version.

---

# 5. Strategy Builder Specification

## 5.1 Strategy Definition Schema

Every strategy should compile into a structured definition similar to:

```json
{
  "name": "RSI Momentum With Sentiment Gate",
  "version": "1.0.0",
  "assetUniverse": ["WAVAX/USDC", "WETH/USDC"],
  "modeSupport": ["paper", "live"],
  "directionSupport": ["swap", "exit"],
  "regimeGates": ["low_vol_bull", "high_vol_bull"],
  "inputs": [
    { "id": "rsi_14", "type": "indicator", "indicatorId": "rsi", "params": { "period": 14 } },
    { "id": "sentiment", "type": "indicator", "indicatorId": "sentiment_score" }
  ],
  "entry": {
    "all": [
      { "left": "rsi_14.value", "operator": "<", "right": 35 },
      { "left": "sentiment.value", "operator": ">", "right": 0.2 }
    ]
  },
  "exit": {
    "any": [
      { "type": "take_profit", "percent": 1.8 },
      { "type": "stop_loss", "percent": 0.8 },
      { "type": "time_stop", "hours": 24 }
    ]
  },
  "risk": {
    "maxPositionPct": 2,
    "maxTradesPerDay": 3,
    "maxDailyLossPct": 3,
    "slippageBps": 75
  }
}
```

## 5.2 Required Strategy Fields

| Field | Required | Reason |
|---|---|---|
| Name | Yes | Marketplace identity. |
| Description | Yes | Human understanding. |
| Entry logic | Yes | Defines when to trade. |
| Exit logic | Yes | Defines how risk is closed. |
| Regime gates | Yes | Prevents wrong-environment use. |
| Risk limits | Yes | Protects users and platform. |
| Asset universe | Yes | Prevents unintended execution. |
| Version | Yes | Receipts and scoring need immutability. |

## 5.3 Validation Rules

Strategy publish is blocked if:

- The strategy does not compile.
- Entry logic is missing.
- Exit logic is missing.
- Stop-loss or loss-protection is missing.
- No regime gate is selected.
- Risk limits exceed platform maximum.
- Strategy references an unpublished or incompatible indicator.
- Strategy uses unsupported assets.
- Backtest sample size is below minimum.
- Human-readable explanation cannot be generated.

## 5.4 Runtime Sandbox

Code strategies and custom indicators must run in a sandbox.

Sandbox rules:

- No network access from user code.
- No filesystem access from user code.
- No secrets access.
- No wallet signing access.
- CPU and memory limits.
- Execution timeouts.
- Deterministic output for a given input snapshot.
- Only approved platform modules can be imported.

---

# 6. Indicator Specification

## 6.1 Indicator Output Types

| Type | Example | Use |
|---|---|---|
| Boolean | `true` | Gate or trigger. |
| Scalar | `0.74` | Score, confidence, normalized value. |
| Number | `62.4` | RSI, price, volume. |
| Direction | `long` | Directional signal. |
| Vector | `[0.2, 0.4, 0.1]` | Advanced model or multi-feature output. |
| Object | `{ value, confidence }` | Rich signal output. |

## 6.2 Indicator Validation

Indicator publish is blocked if:

- Output type is not declared.
- Output does not match declared type.
- Required inputs are missing.
- Runtime exceeds limit.
- Documentation is missing.
- Example output is missing.
- Indicator can produce NaN, infinity, or malformed output without fallback.

## 6.3 Indicator Dependency Tracking

The platform must track:

- Which strategies use an indicator.
- Which strategy versions depend on which indicator versions.
- Whether an indicator update creates compatibility issues.
- Whether creator attribution should appear on dependent strategies.

Published strategies should lock indicator versions by default. A creator can opt into upgrading a dependency and then publish a new strategy version.

---

# 7. Activation And Execution

This section describes marketplace activation and safety orchestration. It does not define a replacement execution engine.

## 7.1 Activation Settings

Every activation must include:

- Mode: research, paper, or live.
- Strategy version.
- Capital allocation.
- Max position size.
- Max trades per day.
- Max daily loss.
- Allowed assets.
- Allowed regimes.
- Slippage tolerance.
- Confirmation preference.
- Auto-pause conditions.

## 7.2 Live Execution Eligibility

A strategy version becomes live eligible only when:

- It passed validation.
- It completed required paper trading.
- It has no unresolved safety flags.
- It has a defined risk profile.
- It is not delisted or paused.
- The user explicitly opted into live execution.
- The user's wallet and venue are supported.

## 7.3 Execution Pipeline

```text
market data arrives
-> strategy activation selected
-> strategy version loads
-> indicators compute
-> strategy emits signal
-> regime gate checks
-> risk engine checks
-> existing DEX quote/route logic checks liquidity and slippage
-> user confirmation if required
-> existing strategy-builder-to-DEX execution flow submits trade
-> receipt is written
-> status and outcome are updated
```

## 7.4 Execution Safety

The execution layer must block a trade when:

- Strategy version is not executable.
- Activation is paused.
- User allocation limit would be exceeded.
- Max trades per day would be exceeded.
- Slippage exceeds activation limit.
- Liquidity is insufficient.
- Risk engine rejects the trade.
- Regime gate is inactive.
- Wallet is disconnected.
- Chain or venue does not match activation settings.
- Strategy is under watch with hard pause.

---

# 8. Performance And Scoring

## 8.1 Separate Result Categories

The UI must never merge these:

- Backtest result: historical simulation.
- Paper result: live market data with simulated execution.
- Live result: real execution with real fills.

Each result category must show its data source and limitations.

## 8.2 Alpha Contribution Score

Alpha Contribution Score measures whether a strategy improved results compared with the platform baseline.

The score should be computed per strategy version and per regime.

Inputs:

- Strategy signal.
- Baseline signal without this marketplace strategy.
- Position size.
- Actual fill or simulated fill.
- Fees and slippage.
- Exit result.
- Risk taken.
- Market regime.

Recommended formula:

```text
strategy_contribution =
  risk_adjusted_return_with_strategy
  - risk_adjusted_return_without_strategy_baseline
```

The public score should include:

- Mean contribution.
- Number of trades.
- Confidence interval.
- Regime breakdown.
- Last updated timestamp.
- Whether score is paper or live.

## 8.3 Minimum Sample Rules

Suggested thresholds:

| Status | Requirement |
|---|---|
| New | Published and validation passed. |
| Paper | Running in paper mode. |
| Live Eligible | Minimum paper duration and minimum paper trades reached. |
| Unverified | Live enabled but fewer than minimum live trades. |
| Verified | Minimum live trades plus positive risk-adjusted score. |
| Watch | Score deteriorates or risk incidents occur. |
| Delisted | Sustained poor performance, policy violation, or creator request. |

## 8.4 Anti-Gaming Rules

The platform must protect against:

- Creators cherry-picking backtest windows.
- Strategies overfitting to fixed datasets.
- Creators publishing many tiny variants to find a lucky winner.
- Fake activation or wash usage.
- Signal copying without attribution.
- Risk hiding through rare tail losses.
- Strategies that win often but lose catastrophically.
- Strategies that only work in illiquid assets.

Required mitigations:

- Immutable strategy versions.
- Hidden holdout backtests.
- Minimum sample sizes.
- Confidence intervals.
- Risk-adjusted ranking.
- Duplicate strategy detection.
- Per-creator variant limits or grouping.
- Liquidity-adjusted performance.
- Tail-loss incident display.

---

# 9. Data Model

## 9.1 Core Tables

| Table | Purpose |
|---|---|
| `users` | User profile and wallet identity. |
| `creators` | Creator metadata and reputation. |
| `strategies` | Strategy listing metadata. |
| `strategy_versions` | Immutable versions of strategy logic. |
| `indicators` | Indicator listing metadata. |
| `indicator_versions` | Immutable indicator logic versions. |
| `strategy_indicator_dependencies` | Dependency mapping. |
| `activations` | User activation settings. |
| `backtest_runs` | Historical simulation runs. |
| `paper_runs` | Paper execution records. |
| `execution_orders` | Live or simulated order records. |
| `decision_receipts` | Full audit records. |
| `strategy_scores` | Aggregated score data. |
| `creator_scores` | Creator reputation aggregates. |
| `reports` | User reports and moderation records. |
| `admin_actions` | Pauses, delists, approvals, and reviews. |

## 9.2 Strategy Version Fields

| Field | Type |
|---|---|
| `id` | UUID |
| `strategy_id` | UUID |
| `version` | Semver string |
| `source_type` | `visual` or `code` |
| `source_payload` | JSON |
| `compiled_payload` | JSON |
| `human_summary` | Text |
| `validation_status` | Enum |
| `publish_status` | Enum |
| `created_by` | User ID |
| `created_at` | Timestamp |

## 9.3 Activation Fields

| Field | Type |
|---|---|
| `id` | UUID |
| `user_id` | UUID |
| `strategy_id` | UUID |
| `strategy_version_id` | UUID |
| `mode` | `research`, `paper`, `live` |
| `status` | `active`, `paused`, `blocked`, `completed` |
| `allocation_pct` | Decimal |
| `max_position_pct` | Decimal |
| `max_trades_per_day` | Integer |
| `max_daily_loss_pct` | Decimal |
| `allowed_assets` | JSON |
| `allowed_regimes` | JSON |
| `slippage_bps` | Integer |
| `requires_confirmation` | Boolean |
| `created_at` | Timestamp |

## 9.4 Receipt Fields

| Field | Type |
|---|---|
| `id` | UUID |
| `activation_id` | UUID |
| `strategy_version_id` | UUID |
| `mode` | `paper` or `live` |
| `asset` | String |
| `signal` | JSON |
| `input_snapshot` | JSON |
| `risk_checks` | JSON |
| `execution_request` | JSON |
| `execution_result` | JSON |
| `status` | Enum |
| `failure_reason` | Text |
| `opened_at` | Timestamp |
| `closed_at` | Timestamp |
| `pnl` | Decimal |

---

# 10. API Surface

## 10.1 Marketplace Read APIs

```text
GET /api/marketplace/strategies
GET /api/marketplace/strategies/:id
GET /api/marketplace/strategies/:id/versions
GET /api/marketplace/indicators
GET /api/marketplace/indicators/:id
GET /api/marketplace/creators/:id
GET /api/marketplace/leaderboard
```

## 10.2 Creator APIs

```text
POST /api/creator/strategies
POST /api/creator/strategies/:id/versions
POST /api/creator/strategies/:id/publish
POST /api/creator/indicators
POST /api/creator/indicators/:id/versions
POST /api/creator/indicators/:id/publish
GET  /api/creator/dashboard
```

## 10.3 Validation And Testing APIs

```text
POST /api/strategy/validate
POST /api/strategy/backtest
POST /api/indicator/validate
POST /api/indicator/test
```

## 10.4 Activation And Execution APIs

```text
POST /api/activations
PATCH /api/activations/:id
POST /api/activations/:id/pause
POST /api/activations/:id/resume
POST /api/activations/:id/evaluate
POST /api/activations/:id/execute
GET  /api/activations/:id/receipts
GET  /api/receipts/:id
```

## 10.5 Admin APIs

```text
GET  /api/admin/reports
POST /api/admin/strategies/:id/pause
POST /api/admin/strategies/:id/delist
POST /api/admin/strategies/:id/approve
POST /api/admin/indicators/:id/pause
POST /api/admin/reports/:id/resolve
```

---

# 11. Governance And Trust

## 11.1 Badges

| Badge | Meaning |
|---|---|
| New | Recently published, still in paper period. |
| Paper Passing | Paper results meet minimum safety requirements. |
| Live Eligible | Can be activated for live execution. |
| Verified | Sufficient live history with positive risk-adjusted score. |
| Platform Pick | Manually curated by platform after deeper review. |
| Watch | Score decay or risk issue detected. |
| Paused | Temporarily blocked from new execution. |
| Delisted | Removed from marketplace discovery. |

## 11.2 Moderation

Users can report:

- Misleading descriptions.
- Copied strategies.
- Unsafe behavior.
- Suspicious performance.
- Broken indicators.
- Impersonation.

Admin actions:

- Request creator changes.
- Hide listing.
- Pause new activations.
- Pause all executions.
- Delist strategy.
- Mark badge status.
- Freeze a version.

## 11.3 Creator Reputation

Creator profile should show:

- Published strategies.
- Published indicators.
- Total activations.
- Total receipts.
- Paper performance.
- Live performance.
- Watch incidents.
- Delisted strategies.
- Average score by regime.

---

# 12. Security And Compliance

## 12.1 Security Requirements

- User code must run in a sandbox.
- Strategy execution cannot directly sign transactions.
- Wallet signing must remain isolated in the existing execution flow.
- Strategy outputs must be treated as suggestions until risk checks pass.
- All activation changes must be audited.
- All admin actions must be audited.
- Receipts must be immutable after creation, with outcome appended as a separate update event if needed.
- Secrets must never be exposed to creator code.

## 12.2 Financial Safety Requirements

- Users must explicitly opt in to live execution.
- Default activation should start in paper mode.
- Live execution should have conservative default limits.
- Risk warnings must be visible before activation.
- Strategy performance must not imply guaranteed returns.
- Legal and regulatory review is required before real-money public launch.

---

# 13. Notifications

Users should receive notifications for:

- Strategy activated.
- Paper period started.
- Paper period complete.
- Strategy became live eligible.
- Strategy paused or delisted.
- Strategy generated a signal.
- Trade executed.
- Trade failed.
- Stop-loss triggered.
- Daily loss limit hit.
- Strategy score changed significantly.

Creators should receive notifications for:

- Strategy published.
- Validation failed.
- Paper period complete.
- Strategy verified.
- Strategy moved to watch.
- User report opened.
- Admin action taken.
- Indicator imported by another creator.

---

# 14. Observability

The platform should track:

- Strategy evaluation latency.
- Indicator runtime latency.
- Backtest queue duration.
- Paper execution count.
- Live execution count.
- Execution failures.
- Risk rejection reasons.
- Strategy activation conversion.
- User pause rate.
- Creator publish funnel dropoff.
- Report resolution time.
- Score recomputation jobs.

---

# 15. Rollout Plan

## Phase 1 - Internal Alpha

- Private strategies.
- Private indicators.
- Builder draft flow.
- Backtests.
- Paper trading.
- Receipts.
- No public marketplace.

## Phase 2 - Marketplace Beta

- Public strategy listings.
- Public indicator listings.
- Creator profiles.
- Activation in paper mode.
- Paper performance scoring.
- Basic moderation.

## Phase 3 - Controlled Live Execution

- Live activation for approved strategies.
- Conservative risk limits.
- Manual user confirmation option.
- Live receipts.
- Strategy watch/delist controls.

## Phase 4 - Reputation And Ranking

- Alpha Contribution Score.
- Verified badge.
- Leaderboards.
- Creator reputation.
- Regime breakdown.
- Advanced anti-gaming.

## Phase 5 - Monetization

- Paid strategies.
- Revenue share.
- Subscription tiers.
- Creator payouts.
- Enterprise/private strategy libraries.

---

# 16. Full Implementation Acceptance Criteria

The full marketplace is complete when:

- A creator can build and publish a strategy.
- A creator can build and publish an indicator.
- A strategy can depend on one or more indicators.
- A published strategy has immutable versions.
- A user can browse and activate a marketplace strategy.
- A user can run the strategy in research, paper, or live mode.
- A live strategy can execute a trade through the existing strategy-builder-to-DEX flow.
- Every execution produces a Decision Receipt.
- Backtest, paper, and live performance are separated.
- Strategy scores update from receipts.
- Unsafe strategies can be paused or delisted.
- Users can inspect exactly why a strategy traded.
- Admins can review reports and take action.
- Creators can see performance analytics for their published work.
