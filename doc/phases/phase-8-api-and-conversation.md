# Phase 8 — API, WebSocket & Conversation Layer
> **Depends on:** All previous phases
> **Unlocks:** Production deployment (Phase 9, optional)
> **Estimated effort:** 2–3 days

## Goal

Expose the entire ATS to the outside world: a FastAPI server that accepts activation triggers, broadcasts real-time fill events over WebSocket, and serves a Conversation Layer endpoint where users can ask Claude why the system made a specific decision. Claude answers by reading the Decision Receipt from Postgres — fully grounded in actual trade data, no hallucination.

## What gets built

- `ats/api/main.py` — FastAPI app with startup lifecycle, CORS, WebSocket manager
- `ats/api/routes/activations.py` — `POST /api/activations/{id}/execute` — triggers pipeline run
- `ats/api/routes/receipts.py` — `GET /api/receipts/{id}` — fetches a single Decision Receipt
- `ats/api/routes/chat.py` — `POST /api/chat` — Conversation Layer (Claude API + RAG over receipts)
- `ats/api/ws_manager.py` — WebSocket connection manager for real-time fill broadcasts
- `ats/api/conversation/rag.py` — fetches top-N receipts from Postgres as context for Claude

## File structure to create

```
ats/api/
  main.py
  ws_manager.py
  routes/
    __init__.py
    activations.py
    receipts.py
    chat.py
  conversation/
    __init__.py
    rag.py
```

---

## Step-by-step implementation

### Step 1 — WebSocket connection manager

```python
# ats/api/ws_manager.py
from fastapi import WebSocket
import json

class WebSocketManager:
    def __init__(self):
        self._connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._connections.append(ws)

    def disconnect(self, ws: WebSocket):
        self._connections.remove(ws)

    async def broadcast(self, event: dict):
        dead = []
        for ws in self._connections:
            try:
                await ws.send_text(json.dumps(event))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections.remove(ws)

ws_manager = WebSocketManager()
```

### Step 2 — Activations route (trigger a pipeline run)

```python
# ats/api/routes/activations.py
from fastapi import APIRouter
from pydantic import BaseModel
from ats.orchestrator import run_pipeline
from ats.api.ws_manager import ws_manager

router = APIRouter(prefix="/api/activations", tags=["activations"])

class TriggerRequest(BaseModel):
    ticker: str
    event_type: str = "manual"
    event_payload: dict = {}

@router.post("/{activation_id}/execute")
async def execute_activation(activation_id: str, body: TriggerRequest):
    final_state = await run_pipeline(
        ticker=body.ticker,
        trigger_event={"event_type": body.event_type, **body.event_payload},
    )

    # Broadcast result over WebSocket
    await ws_manager.broadcast({
        "type": "pipeline_complete",
        "ticker": body.ticker,
        "consensus": final_state.consensus,
        "receipt_id": final_state.receipt_id,
        "signal": final_state.signal_vote.model_dump() if final_state.signal_vote else None,
        "risk": final_state.risk_decision.model_dump() if final_state.risk_decision else None,
    })

    return {
        "receipt_id": final_state.receipt_id,
        "consensus": final_state.consensus,
        "regime": final_state.regime,
    }
```

### Step 3 — Receipts route

```python
# ats/api/routes/receipts.py
from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from ats.models.receipts import DecisionReceipt
from ats.data.postgres_client import get_session

router = APIRouter(prefix="/api/receipts", tags=["receipts"])

@router.get("/{receipt_id}")
async def get_receipt(receipt_id: str):
    async with get_session() as session:
        result = await session.execute(
            select(DecisionReceipt).where(DecisionReceipt.id == receipt_id)
        )
        receipt = result.scalar_one_or_none()
        if receipt is None:
            raise HTTPException(status_code=404, detail="Receipt not found")
        return {
            "id": receipt.id,
            "ticker": receipt.ticker,
            "created_at": receipt.created_at.isoformat(),
            "regime": receipt.regime,
            "consensus": receipt.consensus,
            "signal_vote": receipt.signal_vote,
            "graph_vote": receipt.graph_vote,
            "risk_decision": receipt.risk_decision,
            "fill_data": receipt.fill_data,
            "pnl": receipt.pnl,
        }
```

### Step 4 — RAG: fetch receipts as context for Claude

```python
# ats/api/conversation/rag.py
from sqlalchemy import select, desc
from ats.models.receipts import DecisionReceipt
from ats.data.postgres_client import get_session
import json

async def fetch_receipt_context(ticker: str | None = None, limit: int = 10) -> str:
    """
    Fetches the most recent Decision Receipts and formats them as plain text
    for injection into Claude's system prompt.
    """
    async with get_session() as session:
        query = select(DecisionReceipt).order_by(desc(DecisionReceipt.created_at)).limit(limit)
        if ticker:
            query = query.where(DecisionReceipt.ticker == ticker.upper())
        result = await session.execute(query)
        receipts = result.scalars().all()

    lines = ["=== Recent Decision Receipts ===\n"]
    for r in receipts:
        lines.append(f"Receipt {r.id} | {r.ticker} | {r.created_at.isoformat()}")
        lines.append(f"  Regime: {r.regime} | Consensus: {r.consensus}")
        if r.signal_vote:
            sv = r.signal_vote
            lines.append(f"  Signal: {sv.get('direction')} @ confidence {sv.get('confidence')}")
        if r.risk_decision:
            rd = r.risk_decision
            if rd.get("approved"):
                lines.append(f"  Risk: APPROVED — {rd.get('shares')} tokens @ ${rd.get('size_usd')}")
                lines.append(f"  Stop: ${rd.get('stop_loss_price')} | TP: ${rd.get('take_profit_price')}")
            else:
                lines.append(f"  Risk: VETOED — {rd.get('veto_code')}")
        if r.fill_data:
            fd = r.fill_data
            lines.append(f"  Fill: {fd.get('avg_price')} | Slippage: {fd.get('slippage', 0):.4f}")
        lines.append("")

    return "\n".join(lines)
```

### Step 5 — Conversation Layer: Claude API with RAG

```python
# ats/api/routes/chat.py
from fastapi import APIRouter
from pydantic import BaseModel
import anthropic
from ats.api.conversation.rag import fetch_receipt_context
from ats.config import settings

router = APIRouter(prefix="/api/chat", tags=["chat"])
client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

class ChatRequest(BaseModel):
    message: str
    ticker: str | None = None

SYSTEM_PROMPT = """You are the ATS (Agentic Trading System) Conversation Layer.
You explain trading decisions made by the system's six AI agents.
Always base your answers on the Decision Receipts provided below.
Do not speculate about trades not in the receipts. Be concise and factual.
If you don't have enough receipt data to answer, say so clearly.

{receipt_context}"""

@router.post("")
async def chat(body: ChatRequest):
    context = await fetch_receipt_context(ticker=body.ticker, limit=10)
    system = SYSTEM_PROMPT.format(receipt_context=context)

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": body.message}],
    )
    return {"response": response.content[0].text}
```

### Step 6 — FastAPI main app with full startup

```python
# ats/api/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from ats.api.ws_manager import ws_manager
from ats.api.routes import activations, receipts, chat
from ats.data.postgres_client import create_tables
from ats.agents.agent6_execution import Agent6Execution

app = FastAPI(title="ATS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(activations.router)
app.include_router(receipts.router)
app.include_router(chat.router)

_agent6 = Agent6Execution()

@app.on_event("startup")
async def startup():
    await create_tables()
    await _agent6.start()   # launches stop-loss monitor background task

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()   # keep connection alive; server pushes events
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
```

---

## Connecting the frontend

The Next.js terminal at `/terminal` connects to `ws://localhost:8000/ws` and listens for `pipeline_complete` events. Each event updates the signal card in real-time:

```ts
// components/terminal/usePipelineFeed.ts
const ws = new WebSocket(process.env.NEXT_PUBLIC_ATS_WS_URL!)
ws.onmessage = (e) => {
  const event = JSON.parse(e.data)
  if (event.type === "pipeline_complete") {
    // update signal card, refresh receipt
  }
}
```

---

## Validation checklist

- [ ] `POST /api/activations/test/execute` with `{"ticker": "BTC"}` runs the full pipeline and returns a receipt ID
- [ ] `GET /api/receipts/{id}` returns the receipt written in the previous step
- [ ] `POST /api/chat` with `{"message": "Why did we short WBTC?", "ticker": "WBTC"}` returns a Claude response grounded in receipts
- [ ] WebSocket client at `ws://localhost:8000/ws` receives a `pipeline_complete` event after each trigger
- [ ] Stop-loss monitor is running (check logs for background task startup message)
- [ ] CORS allows requests from `localhost:3000` (Next.js dev server)

## System is now end-to-end complete

At this point all six agents are running, the orchestrator coordinates them, trades execute on Binance, and users can query the Conversation Layer for explanations. The full tick-to-fill pipeline described in [ATS_Agent_Execution_Flow.md](../ATS_Agent_Execution_Flow.md) Section 4.2 is operational.
