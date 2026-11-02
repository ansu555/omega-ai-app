"""
Train the regime HMM on historical daily price data.

Run once before first deploy, then retrain monthly:
    python -m scripts.train_regime_model

By default trains on BTC (global market anchor). Pass --ticker to train on any
token supported by CoinGecko, e.g.:
    python -m scripts.train_regime_model --ticker ethereum
    python -m scripts.train_regime_model --ticker solana --days 365

The training feature schema (return, realized_vol_30d, funding_rate) is
token-agnostic, so the same model file works for regime inference on any asset.
"""
from __future__ import annotations

import argparse
import asyncio
import sys

import httpx
import numpy as np

COINGECKO_MARKET_CHART = "https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart"


async def fetch_price_history(coin_id: str, days: int) -> list[float]:
    """Download daily price history from CoinGecko. Returns list of prices."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            COINGECKO_MARKET_CHART.format(coin_id=coin_id),
            params={"vs_currency": "usd", "days": days, "interval": "daily"},
        )
        resp.raise_for_status()
        raw = resp.json().get("prices", [])
        return [float(p[1]) for p in raw]


def build_training_features(prices: list[float]) -> np.ndarray:
    """
    Build (N, 3) feature matrix from a price series:
      col 0: daily return
      col 1: rolling 30-day realized vol (annualized)
      col 2: funding_rate placeholder (0.0 — not historically available for training)
    """
    arr = np.array(prices, dtype=float)
    returns = np.diff(arr) / arr[:-1]

    vols = np.array([
        np.std(returns[max(0, i - 30):i]) * np.sqrt(365)
        for i in range(1, len(returns) + 1)
    ])
    funding = np.zeros(len(returns))

    features = np.column_stack([returns, vols, funding])
    return features[~np.isnan(features).any(axis=1)]


async def main(coin_id: str, days: int) -> None:
    print(f"Fetching {days}-day price history for '{coin_id}' from CoinGecko…")
    try:
        prices = await fetch_price_history(coin_id, days)
    except httpx.HTTPStatusError as exc:
        print(f"CoinGecko returned {exc.response.status_code}. "
              f"Check that '{coin_id}' is a valid CoinGecko coin ID.")
        sys.exit(1)

    if len(prices) < 60:
        print(f"Only {len(prices)} bars returned — need at least 60. Aborting.")
        sys.exit(1)

    features = build_training_features(prices)
    print(f"Training on {len(features)} daily bars…")

    from ats.agents.regime.hmm_model import regime_hmm
    regime_hmm.train(features)
    print("Done. Model saved to models/regime_hmm.pkl")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train regime HMM")
    parser.add_argument(
        "--coin",
        default="bitcoin",
        help="CoinGecko coin ID (default: bitcoin). Examples: ethereum, solana, avalanche-2",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=730,
        help="Days of history to download (default: 730 = 2 years)",
    )
    args = parser.parse_args()
    asyncio.run(main(args.coin, args.days))
