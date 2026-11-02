# Phase 4 — Agent 3: Graph & Relationship Agent
> **Depends on:** Phase 1 (normalized_queue, price:{TICKER} in Redis)
> **Unlocks:** Phase 6 (Orchestrator collects Graph vote alongside Signal vote)
> **Estimated effort:** 2 days

## Goal

Catch second-order DeFi effects. When a risk event hits one protocol or token, Agent 3 traverses a pre-built DeFi dependency graph to find every related token and score how much it will be impacted. Tokens that cross the impact threshold are queued for their own full pipeline analysis in the next cycle.

The MVP uses a hardcoded Python dict for the graph — zero infrastructure, runs locally, demo-ready. The production upgrade swaps this dict for a Neo4j database without touching any other agent.

## What gets built

- `ats/agents/agent3_graph.py` — main graph agent
- `ats/agents/graph/protocol_graph.py` — the static DeFi dependency dict (MVP)
- `ats/agents/graph/propagator.py` — traversal logic, impact score computation, secondary queue injection

## File structure to create

```
ats/agents/
  agent3_graph.py
  graph/
    __init__.py
    protocol_graph.py
    propagator.py
```

---

## Step-by-step implementation

### Step 1 — Static DeFi protocol dependency graph

This dict is the MVP graph. Each entry maps a token to its tier-1 and tier-2 connected protocols/tokens, with a base propagation weight. Negative weight = negative propagation (event hurts connected token). Positive = correlated.

Structure: `{trigger_token: {connected_token: weight}}`

```python
# ats/agents/graph/protocol_graph.py

# Base propagation weights. Negative = connected token moves down when trigger is hit negatively.
# Weight magnitude = how strongly the event propagates.
# These are seeded from known DeFi relationships; update nightly from DeFiLlama in production.

TIER1_GRAPH: dict[str, dict[str, float]] = {
    # WBTC → protocols that hold WBTC as collateral or LP constituent
    "WBTC": {
        "AAVE":   -0.90,   # Aave is a primary WBTC collateral market
        "COMP":   -0.70,   # Compound also has WBTC collateral
        "CRV":    -0.65,   # Curve has BTC pools (renBTC, WBTC)
        "BADGER":  -0.80,  # Badger DAO is purpose-built around tokenized BTC
        "REN":    -0.60,   # renBTC bridges, correlated risk
    },
    # USDC → stablecoin depeg risk propagates everywhere
    "USDC": {
        "AAVE":   -1.10,
        "COMP":   -1.00,
        "CRV":    -0.95,   # Curve 3pool, USDC liquidity critical
        "FRAX":   -0.85,
        "CRVUSD": -0.90,
    },
    # ETH → LST ecosystem and ETH-collateralized lending
    "ETH": {
        "STETH":  -0.90,
        "RETH":   -0.85,
        "WSTETH": -0.90,
        "AAVE":   -0.70,
        "COMP":   -0.65,
    },
    # AAVE (protocol event) → tokens that depend on Aave markets
    "AAVE": {
        "WBTC":   -0.55,
        "USDC":   -0.50,
        "ETH":    -0.45,
        "STETH":  -0.50,
    },
    # CRV → Curve ecosystem
    "CRV": {
        "CVX":    -0.85,   # Convex is directly tied to Curve
        "CRVUSD": -0.75,
        "FRAX":   -0.60,
    },
}

# Tier-2 graph: second-degree connections (connected to tier-1 nodes)
TIER2_GRAPH: dict[str, dict[str, float]] = {
    "AAVE": {
        "UNI":   -0.30,
        "LINK":  -0.35,
    },
    "CRV": {
        "AAVE":  -0.40,
        "MKR":   -0.30,
    },
}

def get_tier1(trigger: str) -> dict[str, float]:
    return TIER1_GRAPH.get(trigger.upper(), {})

def get_tier2(trigger: str) -> dict[str, float]:
    return TIER2_GRAPH.get(trigger.upper(), {})
```

### Step 2 — Propagator: traversal + impact scoring

```python
# ats/agents/graph/propagator.py
from ats.agents.graph.protocol_graph import get_tier1, get_tier2
from ats.models.state import GraphVote, Direction

IMPACT_THRESHOLD = 0.20     # tokens below this are not queued
TIER2_DISCOUNT   = 0.50     # tier-2 signals are 50% of tier-1

def compute_impact_scores(
    trigger_ticker: str,
    sentiment_score: float,
) -> dict[str, float]:
    """
    Returns {ticker: impact_score} for all connected tokens above threshold.
    impact_score is signed: negative = bearish impact, positive = bullish.
    """
    scores: dict[str, float] = {}

    tier1 = get_tier1(trigger_ticker)
    for token, weight in tier1.items():
        impact = sentiment_score * weight
        if abs(impact) >= IMPACT_THRESHOLD:
            scores[token] = round(impact, 4)

    tier2 = get_tier2(trigger_ticker)
    for token, weight in tier2.items():
        impact = sentiment_score * weight * TIER2_DISCOUNT
        if abs(impact) >= IMPACT_THRESHOLD:
            if token not in scores:
                scores[token] = round(impact, 4)

    return scores

def build_graph_vote(
    trigger_ticker: str,
    sentiment_score: float,
    impact_scores: dict[str, float],
) -> GraphVote:
    # Trigger ticker direction is directly from the event sentiment
    direction: Direction = (
        "SHORT" if sentiment_score < -0.25
        else "LONG" if sentiment_score > 0.25
        else "NEUTRAL"
    )
    return GraphVote(
        direction=direction,
        impact_scores=impact_scores,
        propagation_count=len(impact_scores),
    )
```

### Step 3 — Secondary token queue

Tokens above the impact threshold get injected back into `normalized_queue` as synthetic events so they go through the full pipeline independently.

```python
# ats/agents/graph/propagator.py  (continued)
from datetime import datetime, timezone
from ats.data.queue import normalized_queue
from ats.models.packets import DataPacket

async def queue_secondary_tokens(
    impact_scores: dict[str, float],
    source_event: DataPacket,
):
    """
    For each impacted token, create a synthetic onchain_event packet
    so it enters the normalized_queue and triggers Signal + Risk analysis.
    """
    for token, impact in impact_scores.items():
        synthetic = DataPacket(
            type="onchain_event",
            ticker=token,
            protocol=source_event.protocol,
            payload={
                "event_type": "graph_propagation",
                "trigger": source_event.ticker,
                "impact_score": impact,
                "source_event": source_event.payload.get("event_type", "unknown"),
            },
            cq_score=source_event.cq_score * 0.85,   # slight decay for secondary events
            source="graph_agent",
            received_at=datetime.now(timezone.utc),
        )
        await normalized_queue.put(synthetic)
```

### Step 4 — Agent 3 main class

```python
# ats/agents/agent3_graph.py
from ats.data.queue import normalized_queue
from ats.models.packets import DataPacket
from ats.agents.graph.propagator import (
    compute_impact_scores, build_graph_vote, queue_secondary_tokens
)
from ats.data.redis_client import set_json

class Agent3Graph:
    async def analyze(self, packet: DataPacket, sentiment_score: float):
        """
        Called by the Orchestrator in parallel with Agent 2.
        packet: the trigger event packet
        sentiment_score: the sentiment from Agent 2's FinBERT run (shared state)
        """
        impact_scores = compute_impact_scores(packet.ticker, sentiment_score)
        vote = build_graph_vote(packet.ticker, sentiment_score, impact_scores)

        # Queue secondary tokens for independent analysis next cycle
        if impact_scores:
            await queue_secondary_tokens(impact_scores, packet)

        # Persist graph vote for Conversation Layer audit trail
        await set_json(f"graph:latest:{packet.ticker}", {
            "direction": vote.direction,
            "impact_scores": vote.impact_scores,
            "propagation_count": vote.propagation_count,
        })

        return vote
```

---

## Production upgrade path — Neo4j

When the static dict becomes a bottleneck (too many protocols to maintain by hand), swap `protocol_graph.py` for a Neo4j client:

```python
# ats/agents/graph/neo4j_graph.py  (production)
from neo4j import AsyncGraphDatabase

driver = AsyncGraphDatabase.driver("bolt://localhost:7687", auth=("neo4j", "password"))

async def get_tier1(trigger: str) -> dict[str, float]:
    async with driver.session() as session:
        result = await session.run(
            "MATCH (t:Token {symbol: $symbol})-[r:DEPENDS_ON]->(n) "
            "RETURN n.symbol AS token, r.weight AS weight",
            symbol=trigger,
        )
        return {r["token"]: r["weight"] async for r in result}
```

No changes needed in `propagator.py` or `agent3_graph.py` — only `protocol_graph.py` is swapped.

---

## Validation checklist

- [ ] `compute_impact_scores("WBTC", -0.79)` returns dict with AAVE, COMP, CRV, BADGER entries
- [ ] Impact scores for tier-2 tokens are ~50% of tier-1 for same source event
- [ ] Tokens with `|impact| < 0.20` are not included in the output
- [ ] `queue_secondary_tokens()` puts synthetic packets in `normalized_queue`
- [ ] `graph:latest:WBTC` key appears in Redis after analysis run
- [ ] `GraphVote.propagation_count` equals the number of tokens above threshold

## What Phase 6 needs from this phase

- `Agent3Graph.analyze(packet, sentiment_score)` async method returning `GraphVote`
- `GraphVote` model importable from `ats.models.state`
- Secondary tokens correctly injected into `normalized_queue` for next-cycle processing
