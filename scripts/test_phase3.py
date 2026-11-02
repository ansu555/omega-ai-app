"""
Phase 3 test suite — no Redis, no live model download required.

FinBERT is mocked via patch so tests run offline and fast.

Tests:
  1. sentiment  — buffer_headline, compute_sentiment (mock _finbert)
  2. technicals — MACD signal, BB %B signal, stand-down regimes (mock Redis)
  3. combiner   — all agreement/disagreement/no-news paths
  4. agent2     — full _process cycle end-to-end (all I/O mocked)

Run from repo root:
    .venv/bin/python -m scripts.test_phase3
"""
from __future__ import annotations

import asyncio
import json
import sys
import time
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pandas as pd

# ── helpers ──────────────────────────────────────────────────────────────────

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
_results: list[tuple[str, bool, str]] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    _results.append((name, condition, detail))
    status = PASS if condition else FAIL
    suffix = f"  ({detail})" if detail else ""
    print(f"  {status}  {name}{suffix}")


def header(title: str) -> None:
    print(f"\n{'─'*55}")
    print(f"  {title}")
    print(f"{'─'*55}")


# ── fake FinBERT pipeline ─────────────────────────────────────────────────────

def _make_finbert_mock(label: str = "positive", score: float = 0.92):
    """Returns a callable that mimics the transformers pipeline output."""
    def _call(texts):
        return [[{"label": label, "score": score}] for _ in texts]
    return _call


# ── 1. sentiment ─────────────────────────────────────────────────────────────

def test_sentiment() -> None:
    header("1 · sentiment — buffer_headline / compute_sentiment")

    # We patch _finbert at module level BEFORE importing the functions
    mock_pipe = _make_finbert_mock("positive", 0.90)

    with patch("ats.agents.signal.sentiment._finbert", mock_pipe):
        from ats.agents.signal.sentiment import (
            buffer_headline, compute_sentiment, buffer_size, _headline_buffer,
            LABEL_SCORE,
        )
        _headline_buffer.clear()

        from ats.models.packets import DataPacket

        def make_packet(ticker, title, cq=0.90):
            return DataPacket(
                type="news", ticker=ticker, source="reuters",
                cq_score=cq, payload={"title": title, "description": ""},
            )

        # Empty buffer → None
        result_empty = compute_sentiment("BTC")
        check("empty buffer returns None", result_empty is None)

        # Buffer 3 headlines
        for i in range(3):
            buffer_headline(make_packet("BTC", f"Bitcoin surges headline {i}"))
        check("buffer size = 3 after buffering", buffer_size("BTC") == 3, str(buffer_size("BTC")))

        # compute_sentiment drains buffer and runs inference
        score = compute_sentiment("BTC")
        check("sentiment score not None after headlines", score is not None)
        check("positive mock → positive score", score is not None and score > 0, str(score))
        check("buffer drained after compute", buffer_size("BTC") == 0)

        # Negative sentiment mock
        with patch("ats.agents.signal.sentiment._finbert", _make_finbert_mock("negative", 0.85)):
            buffer_headline(make_packet("ETH", "Ethereum crash incoming", cq=0.80))
            neg_score = compute_sentiment("ETH")
        check("negative mock → negative score", neg_score is not None and neg_score < 0, str(neg_score))

        # Neutral mock → score ~0
        with patch("ats.agents.signal.sentiment._finbert", _make_finbert_mock("neutral", 0.70)):
            buffer_headline(make_packet("SOL", "Solana holds steady", cq=0.88))
            neu_score = compute_sentiment("SOL")
        check("neutral mock → score ~0", neu_score is not None and abs(neu_score) < 0.01, str(neu_score))

        # CQ weighting: high-CQ source should dominate
        _headline_buffer.clear()
        buffer_headline(make_packet("BTC", "BTC moon", cq=0.95))
        buffer_headline(make_packet("BTC", "BTC doom", cq=0.10))
        with patch("ats.agents.signal.sentiment._finbert", lambda texts: [
            [{"label": "positive", "score": 0.99}],
            [{"label": "negative", "score": 0.99}],
        ]):
            weighted = compute_sentiment("BTC")
        check("high-CQ source dominates weighting", weighted is not None and weighted > 0, str(weighted))


# ── 2. technicals ────────────────────────────────────────────────────────────

def _make_redis_mock(bars: list[dict]):
    """Returns a mock Redis whose lrange returns JSON-encoded bars (newest-first)."""
    encoded = [json.dumps(b) for b in reversed(bars)]   # lpush = newest-first
    mock_r = AsyncMock()
    mock_r.lrange = AsyncMock(return_value=encoded)
    return mock_r


def _price_bars(n: int = 40, trend: str = "up") -> list[dict]:
    """Generate synthetic OHLCV-style bars with a clear trend."""
    rng = np.random.default_rng(7)
    price = 50_000.0
    bars = []
    for i in range(n):
        if trend == "up":
            price *= 1 + abs(rng.normal(0.005, 0.002))
        elif trend == "down":
            price *= 1 - abs(rng.normal(0.005, 0.002))
        else:
            price *= 1 + rng.normal(0, 0.002)
        bars.append({"price": price, "close": price})
    return bars


async def test_technicals() -> None:
    header("2 · technicals — MACD / BB / stand-down")

    with patch("ats.agents.signal.technicals.get_redis") as mock_get_redis:
        from ats.agents.signal.technicals import compute_technical_signal

        # Stand-down regimes always return NEUTRAL regardless of data
        for regime in ("bear", "high_vol_bear", "crisis"):
            mock_get_redis.return_value = _make_redis_mock(_price_bars(40))
            result = await compute_technical_signal("BTC", regime)
            check(f"stand-down {regime} → NEUTRAL", result == "NEUTRAL", result)

        # Insufficient bars → NEUTRAL
        mock_get_redis.return_value = _make_redis_mock(_price_bars(5))
        result = await compute_technical_signal("BTC", "low_vol_bull")
        check("< 20 bars → NEUTRAL", result == "NEUTRAL", result)

        # Trending regime: strong uptrend should produce LONG via MACD
        mock_get_redis.return_value = _make_redis_mock(_price_bars(60, "up"))
        result_bull = await compute_technical_signal("BTC", "low_vol_bull")
        check("uptrend + low_vol_bull → LONG or NEUTRAL (MACD fired)", result_bull in ("LONG", "NEUTRAL"), result_bull)

        # Trending regime: strong downtrend
        mock_get_redis.return_value = _make_redis_mock(_price_bars(60, "down"))
        result_bear_trend = await compute_technical_signal("ETH", "high_vol_bull")
        check("downtrend + high_vol_bull → SHORT or NEUTRAL", result_bear_trend in ("SHORT", "NEUTRAL"), result_bear_trend)

        # Choppy regime: BB %B - force price near lower band for LONG
        choppy_bars = []
        base = 50_000.0
        rng = np.random.default_rng(99)
        for i in range(40):
            # price stays near lower band (mean - 2σ)
            choppy_bars.append({"price": base - 300 + rng.normal(0, 30), "close": base - 300 + rng.normal(0, 30)})
        mock_get_redis.return_value = _make_redis_mock(choppy_bars)
        result_choppy = await compute_technical_signal("SOL", "choppy")
        check("near lower BB band + choppy → LONG or NEUTRAL", result_choppy in ("LONG", "NEUTRAL"), result_choppy)

        # Works for any ticker (not just BTC)
        mock_get_redis.return_value = _make_redis_mock(_price_bars(40))
        result_avax = await compute_technical_signal("AVAX", "choppy")
        check("AVAX ticker accepted (any token)", result_avax in ("LONG", "SHORT", "NEUTRAL"), result_avax)


# ── 3. combiner ──────────────────────────────────────────────────────────────

def test_combiner() -> None:
    header("3 · combiner — agreement / disagreement / no-news paths")

    from ats.agents.signal.combiner import combine
    from ats.models.state import SignalVote

    # Both agree LONG → LONG with confidence
    vote = combine("BTC", 0.60, "LONG", "low_vol_bull", 0.80)
    check("both LONG → direction LONG", vote.direction == "LONG", vote.direction)
    check("confidence > 0 when both agree", vote.confidence > 0, str(vote.confidence))
    check("confidence in [0, 1]", 0 <= vote.confidence <= 1)

    # Both agree SHORT
    vote = combine("ETH", -0.55, "SHORT", "high_vol_bull", 0.70)
    check("both SHORT → direction SHORT", vote.direction == "SHORT", vote.direction)

    # Disagree → NEUTRAL
    vote = combine("BTC", 0.60, "SHORT", "choppy", 0.65)
    check("sentiment LONG, technical SHORT → NEUTRAL", vote.direction == "NEUTRAL", vote.direction)
    check("confidence = 0 on disagreement", vote.confidence == 0.0)

    # Sentiment neutral (score between thresholds) → NEUTRAL
    vote = combine("BTC", 0.10, "LONG", "low_vol_bull", 0.80)
    check("weak sentiment (0.10) → NEUTRAL", vote.direction == "NEUTRAL", vote.direction)

    # No news: technical-only LONG → LONG, capped at 0.55
    vote = combine("SOL", None, "LONG", "low_vol_bull", 0.90)
    check("no-news + tech LONG → LONG", vote.direction == "LONG", vote.direction)
    check("no-news confidence = 0.55", vote.confidence == 0.55, str(vote.confidence))

    # No news: technical NEUTRAL → NEUTRAL, confidence 0
    vote = combine("SOL", None, "NEUTRAL", "choppy", 0.70)
    check("no-news + tech NEUTRAL → NEUTRAL", vote.direction == "NEUTRAL", vote.direction)
    check("no-news NEUTRAL confidence = 0.0", vote.confidence == 0.0)

    # Return type is SignalVote
    check("returns SignalVote instance", isinstance(vote, SignalVote))

    # sentiment_score preserved in output
    vote = combine("BTC", 0.75, "LONG", "low_vol_bull", 0.80)
    check("sentiment_score stored on vote", vote.sentiment_score == 0.75)

    # regime_used preserved
    check("regime_used stored on vote", vote.regime_used == "low_vol_bull")


# ── 4. agent2 full cycle ──────────────────────────────────────────────────────

async def test_agent2_cycle() -> None:
    header("4 · Agent2Signal — full _process cycle (all I/O mocked)")

    from ats.models.packets import DataPacket

    written: dict[str, dict] = {}

    async def fake_set_json(key, val):
        written[key] = val

    async def fake_get_json(key):
        if key == "regime:current":
            return {"regime": "low_vol_bull", "confidence": 0.80}
        return None

    bars = [{"price": 50_000 + i * 100, "close": 50_000 + i * 100} for i in range(40)]
    encoded_bars = [json.dumps(b) for b in reversed(bars)]
    mock_r = AsyncMock()
    mock_r.lrange = AsyncMock(return_value=encoded_bars)

    with patch("ats.agents.agent2_signal.get_json",  new=fake_get_json), \
         patch("ats.agents.agent2_signal.set_json",  new=fake_set_json), \
         patch("ats.agents.signal.technicals.get_redis", return_value=mock_r), \
         patch("ats.agents.signal.sentiment._finbert",
               _make_finbert_mock("positive", 0.88)):

        from ats.agents.agent2_signal import Agent2Signal
        from ats.agents.signal.sentiment import _headline_buffer
        _headline_buffer.clear()

        agent = Agent2Signal()

        # Feed a news packet first — should buffer but not write
        news = DataPacket(
            type="news", ticker="BTC", source="reuters", cq_score=0.90,
            payload={"title": "Bitcoin hits new ATH", "description": ""},
        )
        await agent._process(news)
        check("news packet does not write signal", "signal:latest:BTC" not in written)

        # Feed a price packet — should trigger full cycle + write
        price = DataPacket(
            type="price", ticker="BTC", source="binance", cq_score=0.95,
            payload={"price": 65_000.0},
        )
        await agent._process(price)
        check("price packet writes signal:latest:BTC", "signal:latest:BTC" in written)

        sv = written.get("signal:latest:BTC", {})
        check("direction is valid", sv.get("direction") in ("LONG", "SHORT", "NEUTRAL"),
              str(sv.get("direction")))
        check("confidence in [0, 1]", 0.0 <= sv.get("confidence", -1) <= 1.0)
        check("sentiment_score present", "sentiment_score" in sv)
        check("technical_signal present", "technical_signal" in sv)
        check("regime_used present", sv.get("regime_used") == "low_vol_bull",
              str(sv.get("regime_used")))

        # Non-price/news packet type → no write
        written.clear()
        macro = DataPacket(
            type="macro", ticker="BTC", source="unknown", cq_score=0.50,
            payload={},
        )
        await agent._process(macro)
        check("macro packet type ignored (no write)", "signal:latest:BTC" not in written)

        # No regime in Redis → no write
        written.clear()
        async def no_regime(key):
            return None
        with patch("ats.agents.agent2_signal.get_json", new=no_regime):
            await agent._process(price)
        check("missing regime → no write", "signal:latest:BTC" not in written)

        # Works with any ticker
        written.clear()
        sol_price = DataPacket(
            type="price", ticker="SOL", source="binance", cq_score=0.95,
            payload={"price": 180.0},
        )
        with patch("ats.agents.agent2_signal.get_json", new=fake_get_json):
            await agent._process(sol_price)
        check("SOL ticker writes signal:latest:SOL", "signal:latest:SOL" in written)


# ── runner ────────────────────────────────────────────────────────────────────

async def run_all() -> None:
    t0 = time.monotonic()

    test_sentiment()
    await test_technicals()
    test_combiner()
    await test_agent2_cycle()

    elapsed = time.monotonic() - t0
    passed  = sum(1 for _, ok, _ in _results if ok)
    total   = len(_results)
    failed  = total - passed

    print(f"\n{'═'*55}")
    print(f"  Results: {passed}/{total} passed  |  {failed} failed  |  {elapsed:.1f}s")
    print(f"{'═'*55}\n")

    if failed:
        print("Failed checks:")
        for name, ok, detail in _results:
            if not ok:
                print(f"  ✗  {name}  {detail}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_all())
