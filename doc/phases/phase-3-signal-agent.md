# Phase 3 — Agent 2: Signal Agent
> **Depends on:** Phase 1 (normalized_queue, price_buffer in Redis), Phase 2 (regime:current in Redis)
> **Unlocks:** Phase 6 (Orchestrator collects Signal vote)
> **Estimated effort:** 3–4 days

## Goal

Produce the primary trade signal. Agent 2 combines two independent sub-modules — FinBERT sentiment on news packets and technical indicator analysis on the price buffer — and only emits a directional vote (LONG/SHORT) when both sub-modules independently agree. The regime read from Redis controls which indicators are trusted and how much weight each sub-module carries.

The heavy lift here is the FinBERT model load (~400ms on CPU per batch). Load it once at startup, keep it in memory, batch up to 10 headlines per inference call.

## What gets built

- `ats/agents/agent2_signal.py` — main signal agent, listens on `normalized_queue`
- `ats/agents/signal/sentiment.py` — FinBERT wrapper, CQ-weighted scoring
- `ats/agents/signal/technicals.py` — RSI, MACD, Bollinger Band %B via pandas-ta
- `ats/agents/signal/combiner.py` — merges sentiment + technicals into a final vote

## File structure to create

```
ats/agents/
  agent2_signal.py
  signal/
    __init__.py
    sentiment.py
    technicals.py
    combiner.py
```

---

## Step-by-step implementation

### Step 1 — FinBERT sentiment sub-module

Load the model once. Cache headlines per ticker so batches accumulate before inference.

```python
# ats/agents/signal/sentiment.py
from transformers import pipeline
from collections import defaultdict
from ats.models.packets import DataPacket

# Load at module import time — happens once on agent startup
_finbert = pipeline(
    "text-classification",
    model="ProsusAI/finbert",
    top_k=None,
    device=-1,   # -1 = CPU; set to 0 for CUDA GPU
)

LABEL_SCORE = {"positive": 1.0, "negative": -1.0, "neutral": 0.0}

# Per-ticker pending headline buffer: {ticker: [(text, cq_score), ...]}
_headline_buffer: dict[str, list[tuple[str, float]]] = defaultdict(list)
MAX_BATCH = 10

def buffer_headline(packet: DataPacket):
    text = f"{packet.payload.get('title', '')} {packet.payload.get('description', '')}".strip()
    if text:
        _headline_buffer[packet.ticker].append((text, packet.cq_score))

def compute_sentiment(ticker: str) -> float | None:
    """
    Runs FinBERT on buffered headlines for ticker.
    Returns CQ-weighted average sentiment [-1.0, +1.0], or None if no headlines.
    """
    buffer = _headline_buffer.pop(ticker, [])
    if not buffer:
        return None

    texts = [t for t, _ in buffer[:MAX_BATCH]]
    weights = [w for _, w in buffer[:MAX_BATCH]]

    results = _finbert(texts)   # list of list[{label, score}]

    weighted_scores = []
    for result_list, weight in zip(results, weights):
        # result_list: [{label: "positive", score: 0.9}, ...]
        top = max(result_list, key=lambda x: x["score"])
        direction = LABEL_SCORE[top["label"]]
        weighted_scores.append(direction * top["score"] * weight)

    total_weight = sum(weights[:MAX_BATCH])
    return sum(weighted_scores) / total_weight if total_weight else None
```

### Step 2 — Technical indicators sub-module

Reads the ticker's 60-bar OHLCV buffer from Redis and computes RSI, MACD, and Bollinger Band %B. Which indicator is used depends on the regime.

```python
# ats/agents/signal/technicals.py
import json, pandas as pd
import pandas_ta as ta
from ats.data.redis_client import get_redis
from ats.models.state import Direction, Regime

TRENDING_REGIMES = {"low_vol_bull", "high_vol_bull"}
MEAN_REVERSION_REGIMES = {"choppy"}
STAND_DOWN_REGIMES = {"bear", "high_vol_bear", "crisis"}

async def compute_technical_signal(ticker: str, regime: Regime) -> Direction:
    if regime in STAND_DOWN_REGIMES:
        return "NEUTRAL"

    r = await get_redis()
    raw = await r.lrange(f"price_buffer:{ticker}", 0, 59)
    if len(raw) < 20:
        return "NEUTRAL"

    bars = [json.loads(b) for b in reversed(raw)]
    df = pd.DataFrame(bars)

    if "close" not in df.columns and "price" in df.columns:
        df["close"] = df["price"]
    if "close" not in df.columns:
        return "NEUTRAL"

    close = df["close"].astype(float)

    if regime in TRENDING_REGIMES:
        # MACD histogram drives signal in trending markets
        macd_df = ta.macd(close)
        if macd_df is None or macd_df.empty:
            return "NEUTRAL"
        histogram = macd_df.iloc[-1].get("MACDh_12_26_9", 0)
        if histogram > 0.001:
            return "LONG"
        elif histogram < -0.001:
            return "SHORT"
        return "NEUTRAL"

    elif regime in MEAN_REVERSION_REGIMES:
        # Bollinger Band %B drives signal in choppy markets
        bb_df = ta.bbands(close, length=20)
        if bb_df is None or bb_df.empty:
            return "NEUTRAL"
        pct_b_col = [c for c in bb_df.columns if "BBP" in c]
        if not pct_b_col:
            return "NEUTRAL"
        pct_b = float(bb_df.iloc[-1][pct_b_col[0]])
        if pct_b < 0.20:    # price near lower band → mean reversion LONG
            return "LONG"
        elif pct_b > 0.80:  # price near upper band → mean reversion SHORT
            return "SHORT"
        return "NEUTRAL"

    return "NEUTRAL"
```

### Step 3 — Signal combiner

Both sub-modules must agree for a directional signal to emit. Any disagreement → NEUTRAL.

```python
# ats/agents/signal/combiner.py
from ats.models.state import SignalVote, Direction, Regime

SENTIMENT_LONG_THRESHOLD = 0.25
SENTIMENT_SHORT_THRESHOLD = -0.25

def combine(
    ticker: str,
    sentiment_score: float | None,
    technical_signal: Direction,
    regime: Regime,
    regime_confidence: float,
) -> SignalVote:
    direction: Direction = "NEUTRAL"
    confidence = 0.0

    if sentiment_score is None:
        # No news available — technical-only signal with reduced confidence
        direction = technical_signal
        confidence = 0.55 if technical_signal != "NEUTRAL" else 0.0
    else:
        sentiment_direction: Direction = (
            "LONG" if sentiment_score >= SENTIMENT_LONG_THRESHOLD
            else "SHORT" if sentiment_score <= SENTIMENT_SHORT_THRESHOLD
            else "NEUTRAL"
        )

        if sentiment_direction == technical_signal and sentiment_direction != "NEUTRAL":
            direction = sentiment_direction
            # Confidence = average of normalized sentiment strength and regime confidence
            sentiment_strength = min(abs(sentiment_score), 1.0)
            confidence = round((sentiment_strength + regime_confidence) / 2, 3)
        else:
            direction = "NEUTRAL"
            confidence = 0.0

    return SignalVote(
        direction=direction,
        confidence=confidence,
        sentiment_score=sentiment_score or 0.0,
        technical_signal=technical_signal,
        regime_used=regime,
    )
```

### Step 4 — Agent 2 main class

```python
# ats/agents/agent2_signal.py
import asyncio
from ats.data.queue import normalized_queue
from ats.data.redis_client import get_json, set_json
from ats.models.packets import DataPacket
from ats.agents.signal.sentiment import buffer_headline, compute_sentiment
from ats.agents.signal.technicals import compute_technical_signal
from ats.agents.signal.combiner import combine

class Agent2Signal:
    async def run(self):
        while True:
            packet: DataPacket = await normalized_queue.get()
            await self._process(packet)

    async def _process(self, packet: DataPacket):
        # Buffer news headlines; process price packets immediately
        if packet.type == "news":
            buffer_headline(packet)
            return

        if packet.type not in ("price", "onchain_event"):
            return

        # Read current regime — first action every cycle
        regime_data = await get_json("regime:current")
        if not regime_data:
            return
        regime = regime_data["regime"]
        regime_confidence = regime_data["confidence"]

        sentiment = compute_sentiment(packet.ticker)
        technical = await compute_technical_signal(packet.ticker, regime)
        vote = combine(packet.ticker, sentiment, technical, regime, regime_confidence)

        # Write to Redis for Conversation Layer and Orchestrator
        await set_json(f"signal:latest:{packet.ticker}", vote.model_dump())
```

---

## Validation checklist

- [ ] FinBERT model downloads on first run (`~440MB` — may take a few minutes)
- [ ] `compute_sentiment("BTC")` returns a float after buffering 3+ headlines
- [ ] `compute_technical_signal("BTC", "choppy")` returns LONG/SHORT/NEUTRAL based on BB %B
- [ ] In `bear` or `crisis` regime, technical module always returns NEUTRAL
- [ ] Both sub-modules must agree for `combine()` to emit non-NEUTRAL direction
- [ ] `signal:latest:BTC` key appears in Redis after first price packet is processed

## What Phase 4 and 6 need from this phase

- `signal:latest:{TICKER}` written to Redis after each price/event cycle
- `SignalVote` model (importable from `ats.models.state`)
- `Agent2Signal` class with `run()` method for the orchestrator to call as a node
