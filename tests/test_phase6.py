"""
Phase 6 — Orchestrator & LangGraph test suite
Covers every item on the validation checklist from doc/phases/phase-6-orchestrator.md

Run:  .venv/bin/python -m pytest tests/test_phase6.py -v
  or: .venv/bin/python tests/test_phase6.py
"""
import asyncio
import sys
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

# ── helpers ───────────────────────────────────────────────────────────────────

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
_results: list[tuple[str, bool, str]] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    _results.append((name, condition, detail))
    label = PASS if condition else FAIL
    suffix = f"  — {detail}" if detail else ""
    print(f"  [{label}]  {name}{suffix}")


# ── shared mock builders ──────────────────────────────────────────────────────

def _mock_session():
    """Return a mock SQLAlchemy AsyncSession with add() and commit()."""
    s = MagicMock()
    s.add = MagicMock()
    s.commit = AsyncMock()
    return s


def _mock_get_session(session):
    """Async context manager that yields the given session mock."""
    @asynccontextmanager
    async def _cm():
        yield session
    return _cm


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Consensus — pure unit tests, no I/O
# ═══════════════════════════════════════════════════════════════════════════════

def test_consensus_risk_veto():
    from ats.orchestrator.consensus import evaluate_consensus
    from ats.models.state import AgentState, RiskDecision, SignalVote

    state = AgentState(
        trigger_ticker="WBTC",
        trigger_event={},
        regime="low_vol_bull",
        regime_confidence=0.80,
        signal_vote=SignalVote(
            direction="LONG", confidence=0.85,
            sentiment_score=0.60, technical_signal="LONG",
            regime_used="low_vol_bull",
        ),
        risk_decision=RiskDecision(approved=False, veto_code="daily_drawdown_limit"),
    )
    result = evaluate_consensus(state)
    check("Risk veto (approved=False) → SKIP", result == "SKIP", f"got {result}")


def test_consensus_neutral_signal():
    from ats.orchestrator.consensus import evaluate_consensus
    from ats.models.state import AgentState, RiskDecision, SignalVote

    state = AgentState(
        trigger_ticker="WBTC",
        trigger_event={},
        regime="low_vol_bull",
        regime_confidence=0.80,
        signal_vote=SignalVote(
            direction="NEUTRAL", confidence=0.50,
            sentiment_score=0.0, technical_signal="NEUTRAL",
            regime_used="low_vol_bull",
        ),
        risk_decision=RiskDecision(approved=True),
    )
    result = evaluate_consensus(state)
    check("NEUTRAL signal direction → SKIP", result == "SKIP", f"got {result}")


def test_consensus_execute_path():
    from ats.orchestrator.consensus import evaluate_consensus
    from ats.models.state import AgentState, RiskDecision, SignalVote

    state = AgentState(
        trigger_ticker="WBTC",
        trigger_event={},
        regime="low_vol_bull",
        regime_confidence=0.80,
        signal_vote=SignalVote(
            direction="LONG", confidence=0.76,
            sentiment_score=0.70, technical_signal="LONG",
            regime_used="low_vol_bull",
        ),
        risk_decision=RiskDecision(approved=True),
    )
    result = evaluate_consensus(state)
    check("Approved risk + confidence >= 0.75 → EXECUTE", result == "EXECUTE", f"got {result}")


def test_consensus_medium_confidence_skip():
    from ats.orchestrator.consensus import evaluate_consensus
    from ats.models.state import AgentState, RiskDecision, SignalVote

    state = AgentState(
        trigger_ticker="WBTC",
        trigger_event={},
        regime="low_vol_bull",
        regime_confidence=0.80,
        signal_vote=SignalVote(
            direction="LONG", confidence=0.65,
            sentiment_score=0.40, technical_signal="LONG",
            regime_used="low_vol_bull",
        ),
        risk_decision=RiskDecision(approved=True),
    )
    result = evaluate_consensus(state)
    check("Confidence 0.60–0.75 (assisted mode, not yet implemented) → SKIP",
          result == "SKIP", f"got {result}")


def test_consensus_no_signal():
    from ats.orchestrator.consensus import evaluate_consensus
    from ats.models.state import AgentState, RiskDecision

    state = AgentState(
        trigger_ticker="WBTC",
        trigger_event={},
        risk_decision=RiskDecision(approved=True),
    )
    result = evaluate_consensus(state)
    check("No signal_vote → SKIP", result == "SKIP", f"got {result}")


# ═══════════════════════════════════════════════════════════════════════════════
# 2. regime_node — mocked Redis
# ═══════════════════════════════════════════════════════════════════════════════

async def test_regime_node_redis_hit():
    from ats.orchestrator.nodes import regime_node
    from ats.models.state import AgentState

    state = AgentState(trigger_ticker="WBTC", trigger_event={})

    async def fake_get_json(key):
        return {"regime": "low_vol_bull", "confidence": 0.82}

    with patch("ats.orchestrator.nodes.get_json", side_effect=fake_get_json):
        result = await regime_node(state)

    check("regime_node: regime set from Redis", result.regime == "low_vol_bull",
          f"got {result.regime}")
    check("regime_node: confidence set from Redis",
          abs(result.regime_confidence - 0.82) < 1e-9,
          f"got {result.regime_confidence}")


async def test_regime_node_redis_miss():
    from ats.orchestrator.nodes import regime_node
    from ats.models.state import AgentState

    state = AgentState(trigger_ticker="WBTC", trigger_event={})

    with patch("ats.orchestrator.nodes.get_json", return_value=None):
        result = await regime_node(state)

    check("regime_node: Redis miss → regime='choppy'", result.regime == "choppy",
          f"got {result.regime}")
    check("regime_node: Redis miss → confidence=0.50",
          result.regime_confidence == 0.50,
          f"got {result.regime_confidence}")


# ═══════════════════════════════════════════════════════════════════════════════
# 3. signal_and_graph_node — mocked sub-modules
# ═══════════════════════════════════════════════════════════════════════════════

async def test_signal_and_graph_node():
    from ats.orchestrator.nodes import signal_and_graph_node
    from ats.models.state import AgentState, SignalVote, GraphVote

    state = AgentState(
        trigger_ticker="WBTC",
        trigger_event={"event_type": "tvl_change", "change_pct": -5.0},
        regime="low_vol_bull",
        regime_confidence=0.82,
    )

    fake_graph_vote = GraphVote(
        direction="SHORT", impact_scores={"AAVE": 0.55}, propagation_count=1
    )

    with (
        patch("ats.agents.signal.sentiment.compute_sentiment", return_value=-0.60),
        patch("ats.agents.signal.technicals.compute_technical_signal",
              new_callable=AsyncMock, return_value="SHORT"),
        patch("ats.agents.agent3_graph.set_json", new_callable=AsyncMock),
    ):
        result = await signal_and_graph_node(state)

    check("signal_and_graph_node: signal_vote populated",
          result.signal_vote is not None)
    check("signal_and_graph_node: signal_vote is SignalVote",
          isinstance(result.signal_vote, SignalVote))
    check("signal_and_graph_node: signal_vote direction is valid Direction",
          result.signal_vote.direction in ("LONG", "SHORT", "NEUTRAL"),
          f"got {result.signal_vote.direction}")
    check("signal_and_graph_node: graph_vote populated",
          result.graph_vote is not None)
    check("signal_and_graph_node: graph_vote is GraphVote",
          isinstance(result.graph_vote, GraphVote))


# ═══════════════════════════════════════════════════════════════════════════════
# 4. risk_node — mocked Agent5Risk
# ═══════════════════════════════════════════════════════════════════════════════

async def test_risk_node():
    from ats.orchestrator.nodes import risk_node
    from ats.models.state import AgentState, SignalVote, RiskDecision

    state = AgentState(
        trigger_ticker="WBTC",
        trigger_event={},
        regime="low_vol_bull",
        regime_confidence=0.82,
        signal_vote=SignalVote(
            direction="LONG", confidence=0.78,
            sentiment_score=0.60, technical_signal="LONG",
            regime_used="low_vol_bull",
        ),
    )

    fake_decision = RiskDecision(
        approved=True, shares=0.01, size_usd=500.0,
        position_pct=0.05, stop_loss_price=40000.0,
        take_profit_price=46000.0, btc_vol_at_decision=0.25,
        regime_at_decision="low_vol_bull",
    )

    with patch("ats.orchestrator.nodes._agent5") as mock_agent5:
        mock_agent5.evaluate = AsyncMock(return_value=fake_decision)
        result = await risk_node(state)

    check("risk_node: risk_decision populated", result.risk_decision is not None)
    check("risk_node: risk_decision is RiskDecision",
          isinstance(result.risk_decision, RiskDecision))
    check("risk_node: approved=True", result.risk_decision.approved is True)


# ═══════════════════════════════════════════════════════════════════════════════
# 5. write_receipt — mocked session
# ═══════════════════════════════════════════════════════════════════════════════

async def test_write_receipt_execute():
    from ats.orchestrator.receipt_writer import write_receipt
    from ats.models.state import AgentState, SignalVote, GraphVote, RiskDecision
    from ats.models.receipts import DecisionReceipt

    state = AgentState(
        trigger_ticker="WBTC",
        trigger_event={"event_type": "tvl_change"},
        regime="low_vol_bull",
        regime_confidence=0.82,
        signal_vote=SignalVote(
            direction="LONG", confidence=0.78,
            sentiment_score=0.60, technical_signal="LONG",
            regime_used="low_vol_bull",
        ),
        graph_vote=GraphVote(
            direction="LONG", impact_scores={}, propagation_count=0
        ),
        risk_decision=RiskDecision(approved=True, shares=0.01, size_usd=500.0),
    )

    session = _mock_session()
    receipt_id = await write_receipt(state, "EXECUTE", session)

    check("write_receipt: returns a string receipt_id",
          isinstance(receipt_id, str) and len(receipt_id) == 36,
          f"got {receipt_id!r}")
    check("write_receipt: session.add called once", session.add.call_count == 1)
    check("write_receipt: session.commit awaited", session.commit.await_count == 1)

    added = session.add.call_args[0][0]
    check("write_receipt: added object is DecisionReceipt",
          isinstance(added, DecisionReceipt))
    check("write_receipt: ticker matches", added.ticker == "WBTC")
    check("write_receipt: consensus=EXECUTE", added.consensus == "EXECUTE")
    check("write_receipt: signal_vote serialized as dict",
          isinstance(added.signal_vote, dict))
    check("write_receipt: fill_data is None", added.fill_data is None)
    check("write_receipt: pnl is None", added.pnl is None)


async def test_write_receipt_skip():
    from ats.orchestrator.receipt_writer import write_receipt
    from ats.models.state import AgentState
    from ats.models.receipts import DecisionReceipt

    state = AgentState(
        trigger_ticker="WBTC",
        trigger_event={"event_type": "tvl_change"},
        regime="crisis",
        regime_confidence=0.95,
    )

    session = _mock_session()
    receipt_id = await write_receipt(state, "SKIP", session)

    added = session.add.call_args[0][0]
    check("write_receipt SKIP: consensus=SKIP", added.consensus == "SKIP")
    check("write_receipt SKIP: signal_vote=None (no vote)", added.signal_vote is None)
    check("write_receipt SKIP: fill_data=None", added.fill_data is None)
    check("write_receipt SKIP: pnl=None", added.pnl is None)


# ═══════════════════════════════════════════════════════════════════════════════
# 6. orchestrator_node — mocked Postgres
# ═══════════════════════════════════════════════════════════════════════════════

async def test_orchestrator_node():
    from ats.orchestrator.graph import orchestrator_node
    from ats.models.state import AgentState, SignalVote, RiskDecision

    state = AgentState(
        trigger_ticker="WBTC",
        trigger_event={},
        regime="low_vol_bull",
        regime_confidence=0.82,
        signal_vote=SignalVote(
            direction="LONG", confidence=0.80,
            sentiment_score=0.65, technical_signal="LONG",
            regime_used="low_vol_bull",
        ),
        risk_decision=RiskDecision(approved=True, shares=0.01, size_usd=500.0),
    )

    session = _mock_session()
    with patch("ats.orchestrator.graph.get_session", _mock_get_session(session)):
        result = await orchestrator_node(state)

    check("orchestrator_node: consensus set",
          result.consensus in ("EXECUTE", "SKIP"),
          f"got {result.consensus}")
    check("orchestrator_node: receipt_id is a UUID string",
          isinstance(result.receipt_id, str) and len(result.receipt_id) == 36,
          f"got {result.receipt_id}")
    check("orchestrator_node: DB write occurred (session.add called)",
          session.add.call_count == 1)


# ═══════════════════════════════════════════════════════════════════════════════
# 7. Full pipeline — run_pipeline end-to-end (all I/O mocked)
# ═══════════════════════════════════════════════════════════════════════════════

async def test_run_pipeline_full():
    """
    Validation checklist items:
    - run_pipeline completes without error
    - final_state.regime is set
    - final_state.signal_vote is populated
    - final_state.risk_decision is populated
    - final_state.consensus is EXECUTE or SKIP
    - A receipt row is written (session.add called)
    - SKIP cycles write a receipt with fill_data=None, pnl=None
    """
    from ats.orchestrator import run_pipeline
    from ats.models.state import AgentState, RiskDecision

    session = _mock_session()

    fake_risk = RiskDecision(
        approved=True, shares=0.01, size_usd=500.0,
        position_pct=0.05, stop_loss_price=40000.0,
        take_profit_price=46000.0,
        btc_vol_at_decision=0.25, regime_at_decision="low_vol_bull",
    )

    with (
        patch("ats.orchestrator.nodes.get_json",
              return_value={"regime": "low_vol_bull", "confidence": 0.82}),
        patch("ats.agents.signal.sentiment.compute_sentiment", return_value=-0.60),
        patch("ats.agents.signal.technicals.compute_technical_signal",
              new_callable=AsyncMock, return_value="SHORT"),
        patch("ats.agents.agent3_graph.set_json", new_callable=AsyncMock),
        patch("ats.orchestrator.nodes._agent5") as mock_a5,
        patch("ats.orchestrator.graph.get_session", _mock_get_session(session)),
    ):
        mock_a5.evaluate = AsyncMock(return_value=fake_risk)
        final = await run_pipeline("WBTC", {"event_type": "tvl_change", "change_pct": -5.0})

    check("run_pipeline: returns AgentState", isinstance(final, AgentState),
          f"got {type(final)}")
    check("run_pipeline: regime is set", final.regime is not None,
          f"got {final.regime}")
    check("run_pipeline: regime is a valid label",
          final.regime in ("low_vol_bull", "high_vol_bull", "choppy", "bear",
                           "high_vol_bear", "crisis"),
          f"got {final.regime}")
    check("run_pipeline: signal_vote populated", final.signal_vote is not None)
    check("run_pipeline: signal_vote has confidence",
          final.signal_vote is not None and isinstance(final.signal_vote.confidence, float))
    check("run_pipeline: risk_decision populated", final.risk_decision is not None)
    check("run_pipeline: consensus is EXECUTE or SKIP",
          final.consensus in ("EXECUTE", "SKIP"), f"got {final.consensus}")
    check("run_pipeline: receipt_id is UUID string",
          isinstance(final.receipt_id, str) and len(final.receipt_id) == 36,
          f"got {final.receipt_id}")
    check("run_pipeline: decision_receipts row written (session.add called)",
          session.add.call_count >= 1)

    if session.add.call_count >= 1:
        added = session.add.call_args[0][0]
        check("run_pipeline: receipt fill_data=None", added.fill_data is None)
        check("run_pipeline: receipt pnl=None", added.pnl is None)


# ═══════════════════════════════════════════════════════════════════════════════
# 8. Crisis regime → always SKIP (regardless of signal confidence)
# ═══════════════════════════════════════════════════════════════════════════════

async def test_crisis_always_skip():
    """
    Crisis regime produces SKIP regardless of signal confidence.
    Agent5Risk.evaluate returns veto_code=crisis_mode_active for regime=crisis.
    evaluate_consensus then sees approved=False → SKIP.
    """
    from ats.orchestrator import run_pipeline
    from ats.models.state import AgentState, RiskDecision

    session = _mock_session()

    # Agent5 returns crisis veto (it checks regime internally)
    crisis_veto = RiskDecision(approved=False, veto_code="crisis_mode_active",
                               regime_at_decision="crisis")

    with (
        patch("ats.orchestrator.nodes.get_json",
              return_value={"regime": "crisis", "confidence": 0.95}),
        patch("ats.agents.signal.sentiment.compute_sentiment", return_value=0.90),
        patch("ats.agents.signal.technicals.compute_technical_signal",
              new_callable=AsyncMock, return_value="LONG"),
        patch("ats.agents.agent3_graph.set_json", new_callable=AsyncMock),
        patch("ats.orchestrator.nodes._agent5") as mock_a5,
        patch("ats.orchestrator.graph.get_session", _mock_get_session(session)),
    ):
        mock_a5.evaluate = AsyncMock(return_value=crisis_veto)
        final = await run_pipeline("WBTC", {"event_type": "tvl_change"})

    check("crisis regime: consensus=SKIP", final.consensus == "SKIP",
          f"got {final.consensus}")
    check("crisis regime: receipt still written", session.add.call_count >= 1)
    check("crisis regime: risk_decision.approved=False",
          final.risk_decision is not None and final.risk_decision.approved is False)
    check("crisis regime: veto_code=crisis_mode_active",
          final.risk_decision is not None and
          final.risk_decision.veto_code == "crisis_mode_active")


# ═══════════════════════════════════════════════════════════════════════════════
# main
# ═══════════════════════════════════════════════════════════════════════════════

async def main() -> int:
    print("\n══ Phase 6 — Orchestrator & LangGraph ══\n")

    print("1. Consensus — risk veto → SKIP")
    test_consensus_risk_veto()

    print("\n2. Consensus — NEUTRAL signal → SKIP")
    test_consensus_neutral_signal()

    print("\n3. Consensus — high confidence → EXECUTE")
    test_consensus_execute_path()

    print("\n4. Consensus — medium confidence → SKIP")
    test_consensus_medium_confidence_skip()

    print("\n5. Consensus — no signal_vote → SKIP")
    test_consensus_no_signal()

    print("\n6. regime_node — Redis hit")
    await test_regime_node_redis_hit()

    print("\n7. regime_node — Redis miss (defaults)")
    await test_regime_node_redis_miss()

    print("\n8. signal_and_graph_node — votes populated")
    await test_signal_and_graph_node()

    print("\n9. risk_node — risk_decision populated")
    await test_risk_node()

    print("\n10. write_receipt — EXECUTE cycle")
    await test_write_receipt_execute()

    print("\n11. write_receipt — SKIP cycle (no fill_data, pnl=None)")
    await test_write_receipt_skip()

    print("\n12. orchestrator_node — consensus + receipt_id + DB write")
    await test_orchestrator_node()

    print("\n13. run_pipeline — full end-to-end (all I/O mocked)")
    await test_run_pipeline_full()

    print("\n14. Crisis regime → always SKIP")
    await test_crisis_always_skip()

    total  = len(_results)
    passed = sum(1 for _, ok, _ in _results if ok)
    failed = total - passed
    print(f"\n──────────────────────────────────────────────────────────────────")
    print(f"  {passed}/{total} passed  |  {failed} failed")
    if failed:
        print("\n  Failed tests:")
        for name, ok, detail in _results:
            if not ok:
                print(f"    ✗ {name}  {detail}")
    print()
    return failed


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
