# ATS Marketplace MVP

**Document Type:** MVP Product and Implementation Spec  
**Goal:** Build a real marketplace slice, not a simple listing page  
**MVP Promise:** Users can build, publish, discover, activate, and execute marketplace strategies with receipts and safety controls.  

---

# 0. Execution Flow Constraint

The MVP must not change the current execution flow.

Today, after a user builds a strategy, the strategy can place a trade through the existing DEX path. The marketplace should not replace that path, rewrite routing, or introduce a separate trade execution engine.

The marketplace adds:

- Strategy and indicator publishing.
- Marketplace discovery.
- User activation and permissions.
- Allocation and risk settings.
- Paper/live eligibility gates.
- Receipts and performance tracking.

When a marketplace strategy is activated and produces a valid signal, it should hand off to the same existing strategy-builder-to-DEX execution flow already used by the app.

---

# 1. MVP Summary

The MVP should prove the main marketplace loop:

```text
creator builds strategy or indicator
-> creator publishes it
-> user discovers it
-> user activates it
-> strategy produces a trade signal
-> user executes or auto-executes within limits
-> receipt records the outcome
-> marketplace displays performance
```

This MVP should not attempt the complete six-agent autonomous platform. It should still include the important marketplace primitives:

- Strategy builder.
- Indicator builder.
- Publishing workflow.
- Marketplace listing.
- Strategy detail page.
- Activation settings.
- Paper execution.
- Controlled live execution.
- Decision Receipts.
- Basic performance stats.
- Admin pause/delist controls.

---

# 2. MVP Product Boundary

## 2.1 In Scope

### Creator Features

- Create a strategy.
- Create an indicator.
- Save drafts.
- Validate strategy logic.
- Validate indicator logic.
- Run basic backtest.
- Publish strategy to marketplace.
- Publish indicator to marketplace.
- Create new immutable strategy version when editing a published strategy.
- View creator dashboard with strategy status and usage.

### Consumer Features

- Browse marketplace strategies.
- Browse marketplace indicators.
- Search and filter strategies.
- Open strategy detail page.
- Open indicator detail page.
- Bookmark strategies.
- Activate marketplace strategy.
- Configure allocation and execution limits.
- Run activated strategy in paper mode.
- Run eligible strategy in live mode.
- Pause or remove activation.
- View Decision Receipts.

### Execution Features

- Strategy can generate a signal.
- Risk engine checks allocation, max trades, daily loss, slippage, and regime gate.
- Existing DEX execution flow prepares quote, route, and transaction.
- User can choose confirmation-required or auto-execute.
- Paper execution simulates fills.
- Live execution uses the existing strategy-builder-to-DEX execution path.
- Every execution creates a receipt.

### Platform Features

- Basic admin review.
- Pause strategy.
- Delist strategy.
- Mark strategy as watch.
- See reported listings.
- Separate backtest, paper, and live performance.

## 2.2 Out Of Scope For MVP

- Full six-agent consensus trading.
- Advanced Alpha Contribution Score.
- Paid strategy monetization.
- Creator payouts.
- Multi-chain launch.
- Full social graph.
- Public comments and reviews.
- NFT receipt minting.
- Complex ML model marketplace.
- Advanced anti-Sybil system.
- Institutional data feeds.

These can come later. The MVP should first prove that users want to create, publish, activate, and execute reusable strategies.

---

# 3. MVP Roles

| Role | Permissions |
|---|---|
| Visitor | Browse public marketplace listings. |
| Connected User | Bookmark, activate, execute, view receipts. |
| Creator | Create and publish strategies/indicators. |
| Admin | Pause, delist, review reports, override unsafe content. |

For MVP, every connected user can become a creator after accepting creator terms.

---

# 4. MVP Pages

## 4.1 Marketplace Home

Required:

- Search input.
- Strategy tab.
- Indicator tab.
- Filter by status, risk level, asset/pair, tag.
- Sort by newest, most activated, best paper performance, best live performance.
- Strategy cards.
- Indicator cards.

Strategy card fields:

- Name.
- Creator.
- Badge.
- Short description.
- Asset/pair support.
- Risk level.
- Status.
- Paper trades.
- Live trades.
- Paper PnL.
- Live PnL.
- Activate button.

Indicator card fields:

- Name.
- Creator.
- Output type.
- Used in strategy count.
- Import button.

## 4.2 Strategy Detail Page

Required:

- Strategy header.
- Creator profile summary.
- Status badge.
- Activate button.
- Logic summary.
- Entry conditions.
- Exit conditions.
- Risk limits.
- Supported assets/pairs.
- Required indicators.
- Backtest results tab.
- Paper results tab.
- Live results tab.
- Receipt examples.
- Version history.
- Report listing button.

## 4.3 Indicator Detail Page

Required:

- Indicator header.
- Creator.
- Output type.
- Input requirements.
- Calculation summary.
- Example output.
- Strategies using the indicator.
- Version history.
- Import button.

## 4.4 Strategy Builder

MVP should support a structured form builder first. A visual canvas can come later.

Sections:

- Metadata.
- Asset/pair selection.
- Indicator selection.
- Entry rules.
- Exit rules.
- Regime gates.
- Risk settings.
- Validation panel.
- Backtest panel.
- Publish panel.

Rule builder should support:

- Indicator comparison: RSI < 30.
- Price comparison: price > moving average.
- Boolean AND/OR groups.
- Take-profit.
- Stop-loss.
- Time stop.
- Max trades per day.

## 4.5 Indicator Builder

MVP options:

- Formula indicator.
- Threshold indicator.
- Imported platform indicator wrapper.

Required fields:

- Name.
- Description.
- Output type.
- Inputs.
- Formula or calculation.
- Example output.
- Test button.
- Publish button.

## 4.6 My Library

Required:

- Active live strategies.
- Active paper strategies.
- Bookmarks.
- Imported indicators.
- Pause activation.
- Edit activation limits.
- View receipts.

## 4.7 Creator Dashboard

Required:

- My drafts.
- My published strategies.
- My indicators.
- Status per strategy.
- Activation count.
- Paper trade count.
- Live trade count.
- Basic PnL.
- Create strategy button.
- Create indicator button.

## 4.8 Receipt Detail

Required:

- Strategy name and version.
- Activation mode.
- Asset/pair.
- Signal.
- Input values.
- Risk checks.
- Execution status.
- Fill or simulated fill.
- Fees.
- Slippage.
- PnL when closed.
- Failure reason if blocked.

---

# 5. MVP Strategy Model

## 5.1 Strategy Requirements

A strategy cannot be published unless it has:

- Name.
- Description.
- Creator.
- Asset/pair list.
- At least one entry condition.
- At least one exit condition.
- Stop-loss.
- Risk limit.
- Regime gate.
- Valid indicator references.
- Backtest run.

## 5.2 Strategy Statuses

| Status | Meaning |
|---|---|
| Draft | Creator is still editing. |
| Validated | Logic compiles and passes required checks. |
| Published | Visible in marketplace. |
| Paper Only | Users can activate for paper execution. |
| Live Eligible | Users can activate for live execution. |
| Watch | Strategy remains visible but gets warnings. |
| Paused | No new signals or execution. |
| Delisted | Hidden from marketplace. |

## 5.3 Live Eligibility In MVP

A strategy becomes live eligible when:

- It has passed validation.
- It has at least 30 paper trades or 14 days of paper runtime.
- It has a stop-loss.
- It has no unresolved admin flags.
- Its paper max drawdown is below the platform limit.
- Creator has not changed the strategy logic after paper approval.

If the creator edits logic, a new version must repeat the paper requirement.

---

# 6. MVP Indicator Model

## 6.1 Indicator Requirements

An indicator cannot be published unless it has:

- Name.
- Description.
- Output type.
- Input data requirements.
- Formula or calculation.
- Example output.
- Validation result.

## 6.2 MVP Indicator Types

| Type | Example |
|---|---|
| Scalar | RSI value, normalized sentiment, volatility score. |
| Boolean | Volume spike true/false. |
| Direction | Long, short, neutral. |

## 6.3 Indicator Usage

MVP must support:

- Importing published indicators into a strategy.
- Showing indicator dependencies on strategy pages.
- Showing which strategies use an indicator.
- Locking strategy versions to specific indicator versions.

---

# 7. MVP Execution Flow

This section describes marketplace orchestration only. It does not replace the app's current DEX execution flow.

## 7.1 Activation Flow

```text
user clicks Activate
-> chooses Paper or Live if available
-> sets allocation
-> sets max trades per day
-> sets max daily loss
-> sets slippage tolerance
-> chooses confirmation-required or auto-execute
-> confirms activation
-> strategy appears in My Library
```

## 7.2 Signal Flow

```text
market data or manual evaluation starts
-> load active user strategies
-> compute indicators
-> evaluate entry/exit rules
-> produce signal
-> run safety checks
-> create pending execution request for the existing DEX flow
```

## 7.3 Paper Execution

Paper execution should:

- Use current market quote.
- Apply estimated slippage.
- Apply estimated fees.
- Simulate fill.
- Track open position.
- Trigger exit rules.
- Calculate PnL.
- Write receipt.

## 7.4 Live Execution

Live execution should:

- Require connected wallet.
- Require live-eligible strategy.
- Require active user activation.
- Check allocation and balance.
- Use the existing DEX quote/route logic.
- Check slippage.
- If confirmation-required, ask user before trade.
- If auto-execute, execute only within pre-approved limits.
- Write receipt immediately.

For the first MVP, live execution should use the app's existing supported chain, strategy builder, and DEX swap/trade route. Do not launch multiple execution venues at once, and do not rewrite the current execution path.

## 7.5 Safety Checks

Block execution when:

- Strategy is not active.
- Strategy version is not eligible.
- Activation is paused.
- Daily trade count is exceeded.
- Daily loss limit is exceeded.
- Position size exceeds allocation.
- Slippage exceeds user setting.
- Stop-loss is missing.
- Asset/pair is not allowed.
- Wallet is disconnected for live execution.
- Admin paused the listing.

---

# 8. MVP Data Model

## 8.1 Tables

| Table | MVP Need |
|---|---|
| `users` | User identity and wallet. |
| `strategies` | Marketplace listing metadata. |
| `strategy_versions` | Immutable strategy logic. |
| `indicators` | Indicator listing metadata. |
| `indicator_versions` | Immutable indicator logic. |
| `strategy_indicator_dependencies` | Strategy to indicator mapping. |
| `activations` | User strategy settings. |
| `backtest_runs` | Basic historical simulation. |
| `executions` | Paper and live trade records. |
| `decision_receipts` | User-visible audit trail. |
| `reports` | User reports. |
| `admin_actions` | Admin moderation history. |

## 8.2 Strategy Version Payload

```json
{
  "sourceType": "form",
  "assetPairs": ["WAVAX/USDC"],
  "regimeGates": ["bull", "sideways"],
  "entry": {
    "all": [
      { "indicator": "rsi_14", "operator": "<", "value": 35 },
      { "indicator": "volume_spike", "operator": "==", "value": true }
    ]
  },
  "exit": {
    "any": [
      { "type": "take_profit", "percent": 2.0 },
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

## 8.3 Activation Payload

```json
{
  "strategyVersionId": "strategy-version-id",
  "mode": "paper",
  "allocationPct": 5,
  "maxPositionPct": 2,
  "maxTradesPerDay": 3,
  "maxDailyLossPct": 3,
  "slippageBps": 75,
  "requiresConfirmation": true
}
```

---

# 9. MVP API Routes

## 9.1 Marketplace

```text
GET /api/marketplace/strategies
GET /api/marketplace/strategies/:id
GET /api/marketplace/indicators
GET /api/marketplace/indicators/:id
```

## 9.2 Builder And Publishing

```text
POST /api/creator/strategies
PATCH /api/creator/strategies/:id
POST /api/creator/strategies/:id/validate
POST /api/creator/strategies/:id/backtest
POST /api/creator/strategies/:id/publish

POST /api/creator/indicators
PATCH /api/creator/indicators/:id
POST /api/creator/indicators/:id/validate
POST /api/creator/indicators/:id/publish
```

## 9.3 Activation And Execution

```text
POST /api/activations
GET /api/activations
PATCH /api/activations/:id
POST /api/activations/:id/pause
POST /api/activations/:id/evaluate
POST /api/activations/:id/execute
GET /api/activations/:id/receipts
GET /api/receipts/:id
```

## 9.4 Admin

```text
GET /api/admin/reports
POST /api/admin/strategies/:id/pause
POST /api/admin/strategies/:id/delist
POST /api/admin/reports/:id/resolve
```

---

# 10. MVP Performance Metrics

For MVP, keep scoring honest and simple.

Show separately:

- Backtest PnL.
- Paper PnL.
- Live PnL.
- Trade count.
- Win rate.
- Average win.
- Average loss.
- Max drawdown.
- Current status.

Do not launch full Alpha Contribution Score in MVP unless the baseline methodology is finished.

Instead, use:

| Metric | Source |
|---|---|
| Backtest PnL | Historical simulation. |
| Paper PnL | Paper executions. |
| Live PnL | Real executions. |
| Paper win rate | Paper receipts. |
| Live win rate | Live receipts. |
| Max drawdown | Receipt history. |
| Trade count | Executions. |

Label each metric clearly.

---

# 11. MVP Badges

| Badge | Criteria |
|---|---|
| New | Published less than 14 days ago. |
| Paper | Strategy can run in paper mode. |
| Live Eligible | Passed MVP live eligibility checks. |
| Active | Has at least one user activation. |
| Watch | Performance or report warning. |
| Paused | Execution blocked. |

Do not use Verified in MVP unless there is enough live history and a strong scoring method.

---

# 12. MVP Admin And Safety

Admin must be able to:

- View all published strategies.
- View all published indicators.
- Pause strategy.
- Delist strategy.
- Resolve user reports.
- See strategy receipts.
- See creator history.

Automatic safety rules:

- Pause live execution if a strategy has 3 failed executions in a row.
- Pause live execution if max drawdown exceeds platform limit.
- Move to Watch if users report misleading description.
- Block publish if stop-loss is missing.
- Block publish if validation fails.

---

# 13. MVP Build Order

## Milestone 1 - Data Model And Marketplace Shell

- Create database tables.
- Add marketplace navigation.
- Add strategy listing page.
- Add indicator listing page.
- Add detail pages with mock metrics.

## Milestone 2 - Creator Builder

- Add strategy create/edit form.
- Add indicator create/edit form.
- Add validation.
- Add draft saving.
- Add publish flow.
- Add immutable version creation.

## Milestone 3 - Activation

- Add Activate modal.
- Add My Library page.
- Add activation settings.
- Add pause/resume activation.

## Milestone 4 - Paper Execution

- Add strategy evaluator.
- Add indicator evaluator.
- Add paper execution engine.
- Add paper receipts.
- Add paper performance metrics.

## Milestone 5 - Controlled Live Execution

- Connect marketplace activation to the existing strategy-builder-to-DEX execution flow.
- Add live eligibility gate.
- Add user confirmation flow.
- Add live receipts.
- Add safety blocking.

## Milestone 6 - Admin And Quality

- Add admin strategy list.
- Add pause/delist.
- Add report listing.
- Add watch badge.
- Add audit logs.

---

# 14. MVP Acceptance Criteria

The marketplace MVP is complete when:

- A creator can create a strategy.
- A creator can create an indicator.
- A creator can publish both to the marketplace.
- A published strategy appears in the marketplace.
- A published indicator appears in the marketplace.
- A strategy can use a published indicator.
- A user can activate a marketplace strategy.
- A user can configure risk and allocation for that strategy.
- A paper activation can execute simulated trades.
- A live-eligible activation can execute a real trade through the existing strategy-builder-to-DEX flow.
- Every paper and live execution creates a receipt.
- The user can inspect receipts from My Library.
- Strategy pages show separate backtest, paper, and live metrics.
- Admin can pause or delist unsafe strategies.

---

# 15. MVP Product Test Script

Use this script to test the end-to-end MVP:

1. Connect wallet.
2. Open Creator Dashboard.
3. Create indicator named `Volume Spike`.
4. Publish indicator.
5. Create strategy named `RSI Bounce With Volume Spike`.
6. Import `Volume Spike`.
7. Add entry rule: RSI below 35 and Volume Spike is true.
8. Add exit rules: stop-loss 0.8 percent, take-profit 2 percent, time stop 24 hours.
9. Select supported pair.
10. Run validation.
11. Run backtest.
12. Publish strategy.
13. Open Marketplace.
14. Find the strategy.
15. Open Strategy Detail.
16. Activate in paper mode.
17. Trigger evaluation.
18. Confirm paper execution receipt appears.
19. Mark strategy live eligible as admin after paper requirement.
20. Activate in live mode with confirmation required.
21. Trigger evaluation.
22. Confirm trade quote appears.
23. Confirm execution.
24. Confirm live receipt appears.
25. Pause strategy as admin.
26. Confirm no new execution can happen.

If this script works, the MVP has the real marketplace loop.
