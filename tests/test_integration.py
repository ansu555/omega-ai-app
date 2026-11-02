"""
ATS integration test suite

Purpose:
Validate that major ATS components talk to each other correctly across module
boundaries, while mocking only external systems (Redis, Postgres, web3, LLM).

Run:
  .venv/bin/python -m pytest tests/test_integration.py -v
  or
  .venv/bin/python tests/test_integration.py
"""
from __future__ import annotations

import asyncio
import json
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

# Allow direct execution: `python tests/test_integration.py` from repo root.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
_results: list[tuple[str, bool, str]] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    _results.append((name, condition, detail))
    label = PASS if condition else FAIL
    suffix = f"  — {detail}" if detail else ""
    print(f"  [{label}]  {name}{suffix}")


def run_async(coro):
    return asyncio.run(coro)


def _make_state(
    *,
    ticker: str = "BTCUSDT",
    direction: str = "LONG",
    confidence: float = 0.80,
    regime: str = "low_vol_bull",
    approved: bool = True,
    size_usd: float = 5000.0,
    shares: float = 0.05,
    receipt_id: str | None = "receipt-int-001",
    consensus: str = "EXECUTE",
):
    from ats.models.state import AgentState, RiskDecision, SignalVote, GraphVote

    return AgentState(
        trigger_ticker=ticker,
        trigger_event={"event_type": "manual", "source": "test"},
        regime=regime,
        regime_confidence=0.85,
        signal_vote=SignalVote(
            direction=direction,
            confidence=confidence,
            sentiment_score=0.4,
            technical_signal=direction,
            regime_used=regime,
        ),
        graph_vote=GraphVote(
            direction=direction if direction != "NEUTRAL" else "SHORT",
            impact_scores={"AAVE": -0.35},
            propagation_count=1,
        ),
        risk_decision=RiskDecision(
            approved=approved,
            shares=shares,
            size_usd=size_usd,
            position_pct=0.05,
            stop_loss_price=60000.0,
            take_profit_price=70000.0,
            regime_at_decision=regime,
            btc_vol_at_decision=0.33,
        ),
        receipt_id=receipt_id,
        consensus=consensus,
    )


def _mock_get_session(session):
    @asynccontextmanager
    async def _cm():
        yield session
    return _cm


# ═══════════════════════════════════════════════════════════════════════════════
# 1) Redis state handoffs (Agent4 -> Orchestrator -> Agent5 path)
# ═══════════════════════════════════════════════════════════════════════════════

def test_redis_handoffs_regime_and_risk_reads():
    print("\n=== Section 1: Redis state handoffs ===")
    from ats.models.state import AgentState, SignalVote
    from ats.orchestrator.nodes import regime_node, risk_node
    from ats.agents.risk.portfolio_reader import PortfolioState
    from ats.models.state import RiskDecision

    async def _run():
        # Regime read from Redis key regime:current
        with patch("ats.orchestrator.nodes.get_json", new=AsyncMock(return_value={"regime": "bear", "confidence": 0.91})):
            initial = AgentState(trigger_ticker="BTCUSDT", trigger_event={})
            after_regime = await regime_node(initial)

        check("regime_node reads regime:current", after_regime.regime == "bear", f"got {after_regime.regime}")
        check(
            "regime_node sets confidence from Redis",
            abs((after_regime.regime_confidence or 0.0) - 0.91) < 1e-9,
        )
        check("regime_node preserves unrelated fields", after_regime.signal_vote is None)

        # Redis miss fallback
        with patch("ats.orchestrator.nodes.get_json", new=AsyncMock(return_value=None)):
            fallback = await regime_node(initial)
        check("regime_node fallback regime=choppy", fallback.regime == "choppy", f"got {fallback.regime}")
        check("regime_node fallback confidence=0.50", fallback.regime_confidence == 0.50, f"got {fallback.regime_confidence}")

        # Risk path reads from portfolio + market keys
        read_portfolio = PortfolioState(
            total_value_usd=10_000.0,
            cash_usd=10_000.0,
            daily_drawdown_pct=0.0,
            protocol_category_weights={},
            open_positions=[],
        )
        seen_keys: list[str] = []

        async def _fake_get_float(key: str):
            seen_keys.append(key)
            if key == "market:btc_vol":
                return 0.25
            if key == "price:BTCUSDT":
                return 65000.0
            return None

        fake_state = AgentState(
            trigger_ticker="BTCUSDT",
            trigger_event={},
            regime="low_vol_bull",
            regime_confidence=0.8,
            signal_vote=SignalVote(
                direction="LONG",
                confidence=0.80,
                sentiment_score=0.4,
                technical_signal="LONG",
                regime_used="low_vol_bull",
            ),
        )

        with (
            patch("ats.agents.agent5_risk.read_portfolio", new=AsyncMock(return_value=read_portfolio)),
            patch("ats.agents.agent5_risk.get_float", side_effect=_fake_get_float),
        ):
            after_risk = await risk_node(fake_state)

        check("risk_node populates risk_decision", isinstance(after_risk.risk_decision, RiskDecision))
        check("Agent5 reads market:btc_vol key", "market:btc_vol" in seen_keys, f"seen={seen_keys}")
        check("Agent5 reads price:{ticker} key", "price:BTCUSDT" in seen_keys, f"seen={seen_keys}")

    run_async(_run())


# ═══════════════════════════════════════════════════════════════════════════════
# 2) LangGraph pipeline wiring
# ═══════════════════════════════════════════════════════════════════════════════

def test_langgraph_topology_and_conditional_routes():
    print("\n=== Section 2: LangGraph pipeline wiring ===")
    from ats.orchestrator.graph import build_pipeline

    pipeline = build_pipeline()
    graph = pipeline.get_graph()
    node_names = set(graph.nodes.keys())

    check("pipeline compiles", pipeline is not None)
    check("node 'regime' present", "regime" in node_names, f"nodes={sorted(node_names)}")
    check("node 'signal_and_graph' present", "signal_and_graph" in node_names)
    check("node 'risk' present", "risk" in node_names)
    check("node 'orchestrator' present", "orchestrator" in node_names)
    check("node 'execution' present", "execution" in node_names)

    edges = {(e.source, e.target, e.data) for e in graph.edges}
    check(
        "conditional route EXECUTE -> execution exists",
        ("orchestrator", "execution", "EXECUTE") in edges,
    )
    check(
        "conditional route SKIP -> END exists",
        ("orchestrator", "__end__", "SKIP") in edges,
    )


def test_langgraph_runtime_accumulates_state_and_executes_conditionally():
    from ats.models.state import AgentState
    from ats.models.state import SignalVote, GraphVote, RiskDecision
    from ats.orchestrator.graph import build_pipeline

    async def _invoke_for_consensus(consensus: str):
        async def fake_regime_node(state: AgentState) -> AgentState:
            return state.model_copy(update={"regime": "low_vol_bull", "regime_confidence": 0.88})

        async def fake_signal_and_graph_node(state: AgentState) -> AgentState:
            return state.model_copy(update={
                "signal_vote": SignalVote(
                    direction="LONG",
                    confidence=0.82,
                    sentiment_score=0.51,
                    technical_signal="LONG",
                    regime_used=state.regime or "choppy",
                ),
                "graph_vote": GraphVote(direction="LONG", impact_scores={"AAVE": 0.22}, propagation_count=1),
            })

        async def fake_risk_node(state: AgentState) -> AgentState:
            return state.model_copy(update={"risk_decision": RiskDecision(approved=True, shares=0.01, size_usd=650.0)})

        async def fake_orchestrator_node(state: AgentState) -> AgentState:
            return state.model_copy(update={"consensus": consensus, "receipt_id": "receipt-langgraph-001"})

        mock_agent6 = MagicMock()
        mock_agent6.execute = AsyncMock(side_effect=lambda s: s.model_copy(update={"trigger_event": {"executed": True}}))

        with (
            patch("ats.orchestrator.graph.regime_node", new=fake_regime_node),
            patch("ats.orchestrator.graph.signal_and_graph_node", new=fake_signal_and_graph_node),
            patch("ats.orchestrator.graph.risk_node", new=fake_risk_node),
            patch("ats.orchestrator.graph.orchestrator_node", new=fake_orchestrator_node),
            patch("ats.orchestrator.graph._get_agent6", return_value=mock_agent6),
        ):
            pipe = build_pipeline()
            initial = AgentState(trigger_ticker="BTCUSDT", trigger_event={"event_type": "manual"})
            result = await pipe.ainvoke(initial)
            final = AgentState(**result) if isinstance(result, dict) else result
            return final, mock_agent6.execute.await_count

    final_exec, exec_calls = run_async(_invoke_for_consensus("EXECUTE"))
    check("pipeline accumulates regime in state", final_exec.regime == "low_vol_bull")
    check("pipeline accumulates signal_vote in state", final_exec.signal_vote is not None)
    check("pipeline accumulates risk_decision in state", final_exec.risk_decision is not None)
    check("pipeline accumulates receipt_id in state", final_exec.receipt_id == "receipt-langgraph-001")
    check("Agent6.execute called when consensus=EXECUTE", exec_calls == 1, f"calls={exec_calls}")

    _, skip_calls = run_async(_invoke_for_consensus("SKIP"))
    check("Agent6.execute NOT called when consensus=SKIP", skip_calls == 0, f"calls={skip_calls}")


# ═══════════════════════════════════════════════════════════════════════════════
# 3) AgentState propagation integrity
# ═══════════════════════════════════════════════════════════════════════════════

def test_state_propagation_and_model_copy_immutability():
    print("\n=== Section 3: AgentState propagation integrity ===")
    from ats.models.state import AgentState, SignalVote, GraphVote, RiskDecision

    initial = AgentState(trigger_ticker="ETHUSDT", trigger_event={"event_type": "manual"})
    after_regime = initial.model_copy(update={"regime": "choppy", "regime_confidence": 0.5})
    after_signal_graph = after_regime.model_copy(update={
        "signal_vote": SignalVote(
            direction="SHORT",
            confidence=0.66,
            sentiment_score=-0.44,
            technical_signal="SHORT",
            regime_used="choppy",
        ),
        "graph_vote": GraphVote(direction="SHORT", impact_scores={"CRV": -0.25}, propagation_count=2),
    })
    after_risk = after_signal_graph.model_copy(update={
        "risk_decision": RiskDecision(approved=True, shares=0.1, size_usd=1000.0)
    })
    after_orchestrator = after_risk.model_copy(update={"consensus": "SKIP", "receipt_id": "receipt-prop-001"})

    check("after_regime sets regime", after_regime.regime == "choppy")
    check("after_regime keeps signal_vote None", after_regime.signal_vote is None)
    check("after_signal_graph sets signal_vote", after_signal_graph.signal_vote is not None)
    check("after_signal_graph sets graph_vote", after_signal_graph.graph_vote is not None)
    check("after_risk sets risk_decision", after_risk.risk_decision is not None)
    check("after_orchestrator sets consensus", after_orchestrator.consensus == "SKIP")
    check("after_orchestrator sets receipt_id", after_orchestrator.receipt_id == "receipt-prop-001")

    check("model_copy keeps original immutable", initial.regime is None and initial.receipt_id is None)


# ═══════════════════════════════════════════════════════════════════════════════
# 4) Consensus logic wiring
# ═══════════════════════════════════════════════════════════════════════════════

def test_consensus_cases_and_crisis_veto():
    print("\n=== Section 4: Consensus logic ===")
    from ats.orchestrator.consensus import evaluate_consensus
    from ats.models.state import AgentState, SignalVote, RiskDecision
    from ats.agents.agent5_risk import Agent5Risk

    base = AgentState(trigger_ticker="BTCUSDT", trigger_event={})

    s_neutral = base.model_copy(update={
        "signal_vote": SignalVote(
            direction="NEUTRAL",
            confidence=0.99,
            sentiment_score=0.0,
            technical_signal="NEUTRAL",
            regime_used="choppy",
        ),
        "risk_decision": RiskDecision(approved=True),
    })
    check("NEUTRAL signal -> SKIP", evaluate_consensus(s_neutral) == "SKIP")

    s_veto = base.model_copy(update={
        "signal_vote": SignalVote(
            direction="LONG",
            confidence=0.90,
            sentiment_score=0.2,
            technical_signal="LONG",
            regime_used="low_vol_bull",
        ),
        "risk_decision": RiskDecision(approved=False, veto_code="daily_drawdown_limit"),
    })
    check("risk veto -> SKIP", evaluate_consensus(s_veto) == "SKIP")

    s_execute = base.model_copy(update={
        "signal_vote": SignalVote(
            direction="LONG",
            confidence=0.75,
            sentiment_score=0.2,
            technical_signal="LONG",
            regime_used="low_vol_bull",
        ),
        "risk_decision": RiskDecision(approved=True),
    })
    check("confidence >= 0.75 + approved -> EXECUTE", evaluate_consensus(s_execute) == "EXECUTE")

    s_mid = base.model_copy(update={
        "signal_vote": SignalVote(
            direction="LONG",
            confidence=0.62,
            sentiment_score=0.2,
            technical_signal="LONG",
            regime_used="low_vol_bull",
        ),
        "risk_decision": RiskDecision(approved=True),
    })
    check("confidence 0.60-0.74 -> SKIP", evaluate_consensus(s_mid) == "SKIP")

    async def _crisis():
        from ats.models.state import SignalVote
        from ats.agents.risk.portfolio_reader import PortfolioState

        risk_state = AgentState(
            trigger_ticker="BTCUSDT",
            trigger_event={},
            regime="crisis",
            signal_vote=SignalVote(
                direction="SHORT",
                confidence=0.90,
                sentiment_score=-0.2,
                technical_signal="SHORT",
                regime_used="crisis",
            ),
        )
        fake_portfolio = PortfolioState(
            total_value_usd=10_000.0,
            cash_usd=10_000.0,
            daily_drawdown_pct=0.0,
            protocol_category_weights={},
            open_positions=[],
        )
        with (
            patch("ats.agents.agent5_risk.read_portfolio", new=AsyncMock(return_value=fake_portfolio)),
            patch("ats.agents.agent5_risk.get_float", new=AsyncMock(return_value=65000.0)),
        ):
            decision = await Agent5Risk().evaluate(risk_state)
        return decision

    decision = run_async(_crisis())
    check("crisis regime produces crisis_mode_active veto", decision.approved is False and decision.veto_code == "crisis_mode_active")


# ═══════════════════════════════════════════════════════════════════════════════
# 5) Agent6 execution chain (submodules integration)
# ═══════════════════════════════════════════════════════════════════════════════

def test_agent6_execution_chain_long_and_short():
    print("\n=== Section 5: Agent6 execution chain ===")
    from ats.agents.agent6_execution import Agent6Execution

    async def _run(direction: str):
        state = _make_state(
            ticker="BTCUSDT",
            direction=direction,
            approved=True,
            size_usd=5000.0,
            shares=0.05,
            receipt_id="receipt-chain-001",
        )
        fake_exec_result = {"strategy": "single_swap", "swaps": [{"tx_hash": "0xtx1"}]}
        fake_receipts = [{"transactionHash": "0xtx1", "status": 1}]

        session = AsyncMock()
        session.commit = AsyncMock()
        session.execute = AsyncMock()
        cm = MagicMock()
        cm.__aenter__ = AsyncMock(return_value=session)
        cm.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("ats.agents.agent6_execution.execute_order", new=AsyncMock(return_value=fake_exec_result)) as mock_exec_order,
            patch("ats.agents.agent6_execution.wait_for_receipts", new=AsyncMock(return_value=fake_receipts)) as mock_wait,
            patch("ats.agents.agent6_execution.update_portfolio_after_fill", new=AsyncMock()) as mock_update_portfolio,
            patch("ats.agents.agent6_execution.update_receipt_with_fill", new=AsyncMock()) as mock_update_receipt,
            patch("ats.agents.agent6_execution.get_session", return_value=cm),
        ):
            out_state = await Agent6Execution().execute(state)

        return {
            "state": out_state,
            "order_args": mock_exec_order.await_args.args,
            "wait_args": mock_wait.await_args.args,
            "portfolio_kwargs": mock_update_portfolio.await_args.kwargs,
            "receipt_args": mock_update_receipt.await_args.args,
        }

    long_result = run_async(_run("LONG"))
    long_order_args = long_result["order_args"]
    check("LONG uses token_in=USDC", long_order_args[0] == "USDC", f"got={long_order_args}")
    check("LONG uses token_out=WBTC", long_order_args[1] == "WBTC", f"got={long_order_args}")
    check("LONG amount_in_wei uses USDC decimals", long_order_args[2] == 5_000_000_000, f"got={long_order_args[2]}")
    check("wait_for_receipts receives tx hashes from execute_order", long_result["wait_args"][0] == ["0xtx1"])
    check("update_portfolio_after_fill called", "size_usd" in long_result["portfolio_kwargs"])
    check("update_receipt_with_fill uses state.receipt_id", long_result["receipt_args"][0] == "receipt-chain-001")

    short_result = run_async(_run("SHORT"))
    short_order_args = short_result["order_args"]
    check("SHORT uses token_in=WBTC", short_order_args[0] == "WBTC", f"got={short_order_args}")
    check("SHORT uses token_out=USDC", short_order_args[1] == "USDC", f"got={short_order_args}")
    check("SHORT amount_in_wei uses asset decimals", short_order_args[2] == 5_000_000, f"got={short_order_args[2]}")


# ═══════════════════════════════════════════════════════════════════════════════
# 6) Portfolio state -> stop-loss monitor integration
# ═══════════════════════════════════════════════════════════════════════════════

def test_portfolio_updater_writes_and_stop_loss_reads_same_state():
    print("\n=== Section 6: Portfolio state and stop-loss monitor ===")
    from ats.agents.execution.portfolio_updater import update_portfolio_after_fill
    from ats.agents.execution.stop_loss_monitor import stop_loss_monitor_loop

    redis_store: dict[str, str] = {}
    redis_lists: dict[str, list[str]] = {"execution:fills": []}
    set_json_calls: list[tuple[str, dict]] = []

    class _FakeRedis:
        async def get(self, key: str):
            return redis_store.get(key)

        async def set(self, key: str, value: str):
            redis_store[key] = value

        async def lpush(self, key: str, value: str):
            redis_lists.setdefault(key, [])
            redis_lists[key].insert(0, value)

        async def ltrim(self, key: str, start: int, end: int):
            if key in redis_lists:
                redis_lists[key] = redis_lists[key][start:end + 1]

    fake_redis = _FakeRedis()

    async def _get_json(key: str):
        raw = redis_store.get(key)
        return json.loads(raw) if raw else None

    async def _set_json(key: str, value: dict):
        set_json_calls.append((key, value))
        redis_store[key] = json.dumps(value)

    async def _run():
        with (
            patch("ats.agents.execution.portfolio_updater.get_redis", new=AsyncMock(return_value=fake_redis)),
            patch("ats.agents.execution.portfolio_updater.get_json", side_effect=_get_json),
            patch("ats.agents.execution.portfolio_updater.set_json", side_effect=_set_json),
        ):
            await update_portfolio_after_fill(
                ticker="BTCUSDT",
                direction="LONG",
                amount_in_wei=100_000_000,
                avg_price=65000.0,
                size_usd=500.0,
                stop_loss_price=62000.0,
            )

        portfolio_after_fill = await _get_json("portfolio:state")
        check("portfolio:state has open_positions after fill", len(portfolio_after_fill["open_positions"]) == 1)
        check("execution:fills list appended", len(redis_lists["execution:fills"]) == 1)
        fill_event = json.loads(redis_lists["execution:fills"][0])
        check("execution:fills payload contains ticker", fill_event["ticker"] == "BTCUSDT")

        # Prepare stop-loss breach state
        redis_store["price:BTCUSDT"] = "61000.0"  # <= stop => breach for LONG
        exit_mock = AsyncMock(return_value=True)

        async def _sleep_and_cancel(_):
            raise asyncio.CancelledError()

        with (
            patch("ats.agents.execution.stop_loss_monitor.get_json", side_effect=_get_json),
            patch("ats.agents.execution.stop_loss_monitor.set_json", side_effect=_set_json),
            patch("ats.agents.execution.stop_loss_monitor.get_float", new=AsyncMock(return_value=61000.0)),
            patch("ats.agents.execution.stop_loss_monitor._exit_position", exit_mock),
            patch("ats.agents.execution.stop_loss_monitor.asyncio.sleep", side_effect=_sleep_and_cancel),
        ):
            try:
                await stop_loss_monitor_loop()
            except asyncio.CancelledError:
                pass

        check("stop-loss monitor calls _exit_position on breach", exit_mock.await_count == 1, f"calls={exit_mock.await_count}")

        final_portfolio = await _get_json("portfolio:state")
        check("stop-loss monitor removes closed position", len(final_portfolio.get("open_positions", [])) == 0)

        # Ensure monitor and updater both touched same key
        touched_portfolio_key = any(k == "portfolio:state" for k, _ in set_json_calls)
        check("portfolio key shared between updater and monitor", touched_portfolio_key)

    run_async(_run())


# ═══════════════════════════════════════════════════════════════════════════════
# 7) Fill -> Postgres -> RAG -> Chat integration
# ═══════════════════════════════════════════════════════════════════════════════

def test_fill_write_and_rag_chat_chain():
    print("\n=== Section 7: Fill -> Postgres -> RAG -> Chat ===")
    from ats.agents.execution.portfolio_updater import update_receipt_with_fill
    from ats.api.conversation.rag import fetch_receipt_context
    from httpx import AsyncClient, ASGITransport

    async def _run():
        # 1) Postgres fill update call
        session = AsyncMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        fill_data = {"strategy": "single_swap", "avg_price": 65123.0, "slippage": 0.001}
        await update_receipt_with_fill("receipt-rag-001", fill_data, session)
        check("update_receipt_with_fill executes SQL update", session.execute.await_count == 1)
        check("update_receipt_with_fill commits transaction", session.commit.await_count == 1)

        # 2) RAG context includes fill and risk details
        receipt = MagicMock()
        receipt.id = "receipt-rag-001"
        receipt.ticker = "BTCUSDT"
        receipt.created_at = datetime(2026, 5, 3, 10, 0, tzinfo=timezone.utc)
        receipt.regime = "low_vol_bull"
        receipt.consensus = "EXECUTE"
        receipt.signal_vote = {"direction": "LONG", "confidence": 0.8}
        receipt.risk_decision = {
            "approved": True,
            "shares": 0.05,
            "size_usd": 5000.0,
            "stop_loss_price": 62000.0,
            "take_profit_price": 70000.0,
        }
        receipt.fill_data = {"strategy": "single_swap", "avg_price": 65123.0, "slippage": 0.001}

        result = MagicMock()
        scalars = MagicMock()
        scalars.all.return_value = [receipt]
        result.scalars.return_value = scalars
        rag_session = AsyncMock()
        rag_session.execute = AsyncMock(return_value=result)
        cm = MagicMock()
        cm.__aenter__ = AsyncMock(return_value=rag_session)
        cm.__aexit__ = AsyncMock(return_value=False)

        with patch("ats.api.conversation.rag.get_session", return_value=cm):
            context = await fetch_receipt_context(ticker="BTCUSDT", limit=5)

        check("RAG context includes regime", "Regime:" in context)
        check("RAG context includes signal", "Signal:" in context)
        check("RAG context includes Risk APPROVED details", "Risk: APPROVED" in context and "Stop:" in context)
        check("RAG context includes Fill details", "Fill:" in context and "65123.0" in context)

        # 3) Chat route uses that context in system prompt
        with (
            patch("ats.api.main.create_tables", new_callable=AsyncMock),
            patch("ats.api.main._agent6.start", new_callable=AsyncMock),
            patch("ats.api.routes.chat.fetch_receipt_context", new=AsyncMock(return_value=context)),
            patch("ats.api.routes.chat._get_client") as mock_get_client,
        ):
            mock_response = MagicMock()
            mock_response.content = [MagicMock(text="Reason based on receipt data.")]
            messages = AsyncMock()
            messages.create = AsyncMock(return_value=mock_response)
            client = MagicMock()
            client.messages = messages
            mock_get_client.return_value = client

            from ats.api.main import app
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as http:
                resp = await http.post("/api/chat", json={"message": "Why trade?", "ticker": "BTCUSDT"})

            check("POST /api/chat returns 200", resp.status_code == 200)
            system_prompt = messages.create.await_args.kwargs["system"]
            check("chat system prompt contains RAG fill data", "Fill:" in system_prompt and "65123.0" in system_prompt)
            check("chat returns Claude response payload", "response" in resp.json())

    run_async(_run())


# ═══════════════════════════════════════════════════════════════════════════════
# 8) API -> pipeline -> WebSocket broadcast
# ═══════════════════════════════════════════════════════════════════════════════

def test_api_activation_route_uses_real_run_pipeline_wrapper_and_broadcast():
    print("\n=== Section 8: API -> pipeline -> WS broadcast ===")
    from httpx import AsyncClient, ASGITransport
    from ats.models.state import AgentState

    async def _run():
        # Patch orchestrator internal pipeline so activations route still calls
        # real run_pipeline() wrapper, but no LangGraph/DB/network side effects.
        fake_pipeline = SimpleNamespace()
        fake_pipeline.ainvoke = AsyncMock(return_value=_make_state().model_dump())

        with (
            patch("ats.orchestrator._pipeline", fake_pipeline),
            patch("ats.api.routes.activations.ws_manager") as mock_ws,
            patch("ats.api.main.create_tables", new_callable=AsyncMock),
            patch("ats.api.main._agent6.start", new_callable=AsyncMock),
        ):
            mock_ws.broadcast = AsyncMock()
            from ats.api.main import app

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/activations/act-123/execute",
                    json={"ticker": "BTCUSDT", "event_type": "manual", "event_payload": {"source": "ui"}},
                )

            payload = resp.json()
            check("activation endpoint returns 200", resp.status_code == 200)
            check("response contains receipt_id", "receipt_id" in payload)
            check("response contains consensus", payload.get("consensus") in ("EXECUTE", "SKIP"))
            check("response contains regime", "regime" in payload)

            check("run_pipeline wrapper called underlying _pipeline.ainvoke", fake_pipeline.ainvoke.await_count == 1)
            called_initial_state = fake_pipeline.ainvoke.await_args.args[0]
            check("run_pipeline passes ticker from request", called_initial_state.trigger_ticker == "BTCUSDT")
            check("run_pipeline merges event_type into trigger_event", called_initial_state.trigger_event.get("event_type") == "manual")

            check("ws_manager.broadcast called once", mock_ws.broadcast.await_count == 1)
            event = mock_ws.broadcast.await_args.args[0]
            check("broadcast type is pipeline_complete", event.get("type") == "pipeline_complete")
            check("broadcast includes activation_id", event.get("activation_id") == "act-123")
            check("broadcast includes receipt_id", event.get("receipt_id") == payload.get("receipt_id"))
            check("broadcast signal serialized as dict", isinstance(event.get("signal"), dict))
            check("broadcast risk serialized as dict", isinstance(event.get("risk"), dict))

    run_async(_run())


# ═══════════════════════════════════════════════════════════════════════════════
# 9) FastAPI startup + Agent6.start idempotency
# ═══════════════════════════════════════════════════════════════════════════════

def test_startup_calls_create_tables_and_agent6_start():
    print("\n=== Section 9: Startup wiring ===")
    async def _run():
        with (
            patch("ats.api.main.create_tables", new_callable=AsyncMock) as mock_tables,
            patch("ats.api.main._agent6.start", new_callable=AsyncMock) as mock_start,
        ):
            from ats.api.main import startup
            await startup()
        check("startup calls create_tables", mock_tables.await_count == 1)
        check("startup calls _agent6.start", mock_start.await_count == 1)

    run_async(_run())


def test_agent6_start_creates_single_background_task_until_done():
    from ats.agents.agent6_execution import Agent6Execution

    async def _run():
        # Reset class-level task to avoid leakage from other tests
        Agent6Execution._stop_loss_task = None

        fake_task = MagicMock()
        fake_task.done.return_value = False
        fake_task.cancel = MagicMock()

        async def _fake_loop():
            await asyncio.sleep(0)

        def _fake_create_task(coro, name=None):
            # close coroutine because we're not scheduling a real task in this test
            coro.close()
            return fake_task

        with (
            patch("ats.agents.agent6_execution.stop_loss_monitor_loop", new=_fake_loop),
            patch("ats.agents.agent6_execution.asyncio.create_task", side_effect=_fake_create_task) as mock_create_task,
        ):
            a6 = Agent6Execution()
            await a6.start()
            await a6.start()  # should not create second task while first alive

            check("Agent6.start creates one task initially", mock_create_task.call_count == 1)

            # Mark old task done and ensure a new task can be spawned
            fake_task.done.return_value = True
            await a6.start()
            check("Agent6.start recreates task after done", mock_create_task.call_count == 2)

        Agent6Execution._stop_loss_task = None

    run_async(_run())


TESTS = [
    test_redis_handoffs_regime_and_risk_reads,
    test_langgraph_topology_and_conditional_routes,
    test_langgraph_runtime_accumulates_state_and_executes_conditionally,
    test_state_propagation_and_model_copy_immutability,
    test_consensus_cases_and_crisis_veto,
    test_agent6_execution_chain_long_and_short,
    test_portfolio_updater_writes_and_stop_loss_reads_same_state,
    test_fill_write_and_rag_chat_chain,
    test_api_activation_route_uses_real_run_pipeline_wrapper_and_broadcast,
    test_startup_calls_create_tables_and_agent6_start,
    test_agent6_start_creates_single_background_task_until_done,
]


def main() -> int:
    print("=" * 64)
    print("ATS Integration Tests")
    print("=" * 64)
    errors: list[tuple[str, Exception]] = []
    for test in TESTS:
        try:
            test()
        except Exception as exc:
            errors.append((test.__name__, exc))
            print(f"  [{FAIL}]  {test.__name__} raised: {exc}")

    print("\n" + "=" * 64)
    total = len(_results)
    passed = sum(1 for _, ok, _ in _results if ok)
    failed = total - passed
    print(f"Results: {passed}/{total} passed", end="")
    if errors:
        print(f"  |  {len(errors)} test(s) crashed")
    else:
        print()
    print("=" * 64)
    if failed or errors:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
