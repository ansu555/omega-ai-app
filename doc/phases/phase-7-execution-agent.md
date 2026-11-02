# Phase 7 — Agent 6: Execution Agent
> **Depends on:** Phase 6 (Orchestrator passes approved RiskDecision), Phase 0 (Redis, Postgres)
> **Unlocks:** Phase 8 (API broadcasts fills via WebSocket; Conversation Layer queries receipts)
> **Estimated effort:** 2–3 days

## Goal

Turn a fully risk-approved order spec into an actual on-chain swap via a DEX. Agent 6 uses a dedicated **agent smart account** (private key stored in `AGENT_WALLET_PRIVATE_KEY`, manageable from the portfolio page) to sign and submit swap transactions to the 0G DEX on 0G Chain (Newton Testnet, chainId 16600).

It selects an execution strategy (single swap / TWAP) based on order size, submits the transaction, waits for the receipt, updates portfolio state in Redis, appends fill data to the Decision Receipt in Postgres, and broadcasts the fill event over WebSocket.

A separate background loop monitors every open position's stop-loss price on every incoming price tick — if breached, it immediately submits a market swap exit.

## What gets built

- `ats/agents/agent6_execution.py` — main execution agent
- `ats/agents/execution/dex_client.py` — web3.py wrapper for Trader Joe V2 router
- `ats/agents/execution/order_router.py` — strategy selector (single swap / TWAP)
- `ats/agents/execution/fill_monitor.py` — waits for tx receipt confirmation
- `ats/agents/execution/stop_loss_monitor.py` — background stop-loss watcher
- `ats/agents/execution/portfolio_updater.py` — writes fill to Redis and Postgres

## File structure to create

```
ats/agents/
  agent6_execution.py
  execution/
    __init__.py
    dex_client.py
    order_router.py
    fill_monitor.py
    stop_loss_monitor.py
    portfolio_updater.py
```

## New env vars required

```env
# Agent smart account — dedicated wallet for on-chain execution
# Set this in the portfolio page UI; stored as AGENT_WALLET_PRIVATE_KEY
AGENT_WALLET_PRIVATE_KEY=0x...

# 0G Chain — Newton Testnet (chainId 16600)
RPC_URL=https://evmrpc-testnet.0g.ai

# DEX router — 0G DEX (replace with live addresses once deployed to mainnet)
DEX_ROUTER_ADDRESS=0x0000000000000000000000000000000000000010
DEX_ROUTER_V1_ADDRESS=0x0000000000000000000000000000000000000011

# Slippage tolerance (basis points; 50 = 0.5%)
DEX_SLIPPAGE_BPS=50
```

---

## Step-by-step implementation

### Step 1 — DEX client (web3.py + Trader Joe V2)

```python
# ats/agents/execution/dex_client.py
from web3 import AsyncWeb3, AsyncHTTPProvider
from web3.middleware import SignAndSendRawMiddlewareBuilder
from eth_account import Account
from ats.config import settings

# Minimal ABI — only the functions we call
TRADER_JOE_V2_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
            {"internalType": "address[]", "name": "path", "type": "address[]"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"},
        ],
        "name": "swapExactTokensForTokens",
        "outputs": [{"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {"internalType": "address[]", "name": "path", "type": "address[]"},
        ],
        "name": "getAmountsOut",
        "outputs": [{"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}],
        "stateMutability": "view",
        "type": "function",
    },
]

ERC20_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "spender", "type": "address"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
        ],
        "name": "approve",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# Token addresses on 0G Chain (Newton Testnet)
# TODO: replace with live addresses once 0G DEX deploys to mainnet
TOKEN_ADDRESSES = {
    "W0G":  "0x0000000000000000000000000000000000000001",
    "USDC": "0x0000000000000000000000000000000000000002",
    "USDT": "0x0000000000000000000000000000000000000003",
    "WETH": "0x0000000000000000000000000000000000000004",
    "WBTC": "0x0000000000000000000000000000000000000005",
}

_w3: AsyncWeb3 | None = None

def get_w3() -> AsyncWeb3:
    global _w3
    if _w3 is None:
        account = Account.from_key(settings.agent_wallet_private_key)
        _w3 = AsyncWeb3(AsyncHTTPProvider(settings.rpc_url))
        _w3.middleware_onion.inject(
            SignAndSendRawMiddlewareBuilder.build(account), layer=0
        )
    return _w3

def get_agent_address() -> str:
    return Account.from_key(settings.agent_wallet_private_key).address

async def get_quote(token_in: str, token_out: str, amount_in_wei: int) -> int:
    """Returns expected amount out in token_out's smallest unit."""
    w3 = get_w3()
    router = w3.eth.contract(
        address=w3.to_checksum_address(settings.dex_router_address),
        abi=TRADER_JOE_V2_ABI,
    )
    path = [
        w3.to_checksum_address(TOKEN_ADDRESSES[token_in]),
        w3.to_checksum_address(TOKEN_ADDRESSES[token_out]),
    ]
    amounts = await router.functions.getAmountsOut(amount_in_wei, path).call()
    return amounts[-1]

async def approve_token(token: str, amount_wei: int) -> str:
    """Approve the DEX router to spend token. Returns tx hash."""
    w3 = get_w3()
    token_contract = w3.eth.contract(
        address=w3.to_checksum_address(TOKEN_ADDRESSES[token]),
        abi=ERC20_ABI,
    )
    tx_hash = await token_contract.functions.approve(
        w3.to_checksum_address(settings.dex_router_address),
        amount_wei,
    ).transact({"from": get_agent_address()})
    return tx_hash.hex()

async def swap_exact_tokens(
    token_in: str,
    token_out: str,
    amount_in_wei: int,
    min_amount_out_wei: int,
    deadline_seconds: int = 300,
) -> str:
    """Submit a swap tx. Returns tx hash."""
    import time
    w3 = get_w3()
    router = w3.eth.contract(
        address=w3.to_checksum_address(settings.dex_router_address),
        abi=TRADER_JOE_V2_ABI,
    )
    path = [
        w3.to_checksum_address(TOKEN_ADDRESSES[token_in]),
        w3.to_checksum_address(TOKEN_ADDRESSES[token_out]),
    ]
    tx_hash = await router.functions.swapExactTokensForTokens(
        amount_in_wei,
        min_amount_out_wei,
        path,
        get_agent_address(),
        int(time.time()) + deadline_seconds,
    ).transact({"from": get_agent_address()})
    return tx_hash.hex()
```

### Step 2 — Order router — strategy selection

For DEX swaps there are no "limit orders" in the traditional sense. Strategy:
- **Single swap** (`size_usd <= $10K`): one atomic swap with slippage tolerance
- **TWAP** (`size_usd > $10K`): split into 5 slices over 10 minutes to reduce price impact

```python
# ats/agents/execution/order_router.py
import asyncio
from ats.agents.execution.dex_client import get_quote, approve_token, swap_exact_tokens
from ats.config import settings

SINGLE_SWAP_MAX = 10_000   # USD
TWAP_SLICES     = 5
TWAP_INTERVAL_S = 120      # 2 minutes between slices

def _apply_slippage(amount: int) -> int:
    """Apply slippage tolerance — returns minimum acceptable output."""
    return int(amount * (10_000 - settings.dex_slippage_bps) // 10_000)

async def _do_swap(
    token_in: str, token_out: str, amount_in_wei: int
) -> dict:
    quoted = await get_quote(token_in, token_out, amount_in_wei)
    min_out = _apply_slippage(quoted)
    await approve_token(token_in, amount_in_wei)
    tx_hash = await swap_exact_tokens(token_in, token_out, amount_in_wei, min_out)
    return {"tx_hash": tx_hash, "amount_in_wei": amount_in_wei, "quoted_out_wei": quoted}

async def execute_order(
    token_in: str,
    token_out: str,
    amount_in_wei: int,
    size_usd: float,
) -> dict:
    if size_usd <= SINGLE_SWAP_MAX:
        result = await _do_swap(token_in, token_out, amount_in_wei)
        return {"strategy": "single_swap", "swaps": [result]}

    # TWAP: split into equal slices
    slice_wei = amount_in_wei // TWAP_SLICES
    swaps = []
    for i in range(TWAP_SLICES):
        swap = await _do_swap(token_in, token_out, slice_wei)
        swaps.append(swap)
        if i < TWAP_SLICES - 1:
            await asyncio.sleep(TWAP_INTERVAL_S)

    return {"strategy": "twap", "swaps": swaps}
```

### Step 3 — Fill monitor

Waits for each tx receipt to confirm on-chain.

```python
# ats/agents/execution/fill_monitor.py
import asyncio
from ats.agents.execution.dex_client import get_w3

POLL_INTERVAL = 2    # seconds
MAX_WAIT = 120       # seconds

async def wait_for_receipt(tx_hash: str) -> dict:
    w3 = get_w3()
    for _ in range(MAX_WAIT // POLL_INTERVAL):
        receipt = await w3.eth.get_transaction_receipt(tx_hash)
        if receipt is not None:
            return dict(receipt)
        await asyncio.sleep(POLL_INTERVAL)
    raise TimeoutError(f"Tx {tx_hash} not confirmed after {MAX_WAIT}s")
```

### Step 4 — Portfolio updater

```python
# ats/agents/execution/portfolio_updater.py
import json
from datetime import datetime, timezone
from ats.data.redis_client import get_redis, get_json, set_json

async def update_portfolio_after_fill(
    ticker: str,
    direction: str,
    amount_in_wei: int,
    avg_price: float,
    size_usd: float,
    stop_loss_price: float,
):
    r = await get_redis()
    portfolio = await get_json("portfolio:state") or {
        "total_value_usd": 10_000.0, "cash_usd": 10_000.0,
        "daily_drawdown_pct": 0.0, "open_positions": [],
    }
    portfolio["cash_usd"] -= size_usd
    portfolio["open_positions"].append({
        "ticker": ticker, "direction": direction,
        "amount_in_wei": amount_in_wei, "entry_price": avg_price,
        "size_usd": size_usd, "stop_loss_price": stop_loss_price,
        "opened_at": datetime.now(timezone.utc).isoformat(),
    })
    await set_json("portfolio:state", portfolio)

    fill_record = json.dumps({
        "ticker": ticker, "direction": direction,
        "size_usd": size_usd, "avg_price": avg_price,
        "filled_at": datetime.now(timezone.utc).isoformat(),
    })
    await r.lpush("execution:fills", fill_record)
    await r.ltrim("execution:fills", 0, 999)

async def update_receipt_with_fill(receipt_id: str, fill_data: dict, session):
    from sqlalchemy import update
    from ats.models.receipts import DecisionReceipt
    await session.execute(
        update(DecisionReceipt)
        .where(DecisionReceipt.id == receipt_id)
        .values(fill_data=fill_data)
    )
    await session.commit()
```

### Step 5 — Stop-loss background monitor

```python
# ats/agents/execution/stop_loss_monitor.py
import asyncio
from ats.data.redis_client import get_json, get_float, set_json
from ats.agents.execution.dex_client import get_quote, approve_token, swap_exact_tokens, TOKEN_ADDRESSES
from ats.config import settings

CHECK_INTERVAL = 2   # seconds

async def stop_loss_monitor_loop():
    while True:
        portfolio = await get_json("portfolio:state")
        if not portfolio:
            await asyncio.sleep(CHECK_INTERVAL)
            continue

        open_positions = portfolio.get("open_positions", [])
        for pos in open_positions[:]:
            ticker = pos["ticker"]
            stop = pos["stop_loss_price"]
            direction = pos["direction"]
            current_price = await get_float(f"price:{ticker}") or 0

            breached = (
                (direction == "LONG" and current_price <= stop) or
                (direction == "SHORT" and current_price >= stop)
            )

            if breached and current_price > 0:
                # Exit: swap position token back to USDC
                _exit_map = {"BTCUSDT": "WBTC", "ETHUSDT": "WETH", "WBTCUSDT": "WBTC"}
                token_in  = _exit_map.get(ticker, "W0G")
                token_out = "USDC"
                amount_wei = pos.get("amount_in_wei", 0)
                try:
                    quoted = await get_quote(token_in, token_out, amount_wei)
                    min_out = int(quoted * (10_000 - settings.dex_slippage_bps) // 10_000)
                    await approve_token(token_in, amount_wei)
                    await swap_exact_tokens(token_in, token_out, amount_wei, min_out)
                    open_positions.remove(pos)
                    portfolio["open_positions"] = open_positions
                    await set_json("portfolio:state", portfolio)
                except Exception as e:
                    print(f"Stop-loss exit failed for {ticker}: {e}")

        await asyncio.sleep(CHECK_INTERVAL)
```

### Step 6 — Agent 6 main class

```python
# ats/agents/agent6_execution.py
import asyncio
from ats.models.state import AgentState
from ats.agents.execution.order_router import execute_order
from ats.agents.execution.fill_monitor import wait_for_receipt
from ats.agents.execution.portfolio_updater import update_portfolio_after_fill, update_receipt_with_fill
from ats.agents.execution.stop_loss_monitor import stop_loss_monitor_loop
from ats.data.postgres_client import get_session

# Maps ATS tickers to 0G Chain DEX token symbols
TICKER_TO_TOKEN = {
    "BTCUSDT":  "WBTC",
    "ETHUSDT":  "WETH",
    "WBTCUSDT": "WBTC",
}
QUOTE_TOKEN = "USDC"    # always buy/sell against USDC

class Agent6Execution:
    async def start(self):
        asyncio.create_task(stop_loss_monitor_loop())

    async def execute(self, state: AgentState) -> AgentState:
        risk = state.risk_decision
        if not risk or not risk.approved:
            return state

        direction   = state.signal_vote.direction   # "LONG" or "SHORT"
        token_asset = TICKER_TO_TOKEN.get(state.trigger_ticker, "W0G")
        size_usd    = risk.size_usd

        if direction == "LONG":
            # Buy asset with USDC
            token_in, token_out = QUOTE_TOKEN, token_asset
            # Convert USD size to USDC wei (6 decimals)
            amount_in_wei = int(size_usd * 1e6)
        else:
            # Sell asset for USDC — need amount in asset wei from open position
            token_in, token_out = token_asset, QUOTE_TOKEN
            amount_in_wei = int(risk.shares * 1e8)  # WBTC has 8 decimals

        result = await execute_order(token_in, token_out, amount_in_wei, size_usd)

        # Wait for all tx receipts
        receipts = []
        for swap in result["swaps"]:
            try:
                receipt = await wait_for_receipt(swap["tx_hash"])
                receipts.append(receipt)
            except TimeoutError as e:
                print(f"Swap confirmation timeout: {e}")

        avg_price = size_usd / risk.shares if risk.shares else 0
        fill_data = {
            "strategy":   result["strategy"],
            "avg_price":  avg_price,
            "size_usd":   size_usd,
            "tx_hashes":  [s["tx_hash"] for s in result["swaps"]],
            "receipts":   receipts,
        }

        await update_portfolio_after_fill(
            ticker=state.trigger_ticker,
            direction=direction,
            amount_in_wei=amount_in_wei,
            avg_price=avg_price,
            size_usd=size_usd,
            stop_loss_price=risk.stop_loss_price or 0,
        )

        if state.receipt_id:
            async with get_session() as session:
                await update_receipt_with_fill(state.receipt_id, fill_data, session)

        return state
```

---

## Config additions required

Add to `ats/config.py`:

```python
# Agent smart account — dedicated on-chain execution wallet
agent_wallet_private_key: str = ""

# 0G Chain — Newton Testnet (chainId 16600)
rpc_url: str = "https://evmrpc-testnet.0g.ai"

# DEX routers — 0G native DEX (replace with live addresses once deployed)
dex_router_address: str = "0x0000000000000000000000000000000000000010"
dex_router_v1_address: str = "0x0000000000000000000000000000000000000011"

# Slippage in basis points (50 = 0.5%)
dex_slippage_bps: int = 50
```

## Requirements additions

```
web3>=6.0.0
eth-account>=0.11.0
```

---

## Validation checklist

- [ ] `get_quote("USDC", "WBTC", 1_000_000)` returns a non-zero int (USDC has 6 decimals)
- [ ] `approve_token("USDC", 1_000_000)` succeeds on 0G testnet and returns a valid tx hash
- [ ] Single swap under $10K submits one tx and waits for receipt
- [ ] TWAP over $10K submits 5 txs spaced 2 minutes apart
- [ ] `portfolio:state` in Redis shows updated `cash_usd` and `open_positions` after fill
- [ ] `execution:fills` list in Redis grows by 1 after each fill
- [ ] Decision Receipt in Postgres has `fill_data` populated with tx hashes after fill
- [ ] Stop-loss monitor swaps asset back to USDC when price crosses stop level
- [ ] `AGENT_WALLET_PRIVATE_KEY` is never logged or returned in any API response

## What Phase 8 needs from this phase

- Fill events broadcast source: after `update_portfolio_after_fill` succeeds, Phase 8 reads `execution:fills` and pushes over WebSocket
- `receipt_id` in Postgres with `fill_data` for Conversation Layer to read
- `Agent6Execution.start()` called at API startup to launch stop-loss monitor
