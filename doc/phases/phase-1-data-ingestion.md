# Phase 1 — Agent 1: Data Ingestion
> **Depends on:** Phase 0 (Redis, Postgres, shared models, queue pair)
> **Unlocks:** Phase 2 (Regime Detection reads price buffers Agent 1 writes)
> **Estimated effort:** 2–3 days

## Goal

Build the system's eyes and ears. Agent 1 runs six concurrent async workers — Binance WebSocket, CoinGecko poller, NewsAPI poller, DeFiLlama on-chain event watcher, Reddit poller, and a macro data poller. Every raw packet they produce flows into `raw_queue`, gets normalized and quality-scored by a central loop, deduplicated, and pushed to `normalized_queue` for Agents 2, 3, and 4 to consume.

By the end of this phase, `normalized_queue` is receiving a steady stream of typed `DataPacket` objects and Redis holds live price data for all configured tickers.

## What gets built

- `ats/agents/agent1_data.py` — main agent class with `run()` method
- `ats/agents/sources/binance_ws.py` — Binance WebSocket worker
- `ats/agents/sources/news_poller.py` — NewsAPI polling worker
- `ats/agents/sources/onchain_watcher.py` — DeFiLlama + The Graph event poller
- `ats/agents/sources/reddit_poller.py` — Reddit sentiment poller
- `ats/agents/sources/coingecko_poller.py` — BTC/ETH price and volume poller
- `ats/agents/normalizer.py` — CQ scoring, dedup, and packet construction

## File structure to create

```
ats/agents/
  agent1_data.py
  normalizer.py
  sources/
    __init__.py
    binance_ws.py
    news_poller.py
    onchain_watcher.py
    reddit_poller.py
    coingecko_poller.py
```

---

## Step-by-step implementation

### Step 1 — Source reliability weights

Each source gets a fixed reliability weight baked in. CQ score = freshness × reliability.

```python
# ats/agents/normalizer.py
from datetime import datetime, timezone

SOURCE_RELIABILITY: dict[str, float] = {
    "binance":    0.95,
    "coingecko":  0.90,
    "reuters":    0.91,
    "bloomberg":  0.93,
    "coindesk":   0.82,
    "cointelegraph": 0.75,
    "defillama":  0.88,
    "the_graph":  0.90,
    "reddit":     0.55,
    "unknown":    0.50,
}

FRESHNESS_DECAY_HOURS = 1.0   # linear decay to 0.0 over this window

def freshness_score(received_at: datetime) -> float:
    age_hours = (datetime.now(timezone.utc) - received_at).total_seconds() / 3600
    return max(0.0, 1.0 - age_hours / FRESHNESS_DECAY_HOURS)

def cq_score(source: str, received_at: datetime) -> float:
    reliability = SOURCE_RELIABILITY.get(source, SOURCE_RELIABILITY["unknown"])
    return round(reliability * freshness_score(received_at), 4)
```

### Step 2 — Binance WebSocket worker

```python
# ats/agents/sources/binance_ws.py
import asyncio, json
import websockets
from ats.data.queue import raw_queue
from ats.config import settings

BINANCE_WS = "wss://stream.binance.com:9443/stream"

async def binance_ws_worker():
    streams = "/".join(f"{t.lower()}@ticker" for t in settings.crypto_tickers)
    url = f"{BINANCE_WS}?streams={streams}"
    while True:
        try:
            async with websockets.connect(url) as ws:
                async for raw in ws:
                    data = json.loads(raw).get("data", {})
                    if not data:
                        continue
                    await raw_queue.put({
                        "source": "binance",
                        "type": "price",
                        "ticker": data["s"].replace("USDT", ""),
                        "payload": {
                            "price": float(data["c"]),
                            "volume_24h": float(data["v"]),
                            "change_pct": float(data["P"]),
                            "bid": float(data["b"]),
                            "ask": float(data["a"]),
                        },
                    })
        except Exception:
            await asyncio.sleep(3)   # backoff on disconnect
```

### Step 3 — NewsAPI poller

```python
# ats/agents/sources/news_poller.py
import asyncio, httpx
from ats.data.queue import raw_queue
from ats.config import settings

POLL_INTERVAL = 60   # seconds

_seen_urls: set[str] = set()

def _domain_source(url: str) -> str:
    for domain, label in [("reuters", "reuters"), ("bloomberg", "bloomberg"),
                          ("coindesk", "coindesk"), ("cointelegraph", "cointelegraph")]:
        if domain in url:
            return label
    return "unknown"

async def news_poller_worker():
    async with httpx.AsyncClient() as client:
        while True:
            for ticker in settings.crypto_tickers:
                symbol = ticker.replace("USDT", "")
                try:
                    resp = await client.get(
                        "https://newsapi.org/v2/everything",
                        params={"q": symbol, "sortBy": "publishedAt",
                                "pageSize": 10, "apiKey": settings.news_api_key},
                        timeout=10,
                    )
                    articles = resp.json().get("articles", [])
                    for article in articles:
                        url = article.get("url", "")
                        if url in _seen_urls:
                            continue
                        _seen_urls.add(url)
                        await raw_queue.put({
                            "source": _domain_source(url),
                            "type": "news",
                            "ticker": symbol,
                            "payload": {
                                "title": article.get("title", ""),
                                "description": article.get("description", ""),
                                "url": url,
                                "published_at": article.get("publishedAt"),
                            },
                        })
                except Exception:
                    pass
            await asyncio.sleep(POLL_INTERVAL)
```

### Step 4 — On-chain event watcher (DeFiLlama + The Graph)

This polls DeFiLlama for protocol TVL changes and The Graph for governance events.

```python
# ats/agents/sources/onchain_watcher.py
import asyncio, httpx
from ats.data.queue import raw_queue
from ats.config import settings

POLL_INTERVAL = 30

_last_tvl: dict[str, float] = {}
TVL_CHANGE_THRESHOLD = 0.03   # flag if TVL drops > 3% in one poll cycle

async def onchain_watcher_worker():
    async with httpx.AsyncClient() as client:
        while True:
            for protocol in settings.defi_protocols:
                try:
                    resp = await client.get(
                        f"{settings.defillama_base_url}/protocol/{protocol}",
                        timeout=10,
                    )
                    data = resp.json()
                    current_tvl = data.get("tvl", [{}])[-1].get("totalLiquidityUSD", 0)
                    prev_tvl = _last_tvl.get(protocol, current_tvl)
                    change_pct = (current_tvl - prev_tvl) / prev_tvl if prev_tvl else 0
                    _last_tvl[protocol] = current_tvl

                    if abs(change_pct) >= TVL_CHANGE_THRESHOLD:
                        await raw_queue.put({
                            "source": "defillama",
                            "type": "onchain_event",
                            "ticker": protocol.upper(),
                            "protocol": protocol,
                            "payload": {
                                "event_type": "tvl_change",
                                "change_pct": round(change_pct * 100, 2),
                                "current_tvl": current_tvl,
                                "prev_tvl": prev_tvl,
                            },
                        })
                except Exception:
                    pass
            await asyncio.sleep(POLL_INTERVAL)
```

### Step 5 — CoinGecko poller (BTC/ETH price + vol for Agent 4)

```python
# ats/agents/sources/coingecko_poller.py
import asyncio, httpx
from ats.data.queue import raw_queue
from ats.data import redis_client
from ats.config import settings

POLL_INTERVAL = 60
COINGECKO_IDS = {"BTC": "bitcoin", "ETH": "ethereum", "WBTC": "wrapped-bitcoin"}

async def coingecko_poller_worker():
    async with httpx.AsyncClient() as client:
        while True:
            ids = ",".join(COINGECKO_IDS.values())
            try:
                resp = await client.get(
                    "https://api.coingecko.com/api/v3/simple/price",
                    params={"ids": ids, "vs_currencies": "usd",
                            "include_24hr_vol": "true", "include_24hr_change": "true",
                            "x_cg_demo_api_key": settings.coingecko_api_key},
                    timeout=10,
                )
                data = resp.json()
                for symbol, cg_id in COINGECKO_IDS.items():
                    item = data.get(cg_id, {})
                    price = item.get("usd", 0)
                    # Write price to Redis immediately for Agent 5 to read
                    await redis_client.set_float(f"price:{symbol}", price)
                    await raw_queue.put({
                        "source": "coingecko",
                        "type": "price",
                        "ticker": symbol,
                        "payload": {
                            "price": price,
                            "volume_24h_usd": item.get("usd_24h_vol", 0),
                            "change_24h_pct": item.get("usd_24h_change", 0),
                        },
                    })
            except Exception:
                pass
            await asyncio.sleep(POLL_INTERVAL)
```

### Step 6 — Central normalizer loop

Reads from `raw_queue`, scores, deduplicates, and pushes to `normalized_queue`.

```python
# ats/agents/normalizer.py  (continued)
import asyncio, uuid
from datetime import datetime, timezone
from ats.data.queue import raw_queue, normalized_queue
from ats.data import redis_client
from ats.models.packets import DataPacket

CQ_DROP_THRESHOLD = 0.20
_dedup: set[str] = set()
MAX_DEDUP_SIZE = 50_000

async def anomaly_check(packets_last_60s: list[dict]) -> bool:
    """Flag if 20+ social posts arrive in 60s — coordinated attack signal."""
    social = [p for p in packets_last_60s if p["source"] in ("reddit",)]
    return len(social) >= 20

async def normalization_loop():
    recent: list[tuple[float, dict]] = []   # (timestamp, raw_packet)
    while True:
        raw = await raw_queue.get()
        now = datetime.now(timezone.utc)

        # Dedup key: for news use URL, for price use ticker+type
        payload = raw.get("payload", {})
        dedup_key = payload.get("url") or f"{raw['type']}:{raw['ticker']}"
        if dedup_key in _dedup:
            continue
        _dedup.add(dedup_key)
        if len(_dedup) > MAX_DEDUP_SIZE:
            _dedup.clear()

        score = cq_score(raw["source"], now)
        if score < CQ_DROP_THRESHOLD:
            continue

        # Anomaly check
        recent = [(ts, p) for ts, p in recent if now.timestamp() - ts < 60]
        recent.append((now.timestamp(), raw))
        if await anomaly_check([p for _, p in recent]):
            raw["payload"]["anomaly_flagged"] = True

        packet = DataPacket(
            id=str(uuid.uuid4()),
            type=raw["type"],
            ticker=raw["ticker"],
            protocol=raw.get("protocol"),
            payload=raw["payload"],
            cq_score=score,
            source=raw["source"],
            received_at=now,
        )

        # Write price buffer to Redis for Agent 2
        if packet.type == "price":
            key = f"price_buffer:{packet.ticker}"
            import json
            r = await redis_client.get_redis()
            buf = await r.lrange(key, 0, -1)
            # Keep last 60 bars
            await r.lpush(key, json.dumps(packet.payload))
            await r.ltrim(key, 0, 59)

        await normalized_queue.put(packet)
```

### Step 7 — Agent 1 main class

```python
# ats/agents/agent1_data.py
import asyncio
from ats.agents.sources.binance_ws import binance_ws_worker
from ats.agents.sources.news_poller import news_poller_worker
from ats.agents.sources.onchain_watcher import onchain_watcher_worker
from ats.agents.sources.coingecko_poller import coingecko_poller_worker
from ats.agents.normalizer import normalization_loop

class Agent1DataIngestion:
    async def run(self):
        await asyncio.gather(
            binance_ws_worker(),
            news_poller_worker(),
            onchain_watcher_worker(),
            coingecko_poller_worker(),
            normalization_loop(),
        )
```

---

## Validation checklist

- [ ] `raw_queue` receives packets within 5 seconds of startup
- [ ] `normalized_queue` receives `DataPacket` objects with `cq_score > 0.20`
- [ ] Redis key `price:BTC` contains a float value after 60 seconds
- [ ] Redis key `price_buffer:BTC` is a list of up to 60 OHLCV dicts
- [ ] Duplicate news URLs are not re-queued (run for 2 minutes, verify dedup set grows then stabilizes)
- [ ] Binance WebSocket auto-reconnects after you manually kill the connection

## What Phase 2 needs from this phase

- `price_buffer:BTC` and `price_buffer:ETH` in Redis (60-bar OHLCV lists)
- `normalized_queue` receiving `DataPacket` objects continuously
- `price:{TICKER}` float keys in Redis for all configured tickers
