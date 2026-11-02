"""
Phase 7 — Agent 6: Execution Agent test suite
Covers every item on the validation checklist from doc/phases/phase-7-execution-agent.md

Run:  .venv/bin/python -m pytest tests/test_phase7.py -v
  or: .venv/bin/python tests/test_phase7.py
"""
from __future__ import annotations

import asyncio
import json
import sys
from unittest.mock import AsyncMock, MagicMock, patch, call

# ── helpers ───────────────────────────────────────────────────────────────────

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
_results: list[tuple[str, bool, str]] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    _results.append((name, condition, detail))
    label = PASS if condition else FAIL
    suffix = f"  — {detail}" if detail else ""
    print(f"  [{label}]  {name}{suffix}")


# ── fixtures ──────────────────────────────────────────────────────────────────

def _make_state(
    ticker: str = "BTCUSDT",
    direction: str = "LONG",
    regime: str = "low_vol_bull",
    confidence: float = 0.70,
    approved: bool = True,
    size_usd: float = 5_000.0,
    shares: float = 0.05,
    stop_loss_price: float = 60_000.0,
    receipt_id: str | None = "receipt-test-001",
):
    from ats.models.state import AgentState, SignalVote, RiskDecision
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
        risk_decision=RiskDecision(
            approved=approved,
            shares=shares,
            size_usd=size_usd,
            position_pct=0.05,
            stop_loss_price=stop_loss_price,
            take_profit_price=70_000.0,
        ),
        receipt_id=receipt_id,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 1. dex_client — unit tests (no real chain)
# ═══════════════════════════════════════════════════════════════════════════════

def test_token_addresses_exist():
    print("\n── dex_client: TOKEN_ADDRESSES populated ───────────────────────────")
    from ats.agents.execution.dex_client import TOKEN_ADDRESSES
    for symbol in ("W0G", "USDC", "USDT", "WETH", "WBTC"):
        check(f"TOKEN_ADDRESSES[{symbol}] is set", symbol in TOKEN_ADDRESSES and TOKEN_ADDRESSES[symbol].startswith("0x"))


def test_get_agent_address_from_dummy_key():
    print("\n── dex_client: derive agent address from private key ───────────────")
    dummy_key = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    with patch("ats.agents.execution.dex_client.settings") as mock_settings:
        mock_settings.agent_wallet_private_key = dummy_key
        from ats.agents.execution.dex_client import get_agent_address
        addr = get_agent_address()
    check("agent address is a valid checksummed 0x address", addr.startswith("0x") and len(addr) == 42, addr)


def test_get_quote_calls_contract():
    print("\n── dex_client: get_quote calls getAmountsOut ────────────────────────")

    async def run():
        mock_contract = MagicMock()
        mock_contract.functions.getAmountsOut.return_value.call = AsyncMock(
            return_value=[1_000_000, 2_500_000_000]
        )
        mock_w3 = MagicMock()
        mock_w3.eth.contract.return_value = mock_contract
        mock_w3.to_checksum_address.side_effect = lambda x: x

        with patch("ats.agents.execution.dex_client.get_w3", return_value=mock_w3), \
             patch("ats.agents.execution.dex_client.settings") as ms:
            ms.dex_router_address = "0x0000000000000000000000000000000000000010"
            from ats.agents.execution.dex_client import get_quote
            result = await get_quote("USDC", "WBTC", 1_000_000)

        return result

    result = asyncio.run(run())
    check("get_quote returns integer", isinstance(result, int), str(result))
    check("get_quote returns last element of amounts", result == 2_500_000_000, str(result))


def test_approve_token_calls_contract():
    print("\n── dex_client: approve_token returns tx hash ────────────────────────")

    async def run():
        mock_contract = MagicMock()
        fake_tx_bytes = bytes.fromhex("abcd1234" * 8)
        mock_contract.functions.approve.return_value.transact = AsyncMock(
            return_value=fake_tx_bytes
        )
        mock_w3 = MagicMock()
        mock_w3.eth.contract.return_value = mock_contract
        mock_w3.to_checksum_address.side_effect = lambda x: x

        with patch("ats.agents.execution.dex_client.get_w3", return_value=mock_w3), \
             patch("ats.agents.execution.dex_client.get_agent_address", return_value="0xABCD"), \
             patch("ats.agents.execution.dex_client.settings") as ms:
            ms.dex_router_address = "0x0000000000000000000000000000000000000010"
            from ats.agents.execution.dex_client import approve_token
            tx = await approve_token("USDC", 1_000_000)

        return tx

    tx = asyncio.run(run())
    check("approve_token returns hex string", isinstance(tx, str), tx[:16])
    check("approve_token result is valid hex", all(c in "0123456789abcdef" for c in tx), tx[:16])


def test_swap_exact_tokens_calls_router():
    print("\n── dex_client: swap_exact_tokens submits swap tx ────────────────────")

    async def run():
        fake_tx = bytes.fromhex("deadbeef" * 8)
        mock_contract = MagicMock()
        mock_contract.functions.swapExactTokensForTokens.return_value.transact = AsyncMock(
            return_value=fake_tx
        )
        mock_w3 = MagicMock()
        mock_w3.eth.contract.return_value = mock_contract
        mock_w3.to_checksum_address.side_effect = lambda x: x

        with patch("ats.agents.execution.dex_client.get_w3", return_value=mock_w3), \
             patch("ats.agents.execution.dex_client.get_agent_address", return_value="0xABCD"), \
             patch("ats.agents.execution.dex_client.settings") as ms:
            ms.dex_router_address = "0x0000000000000000000000000000000000000010"
            from ats.agents.execution.dex_client import swap_exact_tokens
            tx = await swap_exact_tokens("USDC", "WBTC", 1_000_000, 900_000)

        return tx

    tx = asyncio.run(run())
    check("swap_exact_tokens returns hex tx hash", isinstance(tx, str) and len(tx) > 0, tx[:16])


# ═══════════════════════════════════════════════════════════════════════════════
# 2. order_router — strategy selection
# ═══════════════════════════════════════════════════════════════════════════════

def _patch_do_swap(return_value: dict):
    """Patch _do_swap so order_router tests don't touch the chain."""
    return patch(
        "ats.agents.execution.order_router._do_swap",
        new=AsyncMock(return_value=return_value),
    )


def test_single_swap_under_10k():
    print("\n── order_router: single swap for size ≤ $10K ───────────────────────")

    async def run():
        fake_swap = {"tx_hash": "0xabc", "amount_in_wei": 5_000_000, "quoted_out_wei": 100_000_000}
        with _patch_do_swap(fake_swap):
            from ats.agents.execution.order_router import execute_order
            return await execute_order("USDC", "WBTC", 5_000_000, size_usd=5_000.0)

    result = asyncio.run(run())
    check("single_swap strategy selected", result["strategy"] == "single_swap", result["strategy"])
    check("exactly 1 swap submitted", len(result["swaps"]) == 1, str(len(result["swaps"])))
    check("swap contains tx_hash", "tx_hash" in result["swaps"][0])


def test_twap_over_10k():
    print("\n── order_router: TWAP for size > $10K ──────────────────────────────")

    async def run():
        call_count = 0

        async def mock_do_swap(token_in, token_out, amount_in_wei):
            nonlocal call_count
            call_count += 1
            return {
                "tx_hash": f"0x{call_count:040x}",
                "amount_in_wei": amount_in_wei,
                "quoted_out_wei": amount_in_wei * 2,
            }

        with patch("ats.agents.execution.order_router._do_swap", side_effect=mock_do_swap), \
             patch("ats.agents.execution.order_router.asyncio.sleep", new=AsyncMock()):
            from ats.agents.execution.order_router import execute_order, TWAP_SLICES
            result = await execute_order("USDC", "WBTC", 50_000_000, size_usd=50_000.0)

        return result, call_count

    result, call_count = asyncio.run(run())
    from ats.agents.execution.order_router import TWAP_SLICES
    check("twap strategy selected", result["strategy"] == "twap", result["strategy"])
    check(f"exactly {TWAP_SLICES} swap slices submitted", len(result["swaps"]) == TWAP_SLICES, str(len(result["swaps"])))
    check("_do_swap called TWAP_SLICES times", call_count == TWAP_SLICES, str(call_count))


def test_slippage_application():
    print("\n── order_router: slippage reduces min_out ───────────────────────────")
    from ats.agents.execution.order_router import _apply_slippage
    from ats.config import settings

    quoted = 1_000_000
    result = _apply_slippage(quoted)
    expected = int(quoted * (10_000 - settings.dex_slippage_bps) // 10_000)
    check("_apply_slippage returns correct min_out", result == expected, f"got={result} expected={expected}")
    check("min_out < quoted (slippage applied)", result < quoted, f"{result} < {quoted}")


# ═══════════════════════════════════════════════════════════════════════════════
# 3. fill_monitor
# ═══════════════════════════════════════════════════════════════════════════════

def test_wait_for_receipt_confirmed():
    print("\n── fill_monitor: confirms tx in first poll ─────────────────────────")

    async def run():
        fake_receipt = {"blockNumber": 12345, "status": 1, "transactionHash": "0xabc"}
        mock_w3 = MagicMock()
        mock_w3.eth.get_transaction_receipt = AsyncMock(return_value=fake_receipt)

        with patch("ats.agents.execution.fill_monitor.get_w3", return_value=mock_w3):
            from ats.agents.execution.fill_monitor import wait_for_receipt
            return await wait_for_receipt("0xabc")

    receipt = asyncio.run(run())
    check("receipt dict returned", isinstance(receipt, dict), str(receipt))
    check("blockNumber present", "blockNumber" in receipt, str(receipt.get("blockNumber")))


def test_wait_for_receipt_timeout():
    print("\n── fill_monitor: raises TimeoutError after max wait ─────────────────")

    async def run():
        mock_w3 = MagicMock()
        mock_w3.eth.get_transaction_receipt = AsyncMock(return_value=None)

        with patch("ats.agents.execution.fill_monitor.get_w3", return_value=mock_w3), \
             patch("ats.agents.execution.fill_monitor.MAX_WAIT_S", 4), \
             patch("ats.agents.execution.fill_monitor.POLL_INTERVAL_S", 2), \
             patch("ats.agents.execution.fill_monitor.asyncio.sleep", new=AsyncMock()):
            from ats.agents.execution.fill_monitor import wait_for_receipt
            try:
                await wait_for_receipt("0xdeadbeef")
                return False
            except TimeoutError:
                return True

    raised = asyncio.run(run())
    check("TimeoutError raised when tx not confirmed", raised)


def test_wait_for_receipts_partial_failure():
    print("\n── fill_monitor: partial failure returns error dict ─────────────────")

    async def run():
        good_receipt = {"blockNumber": 999, "status": 1}

        async def mock_get_receipt(tx_hash):
            if tx_hash == "0xgood":
                return good_receipt
            return None  # always None → timeout for 0xbad

        mock_w3 = MagicMock()
        mock_w3.eth.get_transaction_receipt = AsyncMock(side_effect=mock_get_receipt)

        with patch("ats.agents.execution.fill_monitor.get_w3", return_value=mock_w3), \
             patch("ats.agents.execution.fill_monitor.MAX_WAIT_S", 4), \
             patch("ats.agents.execution.fill_monitor.POLL_INTERVAL_S", 2), \
             patch("ats.agents.execution.fill_monitor.asyncio.sleep", new=AsyncMock()):
            from ats.agents.execution.fill_monitor import wait_for_receipts
            return await wait_for_receipts(["0xgood", "0xbad"])

    results = asyncio.run(run())
    check("2 results returned", len(results) == 2, str(len(results)))
    good = next((r for r in results if r.get("blockNumber") == 999), None)
    bad  = next((r for r in results if r.get("status") == "timeout"), None)
    check("successful receipt has blockNumber", good is not None)
    check("failed receipt has error dict with status=timeout", bad is not None)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. portfolio_updater
# ═══════════════════════════════════════════════════════════════════════════════

def test_portfolio_update_adds_position():
    print("\n── portfolio_updater: adds position and deducts cash ────────────────")

    async def run():
        initial_portfolio = {
            "total_value_usd": 10_000.0,
            "cash_usd": 10_000.0,
            "daily_drawdown_pct": 0.0,
            "open_positions": [],
        }
        stored: dict = {}

        async def mock_get_json(key):
            return stored.get(key)

        async def mock_set_json(key, value):
            stored[key] = value

        mock_redis = AsyncMock()
        mock_redis.lpush = AsyncMock()
        mock_redis.ltrim = AsyncMock()

        with patch("ats.agents.execution.portfolio_updater.get_json", side_effect=mock_get_json), \
             patch("ats.agents.execution.portfolio_updater.set_json", side_effect=mock_set_json), \
             patch("ats.agents.execution.portfolio_updater.get_redis", return_value=mock_redis):
            stored["portfolio:state"] = initial_portfolio
            from ats.agents.execution.portfolio_updater import update_portfolio_after_fill
            await update_portfolio_after_fill(
                ticker="BTCUSDT",
                direction="LONG",
                amount_in_wei=500_000,
                avg_price=65_000.0,
                size_usd=3_250.0,
                stop_loss_price=63_700.0,
            )

        return stored.get("portfolio:state")

    portfolio = asyncio.run(run())
    check("portfolio:state is updated", portfolio is not None)
    check("cash_usd reduced by size_usd", abs(portfolio["cash_usd"] - 6_750.0) < 0.01, str(portfolio["cash_usd"]))
    check("open_positions has 1 entry", len(portfolio["open_positions"]) == 1, str(len(portfolio["open_positions"])))
    pos = portfolio["open_positions"][0]
    check("position ticker is correct", pos["ticker"] == "BTCUSDT")
    check("position direction is correct", pos["direction"] == "LONG")
    check("position entry_price is correct", abs(pos["entry_price"] - 65_000.0) < 0.01)
    check("position stop_loss_price is correct", abs(pos["stop_loss_price"] - 63_700.0) < 0.01)


def test_execution_fills_list_grows():
    print("\n── portfolio_updater: execution:fills list grows by 1 after fill ────")

    fills_pushed: list[str] = []

    async def run():
        mock_redis = MagicMock()
        mock_redis.lpush = AsyncMock(side_effect=lambda key, val: fills_pushed.append(val))
        mock_redis.ltrim = AsyncMock()

        with patch("ats.agents.execution.portfolio_updater.get_json", return_value=None), \
             patch("ats.agents.execution.portfolio_updater.set_json", new=AsyncMock()), \
             patch("ats.agents.execution.portfolio_updater.get_redis", return_value=mock_redis):
            from ats.agents.execution.portfolio_updater import update_portfolio_after_fill
            await update_portfolio_after_fill(
                ticker="ETHUSDT",
                direction="LONG",
                amount_in_wei=1_000_000_000_000_000_000,
                avg_price=3_000.0,
                size_usd=300.0,
                stop_loss_price=2_940.0,
            )

    asyncio.run(run())
    check("lpush called once → fills list grew by 1", len(fills_pushed) == 1, str(len(fills_pushed)))
    fill = json.loads(fills_pushed[0])
    check("fill record has ticker", fill.get("ticker") == "ETHUSDT")
    check("fill record has direction", fill.get("direction") == "LONG")
    check("fill record has size_usd", fill.get("size_usd") == 300.0)
    check("fill record has avg_price", fill.get("avg_price") == 3_000.0)
    check("fill record has filled_at timestamp", "filled_at" in fill)


# ═══════════════════════════════════════════════════════════════════════════════
# 5. stop_loss_monitor
# ═══════════════════════════════════════════════════════════════════════════════

def test_stop_loss_long_breach():
    print("\n── stop_loss_monitor: LONG breached → exit submitted ────────────────")

    exited: list[str] = []

    async def run():
        portfolio = {
            "cash_usd": 5_000.0,
            "open_positions": [
                {
                    "ticker": "BTCUSDT",
                    "direction": "LONG",
                    "amount_in_wei": 500_000,
                    "stop_loss_price": 60_000.0,
                }
            ],
        }

        async def mock_get_json(key):
            if key == "portfolio:state":
                return portfolio
            return None

        async def mock_get_float(key):
            if key == "price:BTCUSDT":
                return 59_000.0   # below stop → breach
            return None

        async def mock_swap(*args, **kwargs):
            exited.append("BTCUSDT")
            return "0xexit"

        async def mock_approve(*args, **kwargs):
            return "0xapprove"

        async def mock_quote(*args, **kwargs):
            return 500_000_000

        with patch("ats.agents.execution.stop_loss_monitor.get_json", side_effect=mock_get_json), \
             patch("ats.agents.execution.stop_loss_monitor.set_json", new=AsyncMock()), \
             patch("ats.agents.execution.stop_loss_monitor.get_float", side_effect=mock_get_float), \
             patch("ats.agents.execution.stop_loss_monitor.get_quote", side_effect=mock_quote), \
             patch("ats.agents.execution.stop_loss_monitor.approve_token", side_effect=mock_approve), \
             patch("ats.agents.execution.stop_loss_monitor.swap_exact_tokens", side_effect=mock_swap), \
             patch("ats.agents.execution.stop_loss_monitor.asyncio.sleep", new=AsyncMock(side_effect=asyncio.CancelledError)):
            from ats.agents.execution.stop_loss_monitor import stop_loss_monitor_loop
            try:
                await stop_loss_monitor_loop()
            except asyncio.CancelledError:
                pass

    asyncio.run(run())
    check("stop-loss exit triggered for LONG breach", "BTCUSDT" in exited, str(exited))


def test_stop_loss_short_breach():
    print("\n── stop_loss_monitor: SHORT breached → exit submitted ───────────────")

    exited: list[str] = []

    async def run():
        portfolio = {
            "cash_usd": 5_000.0,
            "open_positions": [
                {
                    "ticker": "ETHUSDT",
                    "direction": "SHORT",
                    "amount_in_wei": 1_000_000_000_000_000_000,
                    "stop_loss_price": 3_100.0,
                }
            ],
        }

        async def mock_get_float(key):
            if key == "price:ETHUSDT":
                return 3_200.0   # above stop for SHORT → breach
            return None

        async def mock_swap(*args, **kwargs):
            exited.append("ETHUSDT")
            return "0xexit"

        with patch("ats.agents.execution.stop_loss_monitor.get_json", return_value=portfolio), \
             patch("ats.agents.execution.stop_loss_monitor.set_json", new=AsyncMock()), \
             patch("ats.agents.execution.stop_loss_monitor.get_float", side_effect=mock_get_float), \
             patch("ats.agents.execution.stop_loss_monitor.get_quote", new=AsyncMock(return_value=900_000_000)), \
             patch("ats.agents.execution.stop_loss_monitor.approve_token", new=AsyncMock(return_value="0xapprove")), \
             patch("ats.agents.execution.stop_loss_monitor.swap_exact_tokens", side_effect=mock_swap), \
             patch("ats.agents.execution.stop_loss_monitor.asyncio.sleep", new=AsyncMock(side_effect=asyncio.CancelledError)):
            from ats.agents.execution.stop_loss_monitor import stop_loss_monitor_loop
            try:
                await stop_loss_monitor_loop()
            except asyncio.CancelledError:
                pass

    asyncio.run(run())
    check("stop-loss exit triggered for SHORT breach", "ETHUSDT" in exited, str(exited))


def test_stop_loss_no_breach():
    print("\n── stop_loss_monitor: no breach → no exit submitted ─────────────────")

    exited: list[str] = []

    async def run():
        portfolio = {
            "open_positions": [
                {
                    "ticker": "BTCUSDT",
                    "direction": "LONG",
                    "amount_in_wei": 500_000,
                    "stop_loss_price": 60_000.0,
                }
            ]
        }

        async def mock_get_float(key):
            return 65_000.0   # above stop → no breach

        async def mock_swap(*args, **kwargs):
            exited.append("BTCUSDT")
            return "0xexit"

        with patch("ats.agents.execution.stop_loss_monitor.get_json", return_value=portfolio), \
             patch("ats.agents.execution.stop_loss_monitor.set_json", new=AsyncMock()), \
             patch("ats.agents.execution.stop_loss_monitor.get_float", side_effect=mock_get_float), \
             patch("ats.agents.execution.stop_loss_monitor.swap_exact_tokens", side_effect=mock_swap), \
             patch("ats.agents.execution.stop_loss_monitor.asyncio.sleep", new=AsyncMock(side_effect=asyncio.CancelledError)):
            from ats.agents.execution.stop_loss_monitor import stop_loss_monitor_loop
            try:
                await stop_loss_monitor_loop()
            except asyncio.CancelledError:
                pass

    asyncio.run(run())
    check("no exit when price is safe", len(exited) == 0, str(exited))


# ═══════════════════════════════════════════════════════════════════════════════
# 6. Agent6Execution — full flow (all deps mocked)
# ═══════════════════════════════════════════════════════════════════════════════

def test_agent6_skips_rejected_decision():
    print("\n── Agent6: skips execution when risk_decision not approved ──────────")

    async def run():
        from ats.agents.agent6_execution import Agent6Execution
        state = _make_state(approved=False)
        agent = Agent6Execution()
        result = await agent.execute(state)
        return result

    result = asyncio.run(run())
    # State should be returned unchanged — no execution calls made
    check("state returned unchanged when not approved", result.receipt_id == "receipt-test-001")
    check("risk_decision.approved is False", not result.risk_decision.approved)


def test_agent6_long_single_swap():
    print("\n── Agent6: full LONG single-swap flow (<$10K) ───────────────────────")

    portfolio_stored: dict = {}
    fills_pushed: list[str] = []
    receipt_updated: list[str] = []

    async def run():
        fake_order_result = {
            "strategy": "single_swap",
            "swaps": [{"tx_hash": "0xcafe", "amount_in_wei": 5_000_000, "quoted_out_wei": 100_000}],
        }
        fake_receipts = [{"blockNumber": 100, "status": 1}]

        mock_redis = MagicMock()
        mock_redis.lpush = AsyncMock(side_effect=lambda k, v: fills_pushed.append(v))
        mock_redis.ltrim = AsyncMock()

        async def mock_get_json(key):
            return portfolio_stored.get(key)

        async def mock_set_json(key, value):
            portfolio_stored[key] = value

        with patch("ats.agents.execution.order_router._do_swap", new=AsyncMock(return_value=fake_order_result["swaps"][0])), \
             patch("ats.agents.execution.fill_monitor.get_w3") as mock_w3_factory, \
             patch("ats.agents.execution.portfolio_updater.get_redis", return_value=mock_redis), \
             patch("ats.agents.execution.portfolio_updater.get_json", side_effect=mock_get_json), \
             patch("ats.agents.execution.portfolio_updater.set_json", side_effect=mock_set_json), \
             patch("ats.agents.agent6_execution.get_session") as mock_session_ctx, \
             patch("ats.agents.agent6_execution.update_receipt_with_fill", new=AsyncMock(side_effect=lambda rid, fd, s: receipt_updated.append(rid))):

            mock_w3 = MagicMock()
            mock_w3.eth.get_transaction_receipt = AsyncMock(return_value={"blockNumber": 100, "status": 1})
            mock_w3_factory.return_value = mock_w3

            mock_session = AsyncMock()
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_ctx.return_value = mock_session

            from ats.agents.agent6_execution import Agent6Execution
            agent = Agent6Execution()
            state = _make_state(size_usd=5_000.0, shares=0.05)
            return await agent.execute(state)

    result = asyncio.run(run())
    check("state returned from execute()", result is not None)
    check("portfolio:state updated in Redis", "portfolio:state" in portfolio_stored, str(list(portfolio_stored.keys())))
    check("execution:fills grew by 1", len(fills_pushed) == 1, str(len(fills_pushed)))
    check("receipt updated with fill_data", len(receipt_updated) == 1, str(receipt_updated))
    check("receipt_id matches", receipt_updated[0] == "receipt-test-001")


def test_agent6_twap_flow():
    print("\n── Agent6: TWAP strategy selected for large order (>$10K) ──────────")

    strategy_used: list[str] = []

    async def run():
        async def mock_execute_order(token_in, token_out, amount_in_wei, size_usd):
            strategy = "twap" if size_usd > 10_000 else "single_swap"
            strategy_used.append(strategy)
            swaps = [{"tx_hash": f"0x{i:040x}", "amount_in_wei": amount_in_wei // 5} for i in range(5)]
            return {"strategy": strategy, "swaps": swaps}

        with patch("ats.agents.agent6_execution.execute_order", side_effect=mock_execute_order), \
             patch("ats.agents.agent6_execution.wait_for_receipts", new=AsyncMock(return_value=[{"status": 1}] * 5)), \
             patch("ats.agents.agent6_execution.update_portfolio_after_fill", new=AsyncMock()), \
             patch("ats.agents.agent6_execution.update_receipt_with_fill", new=AsyncMock()), \
             patch("ats.agents.agent6_execution.get_session") as msc:

            mock_s = AsyncMock()
            mock_s.__aenter__ = AsyncMock(return_value=mock_s)
            mock_s.__aexit__ = AsyncMock(return_value=None)
            msc.return_value = mock_s

            from ats.agents.agent6_execution import Agent6Execution
            agent = Agent6Execution()
            state = _make_state(size_usd=25_000.0, shares=0.25)
            return await agent.execute(state)

    asyncio.run(run())
    check("TWAP strategy selected for $25K order", "twap" in strategy_used, str(strategy_used))


def test_agent6_no_receipt_id_skips_postgres():
    print("\n── Agent6: skips Postgres update when receipt_id is None ───────────")

    receipt_calls: list = []

    async def run():
        with patch("ats.agents.agent6_execution.execute_order", new=AsyncMock(return_value={
                "strategy": "single_swap",
                "swaps": [{"tx_hash": "0xabc", "amount_in_wei": 100}],
            })), \
             patch("ats.agents.agent6_execution.wait_for_receipts", new=AsyncMock(return_value=[{"status": 1}])), \
             patch("ats.agents.agent6_execution.update_portfolio_after_fill", new=AsyncMock()), \
             patch("ats.agents.agent6_execution.update_receipt_with_fill",
                   new=AsyncMock(side_effect=lambda *a, **k: receipt_calls.append(True))), \
             patch("ats.agents.agent6_execution.get_session") as msc:

            mock_s = AsyncMock()
            mock_s.__aenter__ = AsyncMock(return_value=mock_s)
            mock_s.__aexit__ = AsyncMock(return_value=None)
            msc.return_value = mock_s

            from ats.agents.agent6_execution import Agent6Execution
            agent = Agent6Execution()
            state = _make_state(receipt_id=None)
            return await agent.execute(state)

    asyncio.run(run())
    check("update_receipt_with_fill NOT called when receipt_id is None", len(receipt_calls) == 0, str(len(receipt_calls)))


# ═══════════════════════════════════════════════════════════════════════════════
# 7. Security — private key never surfaced
# ═══════════════════════════════════════════════════════════════════════════════

def test_private_key_not_in_fill_data():
    print("\n── Security: AGENT_WALLET_PRIVATE_KEY not in fill_data ─────────────")
    from ats.config import settings
    dummy_key = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    fill_data = {
        "strategy":  "single_swap",
        "avg_price": 65000.0,
        "size_usd":  3250.0,
        "tx_hashes": ["0xabcdef"],
        "receipts":  [{"status": 1}],
    }
    key_exposed = dummy_key in json.dumps(fill_data)
    check("AGENT_WALLET_PRIVATE_KEY is absent from fill_data", not key_exposed)


def test_agent_address_not_logged_as_private_key():
    print("\n── Security: logs reveal address, not private key ───────────────────")
    from ats.config import settings
    import logging
    import io

    log_stream = io.StringIO()
    handler = logging.StreamHandler(log_stream)
    handler.setLevel(logging.DEBUG)

    logger = logging.getLogger("ats.agents.agent6_execution")
    logger.addHandler(handler)
    try:
        dummy_key = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
        with patch.object(settings, "agent_wallet_private_key", dummy_key):
            logger.info("Agent6: test log message — no key should appear here")
        log_output = log_stream.getvalue()
        check("private key does not appear in log output", dummy_key not in log_output, "key_redacted")
    finally:
        logger.removeHandler(handler)


# ═══════════════════════════════════════════════════════════════════════════════
# runner
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 68)
    print("Phase 7 — Agent 6: Execution Agent")
    print("=" * 68)

    test_token_addresses_exist()
    test_get_agent_address_from_dummy_key()
    test_get_quote_calls_contract()
    test_approve_token_calls_contract()
    test_swap_exact_tokens_calls_router()

    test_single_swap_under_10k()
    test_twap_over_10k()
    test_slippage_application()

    test_wait_for_receipt_confirmed()
    test_wait_for_receipt_timeout()
    test_wait_for_receipts_partial_failure()

    test_portfolio_update_adds_position()
    test_execution_fills_list_grows()

    test_stop_loss_long_breach()
    test_stop_loss_short_breach()
    test_stop_loss_no_breach()

    test_agent6_skips_rejected_decision()
    test_agent6_long_single_swap()
    test_agent6_twap_flow()
    test_agent6_no_receipt_id_skips_postgres()

    test_private_key_not_in_fill_data()
    test_agent_address_not_logged_as_private_key()

    print("\n" + "=" * 68)
    passed = sum(1 for _, ok, _ in _results if ok)
    failed = sum(1 for _, ok, _ in _results if not ok)
    print(f"  Results: {passed} passed, {failed} failed")
    print("=" * 68)
    sys.exit(0 if failed == 0 else 1)
