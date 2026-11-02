"""
Phase 5 — Agent 5: Risk Management Agent test suite
Covers every item on the validation checklist from doc/phases/phase-5-risk-agent.md

Run:  .venv/bin/python -m pytest tests/test_phase5.py -v
  or: .venv/bin/python tests/test_phase5.py
"""
import asyncio
import sys
from unittest.mock import AsyncMock, patch

# ── helpers ───────────────────────────────────────────────────────────────────

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
_results: list[tuple[str, bool, str]] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    _results.append((name, condition, detail))
    label = PASS if condition else FAIL
    suffix = f"  — {detail}" if detail else ""
    print(f"  [{label}]  {name}{suffix}")


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Kelly criterion — pure math
# ═══════════════════════════════════════════════════════════════════════════════

def test_kelly_fraction():
    from ats.agents.risk.kelly import kelly_fraction

    # p=0.70, b=2.0 → f* = (0.70*2 - 0.30)/2 = 0.55 → quarter-Kelly = 0.1375
    f = kelly_fraction(0.70, 2.0)
    check("kelly_fraction(0.70, 2.0) = 0.1375", abs(f - 0.1375) < 1e-9, f"{f:.6f}")

    # Negative expectation → clamped to 0
    f_neg = kelly_fraction(0.30, 2.0)
    check("kelly_fraction clamps negative to 0.0", f_neg == 0.0, f"{f_neg}")

    # Edge: p=0.60, b=2.0 → f* = (1.2-0.4)/2 = 0.40 → *0.25 = 0.10
    f_min = kelly_fraction(0.60, 2.0)
    check("kelly_fraction(0.60, 2.0) = 0.10", abs(f_min - 0.10) < 1e-9, f"{f_min:.6f}")


def test_apply_multipliers():
    from ats.agents.risk.kelly import apply_multipliers, MAX_POSITION_PCT

    # Validation checklist: confidence=0.70, btc_vol=0.38, regime=choppy → ≈3.44%
    # f*=0.1375, ×0.5 (btc_vol) ×0.5 (choppy) = 0.034375
    pct = apply_multipliers(0.1375, 0.38, "choppy")
    check(
        "apply_multipliers: confidence=0.70, btc_vol=0.38, choppy ≈ 3.44%",
        abs(pct - 0.034375) < 1e-9,
        f"{pct*100:.4f}%",
    )

    # Crisis → 0% regardless of input
    pct_crisis = apply_multipliers(0.1375, 0.20, "crisis")
    check("crisis regime → 0.0 position size", pct_crisis == 0.0, f"{pct_crisis}")

    # Normal vol, low_vol_bull → 1.0 multiplier applied; 0.1375 < 8% cap → unchanged
    pct_bull = apply_multipliers(0.1375, 0.20, "low_vol_bull")
    check(
        "low_vol_bull, normal vol → capped at min(0.1375, 0.08) = 0.08",
        abs(pct_bull - 0.08) < 1e-9,
        f"{pct_bull:.4f}",
    )

    # Hard cap: even a huge fraction is capped at 8%
    pct_cap = apply_multipliers(1.0, 0.10, "low_vol_bull")
    check("apply_multipliers hard cap at 8%", pct_cap == MAX_POSITION_PCT, f"{pct_cap}")

    # high_vol_bull + elevated btc_vol: 0.1375 × 0.5 × 0.7 = 0.048125
    pct_hvb = apply_multipliers(0.1375, 0.38, "high_vol_bull")
    check(
        "high_vol_bull + btc_vol=0.38 → 4.81%",
        abs(pct_hvb - 0.048125) < 1e-9,
        f"{pct_hvb*100:.4f}%",
    )


def test_stop_loss_and_take_profit():
    from ats.agents.risk.kelly import compute_stop_loss, compute_take_profit

    entry = 100.0

    sl_long = compute_stop_loss(entry, "LONG")
    sl_short = compute_stop_loss(entry, "SHORT")
    check("LONG stop-loss is below entry price", sl_long < entry, f"sl={sl_long}")
    check("SHORT stop-loss is above entry price", sl_short > entry, f"sl={sl_short}")
    check("LONG stop-loss = entry × 0.98", abs(sl_long - 98.0) < 1e-6)
    check("SHORT stop-loss = entry × 1.02", abs(sl_short - 102.0) < 1e-6)

    tp_long = compute_take_profit(entry, "LONG")
    tp_short = compute_take_profit(entry, "SHORT")
    check("LONG take-profit is above entry price", tp_long > entry, f"tp={tp_long}")
    check("SHORT take-profit is below entry price", tp_short < entry, f"tp={tp_short}")
    # 2% stop × 2.0 reward/risk = 4% target
    check("LONG take-profit = entry × 1.04", abs(tp_long - 104.0) < 1e-6)
    check("SHORT take-profit = entry × 0.96", abs(tp_short - 96.0) < 1e-6)

    # WBTC example from end-to-end doc: entry=67250, SHORT, stop=68595
    sl_wbtc = compute_stop_loss(67250.0, "SHORT")
    check("WBTC SHORT stop = 67250 × 1.02 = 68595", abs(sl_wbtc - 68595.0) < 1e-3, f"{sl_wbtc}")


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Agent5Risk.evaluate — veto gates (async, Redis mocked)
# ═══════════════════════════════════════════════════════════════════════════════

def _make_state(ticker="BTC", regime="choppy", confidence=0.70, direction="LONG"):
    from ats.models.state import AgentState, SignalVote
    return AgentState(
        trigger_ticker=ticker,
        trigger_event={},
        regime=regime,
        signal_vote=SignalVote(
            direction=direction,
            confidence=confidence,
            sentiment_score=0.5,
            technical_signal=direction,
            regime_used=regime,
        ),
    )


def _make_portfolio(
    total_value_usd=10_000.0,
    cash_usd=10_000.0,
    daily_drawdown_pct=0.0,
    protocol_category_weights=None,
    open_positions=None,
):
    from ats.agents.risk.portfolio_reader import PortfolioState
    return PortfolioState(
        total_value_usd=total_value_usd,
        cash_usd=cash_usd,
        daily_drawdown_pct=daily_drawdown_pct,
        protocol_category_weights=protocol_category_weights or {},
        open_positions=open_positions or [],
    )


async def _evaluate(state, portfolio, btc_vol=0.30, price=100.0):
    """Run Agent5Risk.evaluate with Redis fully mocked."""
    from ats.agents.agent5_risk import Agent5Risk

    async def mock_get_float(key):
        if key == "market:btc_vol":
            return btc_vol
        if key.startswith("price:"):
            return price
        return None

    with patch("ats.agents.agent5_risk.get_float", side_effect=mock_get_float), \
         patch("ats.agents.agent5_risk.read_portfolio", return_value=portfolio):
        agent = Agent5Risk()
        return await agent.evaluate(state)


def test_rule1_crisis_mode():
    print("\n── Rule 1: crisis mode ─────────────────────────────────────────────")
    state = _make_state(regime="crisis", direction="LONG")
    result = asyncio.run(_evaluate(state, _make_portfolio()))
    check("crisis regime → approved=False", not result.approved)
    check("crisis regime → veto_code = crisis_mode_active", result.veto_code == "crisis_mode_active", result.veto_code)


def test_rule2_daily_drawdown():
    print("\n── Rule 2: daily drawdown circuit breaker ──────────────────────────")
    state = _make_state(regime="low_vol_bull")
    portfolio = _make_portfolio(daily_drawdown_pct=0.05)
    result = asyncio.run(_evaluate(state, portfolio))
    check("drawdown=5% → approved=False", not result.approved)
    check("drawdown=5% → veto_code = daily_drawdown_limit", result.veto_code == "daily_drawdown_limit", result.veto_code)

    # 4.9% should pass Rule 2
    portfolio_ok = _make_portfolio(daily_drawdown_pct=0.049)
    result_ok = asyncio.run(_evaluate(state, portfolio_ok))
    check("drawdown=4.9% → passes Rule 2 (no drawdown veto)", result_ok.veto_code != "daily_drawdown_limit")


def test_rule3_confidence_too_low():
    print("\n── Rule 3: signal confidence threshold ─────────────────────────────")
    state = _make_state(confidence=0.59)
    result = asyncio.run(_evaluate(state, _make_portfolio()))
    check("confidence=0.59 → veto confidence_too_low", result.veto_code == "confidence_too_low", result.veto_code)

    state_null = _make_state()
    state_null = state_null.model_copy(update={"signal_vote": None})
    result_null = asyncio.run(_evaluate(state_null, _make_portfolio()))
    check("signal=None → veto confidence_too_low", result_null.veto_code == "confidence_too_low")

    # 0.60 is the threshold — should pass
    state_ok = _make_state(confidence=0.60)
    result_ok = asyncio.run(_evaluate(state_ok, _make_portfolio()))
    check("confidence=0.60 → passes Rule 3", result_ok.veto_code != "confidence_too_low")


def test_rule4_direction_regime_conflict():
    print("\n── Rule 4: direction vs regime conflict ────────────────────────────")
    for bear_regime in ("bear", "high_vol_bear", "crisis"):
        state = _make_state(regime=bear_regime, direction="LONG")
        result = asyncio.run(_evaluate(state, _make_portfolio()))
        if bear_regime == "crisis":
            # Rule 1 fires first
            check(f"LONG in {bear_regime} → Rule 1 fires (crisis_mode_active)", result.veto_code == "crisis_mode_active")
        else:
            check(f"LONG in {bear_regime} → direction_regime_conflict", result.veto_code == "direction_regime_conflict", result.veto_code)

    # SHORT in bear is allowed past Rule 4
    state_short = _make_state(regime="bear", direction="SHORT")
    result_short = asyncio.run(_evaluate(state_short, _make_portfolio()))
    check("SHORT in bear → passes Rule 4 (no conflict veto)", result_short.veto_code != "direction_regime_conflict")


def test_rule5_category_concentration():
    print("\n── Rule 5: protocol category concentration ─────────────────────────")
    portfolio = _make_portfolio(protocol_category_weights={"layer1": 0.20})
    state = _make_state(ticker="BTC", regime="low_vol_bull", direction="LONG")
    result = asyncio.run(_evaluate(state, portfolio))
    check("BTC with layer1 weight=20% → category_limit_reached", result.veto_code == "category_limit_reached", result.veto_code)

    # 19% should pass Rule 5
    portfolio_ok = _make_portfolio(protocol_category_weights={"layer1": 0.19})
    result_ok = asyncio.run(_evaluate(state, portfolio_ok))
    check("BTC with layer1 weight=19% → passes Rule 5", result_ok.veto_code != "category_limit_reached")

    # Unknown ticker falls into 'other' category — never hits limit unless 'other' is at 20%
    state_unknown = _make_state(ticker="XYZ", regime="low_vol_bull", direction="LONG")
    result_unknown = asyncio.run(_evaluate(state_unknown, _make_portfolio()))
    check("unknown ticker → uses 'other' category, no limit hit", result_unknown.veto_code != "category_limit_reached")


def test_rule6_position_too_small():
    print("\n── Rule 6: minimum position size ($50) ─────────────────────────────")
    # Very low confidence + bear regime + high vol → Kelly → tiny position
    state = _make_state(regime="high_vol_bear", confidence=0.61, direction="SHORT")
    # price=$1, portfolio=$100 → position may fall below $50
    result = asyncio.run(_evaluate(state, _make_portfolio(total_value_usd=100.0), btc_vol=0.40, price=1.0))
    # Kelly: f*=(0.61*2-0.39)/2=0.415, *0.25=0.10375, *0.5(vol)*0.2(hv_bear)=0.010375 → $1.04 < $50
    check("tiny portfolio + high_vol_bear → position_too_small", result.veto_code == "position_too_small", result.veto_code)


def test_rule10_price_unavailable():
    print("\n── Rule 10: zero shares / price unavailable ────────────────────────")
    state = _make_state(regime="low_vol_bull", direction="LONG")
    result = asyncio.run(_evaluate(state, _make_portfolio(), price=0.0))
    check("price=0 → veto price_unavailable", result.veto_code == "price_unavailable", result.veto_code)


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Full approval path
# ═══════════════════════════════════════════════════════════════════════════════

def test_full_approval():
    print("\n── Full approval path ──────────────────────────────────────────────")
    state = _make_state(ticker="ETH", regime="low_vol_bull", confidence=0.75, direction="LONG")
    portfolio = _make_portfolio(total_value_usd=10_000.0)
    result = asyncio.run(_evaluate(state, portfolio, btc_vol=0.25, price=3000.0))

    check("normal inputs → approved=True", result.approved, f"veto={result.veto_code}")
    check("shares > 0", result.shares is not None and result.shares > 0, str(result.shares))
    check("size_usd > 0", result.size_usd is not None and result.size_usd > 0, str(result.size_usd))
    check("position_pct <= 0.08 (8% cap)", result.position_pct is not None and result.position_pct <= 0.08, str(result.position_pct))
    check("stop_loss_price < entry (LONG)", result.stop_loss_price is not None and result.stop_loss_price < 3000.0, str(result.stop_loss_price))
    check("take_profit_price > entry (LONG)", result.take_profit_price is not None and result.take_profit_price > 3000.0, str(result.take_profit_price))
    check("btc_vol_at_decision = 0.25", result.btc_vol_at_decision == 0.25)
    check("regime_at_decision = low_vol_bull", result.regime_at_decision == "low_vol_bull")

    # Verify Kelly math: p=0.75, b=2.0
    # f* = (0.75*2 - 0.25)/2 = 0.625, *0.25 = 0.15625
    # btc_vol=0.25 < 0.35 → no cut; low_vol_bull × 1.0 → 15.625% → capped at 8%
    expected_pct = 0.08  # hard cap
    check(
        "position_pct capped at 8% (Kelly > 8%)",
        abs(result.position_pct - expected_pct) < 0.0001,
        f"{result.position_pct:.4f}",
    )
    expected_usd = 10_000.0 * 0.08  # = $800
    check("size_usd = portfolio × 8%", abs(result.size_usd - expected_usd) < 0.01, f"${result.size_usd}")
    expected_shares = round(expected_usd / 3000.0, 6)
    check("shares = size_usd / price", abs(result.shares - expected_shares) < 1e-6, f"{result.shares}")


def test_wbtc_end_to_end_example():
    """Reproduces the WBTC shock scenario from section 9 of ATS_Agent_Execution_Flow.md"""
    print("\n── WBTC end-to-end scenario (doc §9) ──────────────────────────────")
    from ats.models.state import AgentState, SignalVote
    state = AgentState(
        trigger_ticker="WBTC",
        trigger_event={"event": "aave_governance_proposal"},
        regime="choppy",
        signal_vote=SignalVote(
            direction="SHORT",
            confidence=0.68,
            sentiment_score=-0.79,
            technical_signal="SHORT",
            regime_used="choppy",
        ),
    )
    portfolio = _make_portfolio(
        total_value_usd=10_000.0,
        daily_drawdown_pct=0.006,
        protocol_category_weights={"wrapped_btc": 0.0},
    )
    result = asyncio.run(_evaluate(state, portfolio, btc_vol=0.38, price=67250.0))

    check("WBTC scenario → approved", result.approved, f"veto={result.veto_code}")
    check("shares ≈ 0.004 WBTC", result.shares is not None and abs(result.shares - 0.004) < 0.001, str(result.shares))
    check("stop_loss above entry (SHORT)", result.stop_loss_price is not None and result.stop_loss_price > 67250.0)
    check("stop_loss ≈ $68,595", result.stop_loss_price is not None and abs(result.stop_loss_price - 68595.0) < 1.0, str(result.stop_loss_price))
    check("take_profit below entry (SHORT)", result.take_profit_price is not None and result.take_profit_price < 67250.0)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. Portfolio reader defaults
# ═══════════════════════════════════════════════════════════════════════════════

def test_portfolio_reader_defaults():
    print("\n── Portfolio reader: first-run defaults ────────────────────────────")

    async def run():
        with patch("ats.agents.risk.portfolio_reader.get_json", return_value=None):
            from ats.agents.risk.portfolio_reader import read_portfolio
            return await read_portfolio()

    p = asyncio.run(run())
    check("default total_value_usd = 10_000", p.total_value_usd == 10_000.0)
    check("default cash_usd = 10_000", p.cash_usd == 10_000.0)
    check("default daily_drawdown_pct = 0.0", p.daily_drawdown_pct == 0.0)
    check("default protocol_category_weights = {}", p.protocol_category_weights == {})
    check("default open_positions = []", p.open_positions == [])


# ═══════════════════════════════════════════════════════════════════════════════
# runner
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 68)
    print("Phase 5 — Agent 5: Risk Management Agent")
    print("=" * 68)

    test_kelly_fraction()
    test_apply_multipliers()
    test_stop_loss_and_take_profit()
    test_rule1_crisis_mode()
    test_rule2_daily_drawdown()
    test_rule3_confidence_too_low()
    test_rule4_direction_regime_conflict()
    test_rule5_category_concentration()
    test_rule6_position_too_small()
    test_rule10_price_unavailable()
    test_full_approval()
    test_wbtc_end_to_end_example()
    test_portfolio_reader_defaults()

    print("\n" + "=" * 68)
    passed = sum(1 for _, ok, _ in _results if ok)
    failed = sum(1 for _, ok, _ in _results if not ok)
    print(f"  Results: {passed} passed, {failed} failed")
    print("=" * 68)
    sys.exit(0 if failed == 0 else 1)
