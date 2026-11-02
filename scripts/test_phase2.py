"""
Phase 2 test suite — run without Redis or live price data.

Tests:
  1. price_reader  — compute_returns / compute_realized_vol (pure math, no Redis)
  2. funding_rate  — live Binance API call (requires internet)
  3. feature_builder — with synthetic prices injected (no Redis, funding from live API)
  4. hmm_model    — train on synthetic data, predict, save/reload weights
  5. training script logic — end-to-end feature building from a synthetic price series
  6. multi-token feature builder — batch call with two synthetic tickers

Run from repo root:
    .venv/bin/python -m scripts.test_phase2
"""
from __future__ import annotations

import asyncio
import sys
import time
import numpy as np
from pathlib import Path
from unittest.mock import AsyncMock, patch

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


# ── synthetic price series ────────────────────────────────────────────────────

def make_prices(n: int = 90, seed: int = 42) -> list[float]:
    rng = np.random.default_rng(seed)
    prices = [50_000.0]
    for _ in range(n - 1):
        prices.append(prices[-1] * (1 + rng.normal(0, 0.02)))
    return prices


# ─────────────────────────────────────────────────────────────────────────────
# 1. price_reader — pure math
# ─────────────────────────────────────────────────────────────────────────────

def test_price_reader_math() -> None:
    header("1 · price_reader — compute_returns / compute_realized_vol")
    from ats.agents.regime.price_reader import compute_returns, compute_realized_vol

    prices = make_prices(60)
    returns = compute_returns(prices)

    check("returns length = prices - 1", len(returns) == len(prices) - 1,
          f"len={len(returns)}")
    check("returns are finite", np.all(np.isfinite(returns)))

    vol = compute_realized_vol(prices, window=30)
    check("realized vol > 0", vol > 0, f"vol={vol:.4f}")
    check("realized vol < 5.0 (annualized, reasonable range)", vol < 5.0)


# ─────────────────────────────────────────────────────────────────────────────
# 2. funding_rate — live Binance call
# ─────────────────────────────────────────────────────────────────────────────

async def test_funding_rate_live() -> None:
    header("2 · funding_rate — live Binance perpetual API")
    from ats.agents.regime.funding_rate import get_funding_rates, get_avg_funding_rate

    rates = await get_funding_rates(["BTCUSDT", "ETHUSDT"])
    check("got at least one rate", len(rates) > 0, str(rates))
    if rates:
        for sym, r in rates.items():
            check(f"{sym} rate is finite float", isinstance(r, float) and np.isfinite(r),
                  f"{r:.6f}")

    avg = await get_avg_funding_rate()
    check("avg funding rate is float", isinstance(avg, float))
    check("avg rate in realistic range [-0.01, 0.01]", -0.01 <= avg <= 0.01,
          f"{avg:.6f}")

    # Custom pair: SOL (may not always have perp data, just check no crash)
    sol_rates = await get_funding_rates(["SOLUSDT"])
    check("SOLUSDT fetch doesn't crash", True, str(sol_rates))


# ─────────────────────────────────────────────────────────────────────────────
# 3. feature_builder — synthetic prices, no Redis
# ─────────────────────────────────────────────────────────────────────────────

async def test_feature_builder() -> None:
    header("3 · feature_builder — build_features with mock price buffer")
    from ats.agents.regime.feature_builder import build_features, build_multi_token_features

    prices = make_prices(90)

    # Patch get_price_buffer to return our synthetic prices without Redis
    with patch(
        "ats.agents.regime.feature_builder.get_price_buffer",
        new=AsyncMock(return_value=prices),
    ):
        features = await build_features("BTC", prefetched_funding_rate=0.0001)

    check("features not None", features is not None)
    if features is not None:
        check("shape is (1, 3)", features.shape == (1, 3),
              f"shape={features.shape}")
        check("all finite", np.all(np.isfinite(features)))
        check("realized vol > 0", features[0, 1] > 0)
        check("funding rate injected correctly", features[0, 2] == 0.0001)

    # Test with insufficient data (< MIN_BARS)
    with patch(
        "ats.agents.regime.feature_builder.get_price_buffer",
        new=AsyncMock(return_value=make_prices(10)),  # too few
    ):
        feat_short = await build_features("SOL", prefetched_funding_rate=0.0)
    check("returns None when <30 bars", feat_short is None)

    # Multi-token batch
    tickers = ["BTC", "ETH", "SOL"]
    with patch(
        "ats.agents.regime.feature_builder.get_price_buffer",
        new=AsyncMock(return_value=prices),
    ), patch(
        "ats.agents.regime.feature_builder.get_avg_funding_rate",
        new=AsyncMock(return_value=0.00015),
    ):
        batch = await build_multi_token_features(tickers)

    check("batch returns 3 entries", len(batch) == 3, str(list(batch.keys())))
    for t in tickers:
        check(f"batch[{t}] shape (1,3)", t in batch and batch[t].shape == (1, 3))


# ─────────────────────────────────────────────────────────────────────────────
# 4. hmm_model — train, predict, save, reload
# ─────────────────────────────────────────────────────────────────────────────

def test_hmm_model() -> None:
    header("4 · hmm_model — train / predict / persist")
    from ats.agents.regime.hmm_model import RegimeHMM, REGIME_LABELS

    # Build a synthetic training matrix (730 rows, 3 features)
    rng = np.random.default_rng(0)
    prices = np.cumprod(1 + rng.normal(0, 0.02, 800)) * 50_000
    returns = np.diff(prices) / prices[:-1]
    vols = np.array([
        np.std(returns[max(0, i - 30):i]) * np.sqrt(365)
        for i in range(1, len(returns) + 1)
    ])
    features = np.column_stack([returns, vols, np.zeros(len(returns))])
    features = features[~np.isnan(features).any(axis=1)]

    check("training features shape (N, 3)", features.ndim == 2 and features.shape[1] == 3,
          str(features.shape))

    # Use a temp model path so we don't clobber models/regime_hmm.pkl
    import tempfile, pickle
    tmp = Path(tempfile.mkdtemp()) / "test_hmm.pkl"

    hmm = RegimeHMM.__new__(RegimeHMM)
    hmm.model = None

    # Fallback before training
    label_pre, conf_pre = hmm.predict(features[-1:])
    check("fallback label is 'choppy'", label_pre == "choppy", label_pre)
    check("fallback confidence is 0.50", conf_pre == 0.50)

    # Train
    from hmmlearn.hmm import GaussianHMM
    model = GaussianHMM(n_components=6, covariance_type="full",
                        n_iter=100, random_state=42)
    model.fit(features)
    hmm.model = model

    # Predict on a single feature row
    test_row = features[-1:]
    label, conf = hmm.predict(test_row)
    check("label is a valid regime name", label in REGIME_LABELS.values(), label)
    check("confidence in [0, 1]", 0.0 <= conf <= 1.0, f"{conf:.3f}")

    # Save + reload
    with open(tmp, "wb") as f:
        import pickle
        pickle.dump(model, f)
    hmm2 = RegimeHMM.__new__(RegimeHMM)
    hmm2.model = None

    # Monkey-patch MODEL_PATH temporarily
    import ats.agents.regime.hmm_model as hmm_mod
    orig_path = hmm_mod.MODEL_PATH
    hmm_mod.MODEL_PATH = tmp
    try:
        hmm2._load()
        check("reload succeeds", hmm2.model is not None)
        label2, conf2 = hmm2.predict(test_row)
        check("reloaded model gives same label", label2 == label, f"{label2} vs {label}")
    finally:
        hmm_mod.MODEL_PATH = orig_path
        tmp.unlink(missing_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# 5. training script feature logic — end-to-end (no CoinGecko call)
# ─────────────────────────────────────────────────────────────────────────────

def test_training_script_features() -> None:
    header("5 · train_regime_model — feature pipeline (synthetic prices)")
    from scripts.train_regime_model import build_training_features

    prices = make_prices(200)
    features = build_training_features(prices)

    check("features shape (N, 3)", features.ndim == 2 and features.shape[1] == 3,
          str(features.shape))
    check("no NaN in features", not np.isnan(features).any())
    check("funding column is all zeros", np.all(features[:, 2] == 0.0))
    check("returns column is finite", np.all(np.isfinite(features[:, 0])))
    check("vol column > 0", np.all(features[:, 1] >= 0))


# ─────────────────────────────────────────────────────────────────────────────
# 6. agent4 _classify_and_broadcast — mocked Redis + prices
# ─────────────────────────────────────────────────────────────────────────────

async def test_agent4_cycle() -> None:
    header("6 · Agent4RegimeDetection — single classify cycle (mocked I/O)")
    from ats.agents.regime.hmm_model import RegimeHMM, REGIME_LABELS
    from hmmlearn.hmm import GaussianHMM
    import numpy as np

    # Pre-train a tiny model so predict() works
    rng = np.random.default_rng(1)
    p = np.cumprod(1 + rng.normal(0, 0.02, 400)) * 50_000
    r = np.diff(p) / p[:-1]
    v = np.array([np.std(r[max(0, i-30):i]) * np.sqrt(365) for i in range(1, len(r)+1)])
    train_feat = np.column_stack([r, v, np.zeros(len(r))])
    train_feat = train_feat[~np.isnan(train_feat).any(axis=1)]
    ghmm = GaussianHMM(n_components=6, covariance_type="full",
                       n_iter=50, random_state=0)
    ghmm.fit(train_feat)

    import ats.agents.regime.hmm_model as hmm_mod
    hmm_mod.regime_hmm.model = ghmm   # inject trained model for this test

    written: dict[str, object] = {}

    async def fake_set_json(key, val):
        written[key] = val

    async def fake_set_float(key, val):
        written[key] = val

    prices = make_prices(90)

    with patch("ats.agents.agent4_regime.build_features",
               new=AsyncMock(return_value=np.array([[0.01, 0.45, 0.0001]]))), \
         patch("ats.agents.agent4_regime.get_avg_funding_rate",
               new=AsyncMock(return_value=0.0001)), \
         patch("ats.agents.agent4_regime.set_json", new=fake_set_json), \
         patch("ats.agents.agent4_regime.set_float", new=fake_set_float):

        from ats.agents.agent4_regime import Agent4RegimeDetection
        agent = Agent4RegimeDetection()
        await agent._classify_and_broadcast()

    check("regime:current written", "regime:current" in written)
    rc = written.get("regime:current", {})
    check("regime label valid", rc.get("regime") in REGIME_LABELS.values(),
          str(rc.get("regime")))
    check("confidence in [0,1]", 0.0 <= rc.get("confidence", -1) <= 1.0)
    check("btc_vol present", "btc_vol" in rc)
    check("funding_rate present", "funding_rate" in rc)
    check("updated_at present", "updated_at" in rc)
    check("market:btc_vol written", "market:btc_vol" in written)
    check("market:funding_rate written", "market:funding_rate" in written)
    check("regime:updated_at written", "regime:updated_at" in written)


# ─────────────────────────────────────────────────────────────────────────────
# Runner
# ─────────────────────────────────────────────────────────────────────────────

async def run_all() -> None:
    t0 = time.monotonic()

    test_price_reader_math()
    await test_funding_rate_live()
    await test_feature_builder()
    test_hmm_model()
    test_training_script_features()
    await test_agent4_cycle()

    elapsed = time.monotonic() - t0
    passed = sum(1 for _, ok, _ in _results if ok)
    total = len(_results)
    failed = total - passed

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
