# Phase 5 — Agent 5: Risk Management Agent
> **Depends on:** Phase 2 (market:btc_vol, market:funding_rate, regime:current in Redis), Phase 3 (SignalVote), Phase 4 (GraphVote)
> **Unlocks:** Phase 6 (Orchestrator routes to Execution only if Risk approves)
> **Estimated effort:** 2 days

## Goal

Build the only agent that can unconditionally stop a trade. Agent 5 evaluates 10 rules in strict sequence — the first failure immediately returns a veto with a reason code. No overrides, no user-configurable exceptions. Rules 1–5 are binary gates. Rules 6–10 are progressive size calculations.

The output is either a full position spec (token amount, USD size, stop-loss price, take-profit price) or a veto with a code explaining why.

## What gets built

- `ats/agents/agent5_risk.py` — main risk agent, implements all 10 rules
- `ats/agents/risk/kelly.py` — Kelly criterion calculator
- `ats/agents/risk/portfolio_reader.py` — reads portfolio state from Redis

## File structure to create

```
ats/agents/
  agent5_risk.py
  risk/
    __init__.py
    kelly.py
    portfolio_reader.py
```

---

## Step-by-step implementation

### Step 1 — Portfolio state reader

```python
# ats/agents/risk/portfolio_reader.py
from dataclasses import dataclass
from ats.data.redis_client import get_json, get_float

@dataclass
class PortfolioState:
    total_value_usd: float
    cash_usd: float
    daily_drawdown_pct: float           # e.g. 0.032 = 3.2% down today
    protocol_category_weights: dict[str, float]   # {"defi_lending": 0.14, ...}
    open_positions: list[dict]

async def read_portfolio() -> PortfolioState:
    data = await get_json("portfolio:state")
    if data is None:
        # Default for first run before any trades
        return PortfolioState(
            total_value_usd=10_000.0,
            cash_usd=10_000.0,
            daily_drawdown_pct=0.0,
            protocol_category_weights={},
            open_positions=[],
        )
    return PortfolioState(**data)
```

### Step 2 — Kelly criterion calculator

```python
# ats/agents/risk/kelly.py

MAX_POSITION_PCT = 0.08        # hard cap at 8% regardless of Kelly output
KELLY_FRACTION   = 0.25        # quarter-Kelly for conservatism
BTC_VOL_THRESHOLD = 0.35       # 35% annualized vol triggers 50% size cut
BTC_VOL_MULTIPLIER = 0.50
MIN_POSITION_USD = 50.0        # absolute minimum trade size

def kelly_fraction(win_prob: float, reward_risk_ratio: float) -> float:
    """f* = (p*b - q) / b"""
    p = win_prob
    q = 1 - p
    b = reward_risk_ratio
    f_star = (p * b - q) / b
    return max(0.0, f_star * KELLY_FRACTION)

def apply_multipliers(
    base_fraction: float,
    btc_vol: float,
    regime: str,
) -> float:
    REGIME_MULTIPLIERS = {
        "low_vol_bull":  1.00,
        "high_vol_bull": 0.70,
        "choppy":        0.50,
        "bear":          0.40,
        "high_vol_bear": 0.20,
        "crisis":        0.00,
    }
    fraction = base_fraction
    if btc_vol > BTC_VOL_THRESHOLD:
        fraction *= BTC_VOL_MULTIPLIER
    fraction *= REGIME_MULTIPLIERS.get(regime, 0.50)
    return min(fraction, MAX_POSITION_PCT)

def compute_stop_loss(entry_price: float, direction: str, stop_pct: float = 0.02) -> float:
    if direction == "LONG":
        return round(entry_price * (1 - stop_pct), 6)
    return round(entry_price * (1 + stop_pct), 6)

def compute_take_profit(entry_price: float, direction: str,
                         reward_risk: float = 2.0, stop_pct: float = 0.02) -> float:
    target_pct = stop_pct * reward_risk
    if direction == "LONG":
        return round(entry_price * (1 + target_pct), 6)
    return round(entry_price * (1 - target_pct), 6)
```

### Step 3 — Agent 5: the 10-rule evaluator

```python
# ats/agents/agent5_risk.py
from ats.agents.risk.kelly import (
    kelly_fraction, apply_multipliers,
    compute_stop_loss, compute_take_profit, MIN_POSITION_USD,
)
from ats.agents.risk.portfolio_reader import read_portfolio
from ats.data.redis_client import get_json, get_float
from ats.models.state import AgentState, RiskDecision

# Hard limits
DAILY_DRAWDOWN_HALT   = 0.05    # 5%
MIN_CONFIDENCE        = 0.60
MAX_CATEGORY_WEIGHT   = 0.20    # 20% per protocol category
MAX_RISK_PER_TRADE    = 0.02    # 2% of portfolio

# Protocol category mapping
PROTOCOL_CATEGORIES: dict[str, str] = {
    "AAVE":   "defi_lending",
    "COMP":   "defi_lending",
    "WBTC":   "wrapped_btc",
    "CRV":    "defi_dex",
    "CVX":    "defi_dex",
    "ETH":    "layer1",
    "BTC":    "layer1",
    "STETH":  "liquid_staking",
    "RETH":   "liquid_staking",
    "USDC":   "stablecoin",
}

BEAR_REGIMES = {"bear", "high_vol_bear", "crisis"}

class Agent5Risk:
    async def evaluate(self, state: AgentState) -> RiskDecision:
        portfolio = await read_portfolio()
        btc_vol   = await get_float("market:btc_vol") or 0.30
        price     = await get_float(f"price:{state.trigger_ticker}") or 0.0
        regime    = state.regime or "choppy"
        signal    = state.signal_vote

        def veto(code: str) -> RiskDecision:
            return RiskDecision(approved=False, veto_code=code,
                                btc_vol_at_decision=btc_vol,
                                regime_at_decision=regime)

        # Rule 1 — Crisis mode: hard halt, no exceptions
        if regime == "crisis":
            return veto("crisis_mode_active")

        # Rule 2 — Daily drawdown circuit breaker
        if portfolio.daily_drawdown_pct >= DAILY_DRAWDOWN_HALT:
            return veto("daily_drawdown_limit")

        # Rule 3 — Signal confidence must clear minimum threshold
        if not signal or signal.confidence < MIN_CONFIDENCE:
            return veto("confidence_too_low")

        # Rule 4 — Direction must not conflict with regime
        if signal.direction == "LONG" and regime in BEAR_REGIMES:
            return veto("direction_regime_conflict")

        # Rule 5 — Protocol category concentration check
        category = PROTOCOL_CATEGORIES.get(state.trigger_ticker.upper(), "other")
        current_weight = portfolio.protocol_category_weights.get(category, 0.0)
        if current_weight >= MAX_CATEGORY_WEIGHT:
            return veto("category_limit_reached")

        # Rule 6 — Kelly sizing
        REWARD_RISK = 2.0
        f_star = kelly_fraction(signal.confidence, REWARD_RISK)
        position_pct = apply_multipliers(f_star, btc_vol, regime)
        position_usd = portfolio.total_value_usd * position_pct

        if position_usd < MIN_POSITION_USD:
            return veto("position_too_small")

        # Rules 7 & 8 already applied inside apply_multipliers()

        # Rule 9 — Max risk per trade (2% of portfolio)
        max_risk_usd = portfolio.total_value_usd * MAX_RISK_PER_TRADE
        if position_usd > max_risk_usd / 0.02:   # 2% stop → position can be 100× stop
            position_usd = max_risk_usd / 0.02
            position_pct = position_usd / portfolio.total_value_usd

        # Rule 10 — Zero shares guard
        if price <= 0:
            return veto("price_unavailable")
        token_amount = position_usd / price
        if token_amount <= 0:
            return veto("zero_shares_after_sizing")

        return RiskDecision(
            approved=True,
            shares=round(token_amount, 6),
            size_usd=round(position_usd, 2),
            position_pct=round(position_pct, 4),
            stop_loss_price=compute_stop_loss(price, signal.direction),
            take_profit_price=compute_take_profit(price, signal.direction, REWARD_RISK),
            btc_vol_at_decision=btc_vol,
            regime_at_decision=regime,
        )
```

---

## Validation checklist

- [ ] `evaluate()` returns veto with `crisis_mode_active` when regime = "crisis"
- [ ] `evaluate()` returns veto with `daily_drawdown_limit` when portfolio down ≥ 5%
- [ ] `evaluate()` returns veto with `confidence_too_low` when signal confidence < 0.60
- [ ] LONG signal in bear regime returns `direction_regime_conflict`
- [ ] With normal inputs (confidence 0.70, regime `choppy`, btc_vol 0.38): position_pct ≈ 2.7% (verify Kelly math manually)
- [ ] `stop_loss_price` for SHORT is above entry price, for LONG is below entry price
- [ ] `position_usd` is hard-capped at 8% of portfolio regardless of Kelly output

## What Phase 6 needs from this phase

- `Agent5Risk.evaluate(state: AgentState) -> RiskDecision` async method
- `RiskDecision` model with `approved`, `veto_code`, `shares`, `size_usd`, `stop_loss_price`, `take_profit_price`
- All 10 rules correctly implemented and sequenced
