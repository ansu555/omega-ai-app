# Phase 6 — Orchestrator & LangGraph
> **Depends on:** Phase 3 (Agent2Signal), Phase 4 (Agent3Graph), Phase 5 (Agent5Risk)
> **Unlocks:** Phase 7 (Execution Agent receives approved orders from Orchestrator)
> **Estimated effort:** 2 days

## Goal

Wire all agents together into a single coordinated pipeline. The Orchestrator is a LangGraph `StateGraph` — not an agent itself but a coordination protocol that defines execution order, collects all votes into `AgentState`, applies consensus rules, and conditionally routes to execution or terminates the cycle. Every analysis cycle starts and ends here.

After this phase the full signal → vote → risk → decision pipeline runs end-to-end, and Decision Receipts are written to Postgres for every cycle whether a trade is placed or skipped.

## What gets built

- `ats/orchestrator/graph.py` — LangGraph StateGraph definition
- `ats/orchestrator/state.py` — `AgentState` adapter for LangGraph
- `ats/orchestrator/nodes.py` — one async node function per agent
- `ats/orchestrator/consensus.py` — consensus rule evaluator
- `ats/orchestrator/receipt_writer.py` — writes `DecisionReceipt` to Postgres

## File structure to create

```
ats/orchestrator/
  __init__.py
  graph.py
  nodes.py
  consensus.py
  receipt_writer.py
```

---

## Step-by-step implementation

### Step 1 — LangGraph node functions

Each node is an async function that receives `AgentState`, does work, and returns an updated copy.

```python
# ats/orchestrator/nodes.py
import asyncio
from ats.models.state import AgentState
from ats.data.redis_client import get_json

# Import agents
from ats.agents.agent2_signal import Agent2Signal
from ats.agents.agent3_graph import Agent3Graph
from ats.agents.agent5_risk import Agent5Risk

_agent2 = Agent2Signal()
_agent3 = Agent3Graph()
_agent5 = Agent5Risk()

async def regime_node(state: AgentState) -> AgentState:
    """Read current regime from Redis. This is instantaneous — regime was set up to 15min ago."""
    data = await get_json("regime:current")
    if data:
        state.regime = data["regime"]
        state.regime_confidence = data["confidence"]
    else:
        state.regime = "choppy"
        state.regime_confidence = 0.50
    return state

async def signal_and_graph_node(state: AgentState) -> AgentState:
    """
    Run Agent 2 (Signal) and Agent 3 (Graph) in parallel — both get the regime.
    Fan-out: both receive same input state, results merged back.
    """
    # We need the trigger packet — rebuild a minimal DataPacket from state
    from ats.models.packets import DataPacket
    from datetime import datetime, timezone

    trigger_packet = DataPacket(
        type="onchain_event",
        ticker=state.trigger_ticker,
        payload=state.trigger_event,
        cq_score=state.trigger_event.get("cq_score", 0.80),
        source=state.trigger_event.get("source", "unknown"),
        received_at=datetime.now(timezone.utc),
    )

    # Signal Agent: reads regime from state, runs FinBERT + technicals
    from ats.data.redis_client import get_json as _get_json
    from ats.agents.signal.sentiment import compute_sentiment, buffer_headline
    from ats.agents.signal.technicals import compute_technical_signal
    from ats.agents.signal.combiner import combine

    sentiment = compute_sentiment(state.trigger_ticker)
    technical = await compute_technical_signal(state.trigger_ticker, state.regime)
    signal_vote = combine(
        state.trigger_ticker, sentiment, technical,
        state.regime, state.regime_confidence
    )

    # Graph Agent: runs in parallel using the same sentiment score
    graph_vote = await _agent3.analyze(trigger_packet, sentiment or 0.0)

    state.signal_vote = signal_vote
    state.graph_vote = graph_vote
    return state

async def risk_node(state: AgentState) -> AgentState:
    """Agent 5 evaluates after both Signal and Graph complete (fan-in)."""
    risk_decision = await _agent5.evaluate(state)
    state.risk_decision = risk_decision
    return state
```

### Step 2 — Consensus rules

```python
# ats/orchestrator/consensus.py
from ats.models.state import AgentState, Consensus

HIGH_CONFIDENCE_THRESHOLD = 0.75
MIN_CONFIDENCE_THRESHOLD  = 0.60

def evaluate_consensus(state: AgentState) -> Consensus:
    risk = state.risk_decision
    signal = state.signal_vote

    # Risk veto is absolute — no override possible
    if not risk or not risk.approved:
        return "SKIP"

    if not signal or signal.direction == "NEUTRAL":
        return "SKIP"

    if signal.confidence >= HIGH_CONFIDENCE_THRESHOLD:
        return "EXECUTE"

    if signal.confidence >= MIN_CONFIDENCE_THRESHOLD:
        # Could escalate to assisted mode — for now SKIP
        return "SKIP"

    return "SKIP"
```

### Step 3 — Decision Receipt writer

```python
# ats/orchestrator/receipt_writer.py
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from ats.models.receipts import DecisionReceipt
from ats.models.state import AgentState, Consensus

async def write_receipt(
    state: AgentState,
    consensus: Consensus,
    session: AsyncSession,
) -> str:
    receipt_id = str(uuid.uuid4())
    receipt = DecisionReceipt(
        id=receipt_id,
        ticker=state.trigger_ticker,
        created_at=datetime.now(timezone.utc),
        trigger_event=state.trigger_event,
        regime=state.regime,
        signal_vote=state.signal_vote.model_dump() if state.signal_vote else None,
        graph_vote=state.graph_vote.model_dump() if state.graph_vote else None,
        risk_decision=state.risk_decision.model_dump() if state.risk_decision else None,
        consensus=consensus,
        fill_data=None,
        pnl=None,
    )
    session.add(receipt)
    await session.commit()
    return receipt_id
```

### Step 4 — LangGraph StateGraph

```python
# ats/orchestrator/graph.py
from langgraph.graph import StateGraph, END
from ats.orchestrator.nodes import regime_node, signal_and_graph_node, risk_node
from ats.orchestrator.consensus import evaluate_consensus
from ats.orchestrator.receipt_writer import write_receipt
from ats.models.state import AgentState
from ats.data.postgres_client import get_session

def build_pipeline() -> StateGraph:
    graph = StateGraph(AgentState)

    # Register nodes
    graph.add_node("regime", regime_node)
    graph.add_node("signal_and_graph", signal_and_graph_node)
    graph.add_node("risk", risk_node)
    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("execution", execution_node)   # implemented in Phase 7

    # Edges define execution order
    graph.set_entry_point("regime")
    graph.add_edge("regime", "signal_and_graph")
    graph.add_edge("signal_and_graph", "risk")
    graph.add_edge("risk", "orchestrator")

    # Conditional routing: EXECUTE → execution node, SKIP → END
    graph.add_conditional_edges(
        "orchestrator",
        lambda state: state.consensus,
        {"EXECUTE": "execution", "SKIP": END},
    )
    graph.add_edge("execution", END)

    return graph.compile()

async def orchestrator_node(state: AgentState) -> AgentState:
    """Collect votes, apply consensus, write receipt."""
    consensus = evaluate_consensus(state)
    state.consensus = consensus

    async with get_session() as session:
        receipt_id = await write_receipt(state, consensus, session)
    state.receipt_id = receipt_id

    return state

# Placeholder — replaced in Phase 7
async def execution_node(state: AgentState) -> AgentState:
    print(f"[Phase 7 stub] Would execute: {state.risk_decision}")
    return state
```

### Step 5 — Trigger entry point

How to kick off a pipeline cycle from a `DataPacket`:

```python
# ats/orchestrator/__init__.py
from ats.orchestrator.graph import build_pipeline
from ats.models.state import AgentState

_pipeline = build_pipeline()

async def run_pipeline(ticker: str, trigger_event: dict) -> AgentState:
    initial_state = AgentState(
        trigger_ticker=ticker,
        trigger_event=trigger_event,
    )
    final_state = await _pipeline.ainvoke(initial_state)
    return final_state
```

---

## Execution order in LangGraph

```
regime_node
    │
signal_and_graph_node   ← Agent 2 + Agent 3 run in parallel inside this node
    │
risk_node               ← Agent 5 receives both votes
    │
orchestrator_node       ← applies consensus, writes Decision Receipt to Postgres
    │
    ├── EXECUTE → execution_node (Phase 7)
    └── SKIP → END
```

---

## Validation checklist

- [ ] `run_pipeline("WBTC", {"event_type": "tvl_change", "change_pct": -5.0})` completes without error
- [ ] `final_state.regime` is set to a valid regime label
- [ ] `final_state.signal_vote` is populated with direction and confidence
- [ ] `final_state.risk_decision` is populated (approved or vetoed)
- [ ] `final_state.consensus` is either `EXECUTE` or `SKIP`
- [ ] A row appears in `decision_receipts` table in Postgres after each pipeline run
- [ ] SKIP cycles still write a Decision Receipt (no fill_data, pnl = null)
- [ ] Crisis regime always produces `SKIP` regardless of signal confidence

## What Phase 7 needs from this phase

- `orchestrator_node` calling `execution_node` with `state.risk_decision` containing full position spec
- `receipt_id` in state so Phase 7 can update the receipt with fill data
- `run_pipeline(ticker, event)` entry point callable from API routes
