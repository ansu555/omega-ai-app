# AXL Integration — Peer-to-Peer ATS Swarm

This document explains how OmeSwap uses [Gensyn AXL](https://docs.gensyn.ai/tech/agent-exchange-layer)
(the Agent eXchange Layer) to run the ATS (Autonomous Trading System) agents
across separate peer-to-peer nodes instead of in a single process.

The integration is additive: when AXL is unavailable, the orchestrator falls
back to local in-process calls, so the rest of the product is unaffected.

## Why AXL

The ATS pipeline already has six well-isolated agents (Data, Regime, Signal,
Graph, Risk, Execution) wired together by a synchronous orchestrator
([`lib/ats/orchestrator.ts`](../lib/ats/orchestrator.ts)). AXL lets each
decision-making agent run on its own peer node — no central message broker,
no servers — while preserving the SSE wire format consumed by the research UI.

```
   Browser → Next API → Orchestrator → AXL Node A (localhost:9002)
                                                ↕  encrypted Yggdrasil mesh
                       AXL Node B (localhost:9012) → MCP Router → ats-agents service
```

## Components

| Path | Role |
|------|------|
| [`lib/axl/`](../lib/axl/) | AXL transport: config, HTTP client, MCP envelope types. |
| [`lib/ats/remote-agents.ts`](../lib/ats/remote-agents.ts) | Remote adapters for Regime / Signal / Graph / Risk that call peer MCP services and re-emit `RunEvent`s. |
| [`lib/ats/orchestrator.ts`](../lib/ats/orchestrator.ts) | Picks the local or AXL transport per run via `OrchestratorInput.transport`. |
| [`scripts/axl-agent-service.ts`](../scripts/axl-agent-service.ts) | Local MCP service that exposes the existing ATS agents over `tools/list` + `tools/call`. |
| [`scripts/axl-demo.ts`](../scripts/axl-demo.ts) | End-to-end check: topology → router → one AXL-backed ATS run. |
| [`app/api/research/run/route.ts`](../app/api/research/run/route.ts) | Accepts an optional `transport` field (`local` \| `axl` \| `auto`). |

## Environment Variables

Add the following to `.env.local`. Only `AXL_PEER_ID` is strictly required to
target a specific peer — everything else has sensible defaults that match the
local two-node demo.

```bash
# Where the ATS agents run
ATS_AGENT_TRANSPORT=auto              # local | axl | auto

# Local AXL node HTTP bridge (Node A — orchestrator side)
AXL_API_URL=http://127.0.0.1:9002

# Peer-side MCP router used by scripts/axl-agent-service.ts
AXL_MCP_ROUTER_URL=http://127.0.0.1:9013

# 64-hex public key of the peer running the agent service (Node B)
AXL_PEER_ID=

# Optional per-role overrides (default to AXL_PEER_ID)
AXL_PEER_REGIME=
AXL_PEER_SIGNAL=
AXL_PEER_GRAPH=
AXL_PEER_RISK=

# Service name registered with the peer's MCP router
AXL_SERVICE_NAME=ats-agents

# Per-call timeout (ms)
AXL_REQUEST_TIMEOUT_MS=60000

# Optional — Node B's HTTP bridge, used only by axl:demo for the topology dump
AXL_PEER_API_URL=http://127.0.0.1:9012
```

## Two-Node Local Demo

This walkthrough runs both AXL nodes on the same machine for hackathon
demos. The same flow works across separate machines — you only need to
exchange public keys.

### 1. Build the AXL node binary

```bash
git clone https://github.com/gensyn-ai/axl.git ~/axl
cd ~/axl
go build -o node ./cmd/node/
```

### 2. Generate two identities

```bash
cd ~/axl
openssl genpkey -algorithm ed25519 -out private.pem
openssl genpkey -algorithm ed25519 -out private-2.pem
```

### 3. Configure both nodes

`~/axl/node-config.json` (Node A — orchestrator side):

```json
{
  "PrivateKeyPath": "private.pem",
  "Peers": [],
  "Listen": ["tls://0.0.0.0:9001"]
}
```

`~/axl/node-config-2.json` (Node B — agent side, MCP enabled):

```json
{
  "PrivateKeyPath": "private-2.pem",
  "Peers": ["tls://127.0.0.1:9001"],
  "api_port": 9012,
  "tcp_port": 7001,
  "router_addr": "http://127.0.0.1",
  "router_port": 9013
}
```

### 4. Start everything (each in its own terminal)

```bash
# Terminal 1 — Node A
cd ~/axl && ./node -config node-config.json

# Terminal 2 — Node B
cd ~/axl && ./node -config node-config-2.json

# Terminal 3 — peer-side MCP router (ships with the AXL repo)
cd ~/axl/integrations
pip install -e .
python -m mcp_routing.mcp_router --port 9013

# Terminal 4 — OmeSwap agent service (uses the local ATS code)
cd /path/to/omeswap
bun run axl:agent --port 7100 --router http://127.0.0.1:9013
```

The agent service registers `ats-agents` with the router and listens for
MCP `tools/call` requests for `run_regime_agent`, `run_signal_agent`,
`run_graph_agent`, and `run_risk_agent`.

### 5. Capture Node B's public key and configure the orchestrator

```bash
curl -s http://127.0.0.1:9012/topology | jq -r .our_public_key
```

Copy the 64-hex key into `.env.local`:

```bash
AXL_PEER_ID=<NODE_B_PUBLIC_KEY>
AXL_PEER_API_URL=http://127.0.0.1:9012
ATS_AGENT_TRANSPORT=axl
```

### 6. Run the demo

```bash
bun run axl:demo BTC solo
```

Expected output:

- Node A topology + public key
- Node B topology + public key
- MCP router service list including `ats-agents`
- Streaming `RunEvent`s tagged `[AXL]` for events that crossed the mesh
- Final consensus + per-agent vote table

### 7. Use AXL inside the app

Send an authenticated POST to `/api/research/run` with `transport: "axl"`:

```bash
curl -N -X POST http://localhost:3000/api/research/run \
  -H 'Content-Type: application/json' \
  -H 'x-wallet-address: 0xYourWallet' \
  -d '{"query":"Should I buy BTC?","ticker":"BTC","mode":"solo","transport":"axl"}'
```

The SSE stream contains the same `RunEvent` shape as a local run, with a
`payload.axl = { peer_id, role }` annotation on every event that originated
on a peer.

## Mode Behaviour

| `transport` | Behaviour |
|-------------|-----------|
| `local` | All agents run in-process — same as before AXL was added. |
| `axl`   | Phase 2/3 agents run on AXL peers; the orchestrator fails fast if the local AXL node is unreachable. |
| `auto`  | Tries AXL; silently falls back to local if the AXL bridge is down. Default for `ATS_AGENT_TRANSPORT=auto`. |

The Data, Consensus, Execution, and persistence steps always run locally so
the user-facing product remains stable.

## Verifying Cross-Node Communication

After running the demo, the easiest proof points for judges are:

```bash
# Two distinct AXL nodes
curl -s http://127.0.0.1:9002/topology | jq -r .our_public_key
curl -s http://127.0.0.1:9012/topology | jq -r .our_public_key

# Peer service is registered with the MCP router
curl -s http://127.0.0.1:9013/services

# Direct mesh round-trip to a tool
curl -s -X POST http://127.0.0.1:9002/mcp/$AXL_PEER_ID/$AXL_SERVICE_NAME \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
