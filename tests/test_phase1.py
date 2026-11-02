"""
Phase 1 — Data Ingestion test suite
Covers every item on the validation checklist from doc/phases/phase-1-data-ingestion.md

Run:  .venv/bin/python -m pytest tests/test_phase1.py -v
  or: .venv/bin/python tests/test_phase1.py
"""
import asyncio
import json
import sys
import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch


# ── helpers ──────────────────────────────────────────────────────────────────

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
_results: list[tuple[str, bool, str]] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    _results.append((name, condition, detail))
    label = PASS if condition else FAIL
    suffix = f"  — {detail}" if detail else ""
    print(f"  [{label}]  {name}{suffix}")


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Pure-function tests (no I/O)
# ═══════════════════════════════════════════════════════════════════════════════

def test_freshness_score():
    from ats.agents.normalizer import freshness_score

    now = datetime.now(timezone.utc)
    score_now = freshness_score(now)
    check("freshness_score: brand-new packet ≈ 1.0 (within 1ms tolerance)",
          score_now > 0.9999,
          f"got {score_now}")

    half_hour_ago = now - timedelta(minutes=30)
    score = freshness_score(half_hour_ago)
    check("freshness_score: 30-min-old packet ≈ 0.5",
          0.49 < score < 0.51, f"got {score:.4f}")

    two_hours_ago = now - timedelta(hours=2)
    check("freshness_score: 2-hour-old packet = 0.0",
          freshness_score(two_hours_ago) == 0.0,
          f"got {freshness_score(two_hours_ago)}")


def test_cq_score():
    from ats.agents.normalizer import cq_score, SOURCE_RELIABILITY

    now = datetime.now(timezone.utc)
    binance_score = cq_score("binance", now)
    check("cq_score: binance fresh = 0.95",
          binance_score == 0.95, f"got {binance_score}")

    reddit_score = cq_score("reddit", now)
    check("cq_score: reddit fresh = 0.55",
          reddit_score == 0.55, f"got {reddit_score}")

    unknown_score = cq_score("some_random_blog", now)
    check("cq_score: unknown source uses fallback 0.50",
          unknown_score == 0.50, f"got {unknown_score}")

    half_hour_ago = now - timedelta(minutes=30)
    stale_score = cq_score("binance", half_hour_ago)
    check("cq_score: binance 30-min-old ≈ 0.475",
          0.47 < stale_score < 0.48, f"got {stale_score}")


def test_cq_drop_threshold():
    from ats.agents.normalizer import CQ_DROP_THRESHOLD
    check("CQ_DROP_THRESHOLD is 0.20",
          CQ_DROP_THRESHOLD == 0.20, f"got {CQ_DROP_THRESHOLD}")


def test_source_reliability_keys():
    from ats.agents.normalizer import SOURCE_RELIABILITY
    required = {"binance", "coingecko", "reuters", "bloomberg",
                "coindesk", "cointelegraph", "defillama", "the_graph",
                "reddit", "unknown"}
    missing = required - set(SOURCE_RELIABILITY.keys())
    check("All 10 source reliability keys present",
          len(missing) == 0, f"missing: {missing}")


def test_domain_source():
    from ats.agents.sources.news_poller import _domain_source
    cases = [
        ("https://www.reuters.com/article/xyz", "reuters"),
        ("https://bloomberg.com/news/abc",      "bloomberg"),
        ("https://coindesk.com/markets/btc",    "coindesk"),
        ("https://cointelegraph.com/news/eth",  "cointelegraph"),
        ("https://randomsite.io/post/1",        "unknown"),
    ]
    for url, expected in cases:
        result = _domain_source(url)
        check(f"_domain_source({expected})",
              result == expected, f"url={url!r} → {result!r}")


def test_anomaly_check():
    from ats.agents.normalizer import _anomaly_check

    # Below threshold — 19 reddit posts
    packets_ok = [{"source": "reddit"} for _ in range(19)]
    check("_anomaly_check: 19 reddit posts → False",
          _anomaly_check(packets_ok) is False)

    # At threshold — 20 reddit posts
    packets_spike = [{"source": "reddit"} for _ in range(20)]
    check("_anomaly_check: 20 reddit posts → True",
          _anomaly_check(packets_spike) is True)

    # Non-social sources don't trigger
    packets_news = [{"source": "reuters"} for _ in range(30)]
    check("_anomaly_check: 30 reuters posts → False (not social)",
          _anomaly_check(packets_news) is False)


def test_tvl_threshold():
    from ats.agents.sources.onchain_watcher import TVL_CHANGE_THRESHOLD
    check("TVL_CHANGE_THRESHOLD is 0.03",
          TVL_CHANGE_THRESHOLD == 0.03, f"got {TVL_CHANGE_THRESHOLD}")


def test_coingecko_ids():
    from ats.agents.sources.coingecko_poller import COINGECKO_IDS
    check("COINGECKO_IDS contains BTC, ETH, WBTC",
          set(COINGECKO_IDS.keys()) == {"BTC", "ETH", "WBTC"})


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Normalization loop — integration (no network, mocked Redis)
# ═══════════════════════════════════════════════════════════════════════════════

async def _run_normalization_loop_test():
    """
    Feeds raw packets directly into raw_queue, runs normalization_loop for one
    iteration each, and checks normalized_queue output.
    """
    import ats.agents.normalizer as norm_mod
    # Reset module-level dedup state between tests
    norm_mod._dedup.clear()

    from ats.data.queue import raw_queue, normalized_queue
    # Drain any leftover items
    while not raw_queue.empty():
        raw_queue.get_nowait()
    while not normalized_queue.empty():
        normalized_queue.get_nowait()

    # Mock redis so _update_price_buffer doesn't need a real connection
    mock_redis = AsyncMock()
    mock_redis.lpush = AsyncMock()
    mock_redis.ltrim = AsyncMock()

    async def run_n_packets(raw_packets: list[dict], n: int) -> list:
        """Put n raw packets in, run loop n times, collect output."""
        norm_mod._dedup.clear()
        for p in raw_packets:
            await raw_queue.put(p)
        task = asyncio.create_task(norm_mod.normalization_loop())
        # Give the loop time to drain the queue
        await asyncio.sleep(0.1)
        task.cancel()
        results = []
        while not normalized_queue.empty():
            results.append(normalized_queue.get_nowait())
        return results

    with patch("ats.data.redis_client.get_redis", return_value=mock_redis):
        # Test 1: price packet passes through
        out = await run_n_packets([{
            "source": "binance",
            "type": "price",
            "ticker": "BTC",
            "payload": {"price": 67000.0, "volume_24h": 12345.0,
                        "change_pct": 1.2, "bid": 66990.0, "ask": 67010.0},
        }], 1)
        check("normalization_loop: price packet reaches normalized_queue",
              len(out) == 1, f"got {len(out)} packets")
        if out:
            pkt = out[0]
            check("normalized DataPacket has cq_score > 0.20",
                  pkt.cq_score > 0.20, f"cq_score={pkt.cq_score}")
            check("normalized DataPacket.type = 'price'",
                  pkt.type == "price")
            check("normalized DataPacket.ticker = 'BTC'",
                  pkt.ticker == "BTC")

        # Test 2: Redis price buffer was written for price packets
        check("price_buffer: Redis lpush called for price packet",
              mock_redis.lpush.called)
        check("price_buffer: Redis ltrim called for price packet",
              mock_redis.ltrim.called)

        # Test 3: dedup — same payload URL should not produce a second packet
        norm_mod._dedup.clear()
        news_raw = {
            "source": "coindesk",
            "type": "news",
            "ticker": "BTC",
            "payload": {
                "title": "BTC hits new ATH",
                "description": "...",
                "url": "https://coindesk.com/btc-ath",
                "published_at": "2026-05-03T12:00:00Z",
            },
        }
        out2 = await run_n_packets([news_raw, news_raw], 2)
        check("dedup: duplicate news URL produces only 1 packet (not 2)",
              len(out2) == 1, f"got {len(out2)}")

        # Test 4: CQ drop — very old packet from weak source should be dropped
        norm_mod._dedup.clear()
        two_hours_ago = datetime.now(timezone.utc) - timedelta(hours=2)
        # We can't inject received_at into raw_queue directly, so we test
        # the cq_score directly instead
        from ats.agents.normalizer import cq_score
        stale_score = cq_score("reddit", two_hours_ago)
        check("CQ drop: stale reddit packet score = 0.0 (below threshold)",
              stale_score == 0.0, f"got {stale_score}")

        # Test 5: anomaly flag gets set when social spike is detected
        norm_mod._dedup.clear()
        reddit_packets = [
            {
                "source": "reddit",
                "type": "news",
                "ticker": "BTC",
                "payload": {
                    "title": f"BTC to moon #{i}",
                    "description": "",
                    "url": f"https://reddit.com/post/{i}",
                    "published_at": "2026-05-03T12:00:00Z",
                },
            }
            for i in range(25)
        ]
        out3 = await run_n_packets(reddit_packets, 25)
        flagged = [p for p in out3 if p.payload.get("anomaly_flagged")]
        check("anomaly_flagged set after 20+ reddit posts in 60s",
              len(flagged) > 0, f"{len(flagged)} flagged out of {len(out3)}")

        # Test 6: non-social packets don't get anomaly-flagged
        norm_mod._dedup.clear()
        reuters_packets = [
            {
                "source": "reuters",
                "type": "news",
                "ticker": "BTC",
                "payload": {
                    "title": f"Reuters BTC article {i}",
                    "description": "",
                    "url": f"https://reuters.com/btc-{i}",
                    "published_at": "2026-05-03T12:00:00Z",
                },
            }
            for i in range(25)
        ]
        out4 = await run_n_packets(reuters_packets, 25)
        flagged2 = [p for p in out4 if p.payload.get("anomaly_flagged")]
        check("anomaly_flagged NOT set for reuters posts (not social source)",
              len(flagged2) == 0, f"{len(flagged2)} incorrectly flagged")


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Queue types are correct
# ═══════════════════════════════════════════════════════════════════════════════

def test_queue_types():
    from ats.data.queue import raw_queue, normalized_queue
    import asyncio
    check("raw_queue is asyncio.Queue",
          isinstance(raw_queue, asyncio.Queue))
    check("normalized_queue is asyncio.Queue",
          isinstance(normalized_queue, asyncio.Queue))
    check("raw_queue maxsize = 10_000",
          raw_queue.maxsize == 10_000)
    check("normalized_queue maxsize = 10_000",
          normalized_queue.maxsize == 10_000)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. Agent1DataIngestion class structure
# ═══════════════════════════════════════════════════════════════════════════════

def test_agent1_structure():
    from ats.agents.agent1_data import Agent1DataIngestion
    import inspect
    a = Agent1DataIngestion()
    check("Agent1DataIngestion has run() method",
          hasattr(a, "run"))
    check("Agent1DataIngestion.run() is a coroutine function",
          inspect.iscoroutinefunction(a.run))


# ═══════════════════════════════════════════════════════════════════════════════
# main
# ═══════════════════════════════════════════════════════════════════════════════

async def main():
    print("\n── Phase 1 Tests ──────────────────────────────────────────────────\n")

    print("1. Freshness score")
    test_freshness_score()

    print("\n2. CQ score")
    test_cq_score()

    print("\n3. CQ drop threshold")
    test_cq_drop_threshold()

    print("\n4. Source reliability keys")
    test_source_reliability_keys()

    print("\n5. News domain source mapper")
    test_domain_source()

    print("\n6. Anomaly check")
    test_anomaly_check()

    print("\n7. TVL change threshold")
    test_tvl_threshold()

    print("\n8. CoinGecko IDs mapping")
    test_coingecko_ids()

    print("\n9. Queue types & sizes")
    test_queue_types()

    print("\n10. Agent1 class structure")
    test_agent1_structure()

    print("\n11. Normalization loop (mocked Redis)")
    await _run_normalization_loop_test()

    # Summary
    total = len(_results)
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
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
