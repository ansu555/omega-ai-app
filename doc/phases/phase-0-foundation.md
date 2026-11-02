# Phase 0 — Foundation & Infrastructure
> **Depends on:** Nothing — this is the starting point
> **Unlocks:** All subsequent phases
> **Estimated effort:** 1–2 days

## Goal

Stand up the full infrastructure skeleton before any agent logic is written. Every agent in the ATS talks through Redis and Postgres — if those aren't running and typed correctly, nothing else works. This phase gives you a running FastAPI server, Redis, Postgres, the shared data models, and a Docker Compose file that starts the entire stack with one command.

## What gets built

- `docker-compose.yml` — Redis + Postgres + FastAPI in one command
- `ats/config.py` — typed env config loaded from `.env`
- `ats/models/packets.py` — `DataPacket` (the normalized data unit every agent passes around)
- `ats/models/state.py` — `AgentState` (the LangGraph shared state object)
- `ats/models/receipts.py` — `DecisionReceipt` (Postgres row schema)
- `ats/data/redis_client.py` — async Redis wrapper with typed get/set helpers
- `ats/data/postgres_client.py` — async Postgres client + table creation
- `ats/data/queue.py` — raw queue and normalized queue (asyncio.Queue wrappers)
- `ats/api/main.py` — bare FastAPI app (no routes yet, just health check)
- Postgres schema migrations in `supabase/migrations/` or `ats/migrations/`

## File structure to create

```
ats/
  config.py
  models/
    __init__.py
    packets.py
    state.py
    receipts.py
  data/
    __init__.py
    redis_client.py
    postgres_client.py
    queue.py
  api/
    __init__.py
    main.py
docker-compose.yml
.env.example
```

---

## Step-by-step implementation

### Step 1 — Docker Compose

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ats
      POSTGRES_USER: ats
      POSTGRES_PASSWORD: ats
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  api:
    build: .
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [redis, postgres]
    command: uvicorn ats.api.main:app --host 0.0.0.0 --port 8000 --reload

volumes:
  pgdata:
```

### Step 2 — Typed config

```python
# ats/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Binance (Agent 1 + Agent 6)
    binance_api_key: str = ""
    binance_secret: str = ""

    # Data sources
    news_api_key: str = ""
    coingecko_api_key: str = ""
    the_graph_api_key: str = ""
    defillama_base_url: str = "https://api.llama.fi"

    # Agent model — any litellm-supported model string + its key
    agent_model: str = "claude-sonnet-4-6"
    agent_api_key: str = ""

    # Supabase (DB + service-role key reused from Next.js app)
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    database_url: str = ""          # postgresql+asyncpg://... from Supabase dashboard
    database_ssl: bool = True

    # Agent smart account — dedicated on-chain execution wallet
    agent_wallet_private_key: str = ""

    # 0G Chain — Newton Testnet (chainId 16600)
    rpc_url: str = "https://evmrpc-testnet.0g.ai"

    # DEX routers — 0G native DEX (replace with live addresses once deployed)
    dex_router_address: str = "0x0000000000000000000000000000000000000010"
    dex_router_v1_address: str = "0x0000000000000000000000000000000000000011"

    # Slippage tolerance in basis points (50 = 0.5%)
    dex_slippage_bps: int = 50

    # Redis (local — only infra we self-host)
    redis_url: str = "redis://localhost:6379"

    # 0G Storage
    zerog_storage_rpc: str = "https://indexer-storage-testnet-standard.0g.ai"
    zerog_storage_private_key: str = ""

    # 0G Compute
    zerog_compute_endpoint: str = "https://compute-api.0g.ai/v1"
    zerog_compute_api_key: str = ""
    zerog_compute_model: str = "qwen3-8b"
    zerog_compute_sealed: bool = False

    # 0G DA
    zerog_da_rpc: str = "https://da-client-testnet.0g.ai"

    # Trading universe
    crypto_tickers: list[str] = ["BTCUSDT", "ETHUSDT", "WBTCUSDT"]
    defi_protocols: list[str] = ["aave", "compound", "curve", "badger"]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
```

### Step 3 — DataPacket model

This is the single normalized unit that Agent 1 produces and all other agents consume.

```python
# ats/models/packets.py
from pydantic import BaseModel, Field
from typing import Literal, Any
from datetime import datetime
import uuid

PacketType = Literal["price", "news", "onchain_event", "sentiment", "macro"]

class DataPacket(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: PacketType
    ticker: str          # e.g. "WBTC", "BTC"
    protocol: str | None = None   # e.g. "aave" — set for on-chain events
    payload: dict[str, Any]
    cq_score: float      # 0.0–1.0; packets below 0.20 are dropped
    received_at: datetime = Field(default_factory=datetime.utcnow)
    source: str          # "binance", "newsapi", "defillama", etc.
```

### Step 4 — AgentState model

This flows through the entire LangGraph pipeline on every cycle.

```python
# ats/models/state.py
from pydantic import BaseModel
from typing import Literal, Any

Direction = Literal["LONG", "SHORT", "NEUTRAL"]
Regime = Literal["low_vol_bull", "high_vol_bull", "choppy", "bear", "high_vol_bear", "crisis"]
Consensus = Literal["EXECUTE", "SKIP"]

class SignalVote(BaseModel):
    direction: Direction
    confidence: float
    sentiment_score: float
    technical_signal: Direction
    regime_used: Regime

class GraphVote(BaseModel):
    direction: Direction
    impact_scores: dict[str, float]   # ticker → impact score for secondary tokens
    propagation_count: int

class RiskDecision(BaseModel):
    approved: bool
    veto_code: str | None = None
    shares: float | None = None
    size_usd: float | None = None
    position_pct: float | None = None
    stop_loss_price: float | None = None
    take_profit_price: float | None = None
    btc_vol_at_decision: float | None = None
    regime_at_decision: Regime | None = None

class AgentState(BaseModel):
    trigger_ticker: str
    trigger_event: dict[str, Any]
    regime: Regime | None = None
    regime_confidence: float | None = None
    signal_vote: SignalVote | None = None
    graph_vote: GraphVote | None = None
    risk_decision: RiskDecision | None = None
    consensus: Consensus | None = None
    receipt_id: str | None = None
```

### Step 5 — DecisionReceipt Postgres schema

```python
# ats/models/receipts.py
from sqlalchemy import Column, String, Float, JSON, DateTime, Boolean
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime

class Base(DeclarativeBase):
    pass

class DecisionReceipt(Base):
    __tablename__ = "decision_receipts"

    id = Column(String, primary_key=True)
    ticker = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    trigger_event = Column(JSON)
    regime = Column(String)
    signal_vote = Column(JSON)
    graph_vote = Column(JSON)
    risk_decision = Column(JSON)
    consensus = Column(String)
    fill_data = Column(JSON, nullable=True)
    pnl = Column(Float, nullable=True)
    closed_at = Column(DateTime, nullable=True)
```

### Step 6 — Redis client

```python
# ats/data/redis_client.py
import redis.asyncio as aioredis
import json
from ats.config import settings

_redis: aioredis.Redis | None = None

async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis

async def set_json(key: str, value: dict) -> None:
    r = await get_redis()
    await r.set(key, json.dumps(value))

async def get_json(key: str) -> dict | None:
    r = await get_redis()
    raw = await r.get(key)
    return json.loads(raw) if raw else None

async def set_float(key: str, value: float) -> None:
    r = await get_redis()
    await r.set(key, str(value))

async def get_float(key: str) -> float | None:
    r = await get_redis()
    raw = await r.get(key)
    return float(raw) if raw else None
```

### Step 7 — asyncio Queue pair

```python
# ats/data/queue.py
import asyncio
from ats.models.packets import DataPacket

raw_queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=10_000)
normalized_queue: asyncio.Queue[DataPacket] = asyncio.Queue(maxsize=10_000)
```

### Step 8 — FastAPI skeleton

```python
# ats/api/main.py
from fastapi import FastAPI
from ats.data.postgres_client import create_tables

app = FastAPI(title="ATS API")

@app.on_event("startup")
async def startup():
    await create_tables()

@app.get("/health")
async def health():
    return {"status": "ok"}
```

---

## Validation checklist

- [ ] `docker-compose up` starts Redis, Postgres, and FastAPI with no errors
- [ ] `curl http://localhost:8000/health` returns `{"status": "ok"}`
- [ ] Postgres tables are created on startup (check with `\dt` in psql)
- [ ] `settings.crypto_tickers` loads correctly from `.env`
- [ ] `DataPacket`, `AgentState`, `DecisionReceipt` all import without errors

## What Phase 1 needs from this phase

- Running Redis on `redis_url`
- Running Postgres with `decision_receipts` table
- `DataPacket` model importable from `ats.models.packets`
- `raw_queue` and `normalized_queue` from `ats.data.queue`
- `settings` from `ats.config`
