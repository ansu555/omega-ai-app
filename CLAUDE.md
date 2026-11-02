# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
bun run dev          # or: npm run dev
bun run build
bun run lint

# Smart contract operations (self-contained hardhat project in contract/)
cd contract && npm install
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deployTokens.js  --network hashkeyTestnet  # deploy test tokens
npx hardhat run scripts/deploy.js        --network hashkeyTestnet  # deploy pools + router
npx hardhat run scripts/addLiquidity.js  --network hashkeyTestnet  # seed liquidity
```

## Environment

Copy `.env.example` → `.env.local`. Minimum to run against mainnet:

```bash
NEXT_PUBLIC_HASHKEY_NETWORK=mainnet    # default; `testnet` opts out. REAL FUNDS.
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=  # from cloud.reown.com; blank = injected/MetaMask only
NEXT_PUBLIC_ETHEREUM_RPC=              # L1 RPC, bridge only — use a private endpoint
SUPABASE_URL=                          # server-side only
SUPABASE_SERVICE_ROLE_KEY=             # server-side only — never NEXT_PUBLIC_
OPENROUTER_API_KEY=                    # also read as OPEN_ROUTER_API_KEY
```

## Architecture

**Omeswap** is a DEX and autonomous agent platform on **HashKey Chain** (EVM-compatible L2, chainId 177 mainnet / 133 testnet), built for the HashKey "AI Agent Trading" track using Next.js 15 App Router. The repo has no tests; validate with `bun run build` and visual inspection.

The **trading chain is HashKey Chain**; swaps route through **HSKSwap** (https://app.hskswap.com, a Uniswap V3 fork — factory + SwapRouter02 + QuoterV2). Separately, the app consumes 0G's decentralized AI/data services as **external infrastructure** (independent of the trading chain — see `lib/zerog/config.ts`):
- **HashKey Chain** — EVM execution layer for all trading (chainId 177 / 133), config in `lib/chain-registry/chains/hashkey.ts`
- **0G Storage** — decentralized KV + Log blobs for persistent agent memory (`lib/zerog/storage.ts`)
- **0G Compute** — decentralized AI inference for agent reasoning (`lib/zerog/compute.ts`), models: `qwen3-8b`, `qwen3.6-plus` (sealed ZK), `GLM-5-FP8`
- **0G DA** — data availability layer for high-throughput agent output (`lib/zerog/da.ts`)

### Route Groups

| Group | Path | Purpose |
|-------|------|---------|
| `(app)` | `/trade`, `/terminal`, `/portfolio`, `/explore`, `/transactions`, `/marketplace`, `/creator`, `/library`, `/admin` | Main authenticated DEX |
| `(builder)` | `/agent-builder` | Visual bot workflow editor |
| `(landing)` | `/` | Marketing landing page |
| `(userform)` | `/onboarding` | Wallet-based onboarding |

The `(app)` layout wraps everything in the wallet provider (`components/providers/wallet-provider.tsx`, connects to HashKey Chain via the chain registry) → `OnboardingGuard` → `ChatProvider`. `OnboardingGuard` redirects new wallets to onboarding; `DisconnectOverlay` handles wallet-switch detection.

### API Routes (`app/api/`)

| Route | Purpose |
|-------|---------|
| `/api/onboarding` | Wallet onboarding, creator registration |
| `/api/activations/[id]` | Bot activation lifecycle — pause, evaluate, execute, receipts |
| `/api/creator/strategies/[id]` | Strategy CRUD + validate / backtest / publish pipeline |
| `/api/creator/indicators/[id]` | User indicator CRUD |
| `/api/creator/dashboard` | Creator stats |
| `/api/marketplace` | Public strategy/indicator listings |
| `/api/token/[id]/analysis` | Token analysis (CoinGecko + Supabase) |
| `/api/crypto` | Generic price/market data proxy |
| `/api/receipts/[id]` | Trade receipt lookup |
| `/api/admin` | Admin-only wallet management |

Auth is header-based: `requireWallet()` (`lib/marketplace/wallet-header.ts`) extracts the wallet address; `isAdminWallet()` gates admin routes.

### Chain Registry (`lib/chain-registry/`)

Single source of truth for all chain config (RPC URLs, contract addresses, tokens, DEX routers). All other files import from here — never hardcode addresses elsewhere.

To add a new chain: create `lib/chain-registry/chains/<chain>.ts` exporting a `ChainConfig`, import it in `lib/chain-registry/index.ts`, and add to `REGISTRY`. The wallet provider, swap hooks, and agent nodes pick it up automatically.

Currently registered: **HashKey Chain** — mainnet 177 and testnet 133 are both registered with the wallet. **The default trading chain is mainnet (real funds)**; set `NEXT_PUBLIC_HASHKEY_NETWORK=testnet` to opt out. Config file: `lib/chain-registry/chains/hashkey.ts`.

Ethereum mainnet (1) is added to the *wallet* in `wallet-provider.tsx` but deliberately **not** to the registry — it exists only so canonical-bridge deposits (which are L1 transactions) can be signed, and must never be offered as a DEX routing venue.

#### Native HSK

HSK is the gas coin, not an ERC-20. The registry lists it under key `HSK` with the `NATIVE_TOKEN_ADDRESS` sentinel and `isNative: true`. Never call `balanceOf`/`approve` on that address — resolve it to `nativeWrapped` (WHSK) first, which `resolveTradableAddress()` and `useDexAggregator` do. SwapRouter02 wraps and unwraps natively, so swaps go HSK→token and token→HSK directly (see `buildHSKSwapTx` in `lib/dex/hskswap.ts`). HSK⇄WHSK is detected as a 1:1 wrap and settles on the WHSK contract, not through a pool.

#### Verified mainnet liquidity (2026-11-02)

Every pool the HSKSwap position manager has ever minted into was enumerated. Only **three** have usable liquidity, all at the **0.3%** tier, all hubbed on **USDT**:

| Pool | Reserves | Address |
|------|----------|---------|
| WHSK/USDT | ~4.99M WHSK / ~437k USDT | `0x4ff515761864e7838B0AdB8b5b2B8B7A068905dC` |
| WETH/USDT | ~21.2 WETH / ~48.3k USDT | `0xb92b79ed6b370D5cFee2E14B1D0983C258304C16` |
| WBTC/USDT | ~0.655 WBTC / ~50.7k USDT | `0xd9EA2cE468957Ba49cCC38C4758Ed6ecD561449A` |

So WETH↔WBTC only routes two-hop via USDT. **USDC.e is dead** (~1.8k supply, ~$0.08 pooled, not Circle-issued) and is flagged `lowLiquidity: true` so the UI warns instead of quoting. There is no HashKey-issued stablecoin — USDT is the only real stable.

### 0G SDK Layer (`lib/zerog/`)

External AI/data infrastructure — **intentionally remains on 0G** regardless of the HashKey trading chain (see `lib/zerog/config.ts`). Three wrappers for the 0G protocol primitives:
- **`storage.ts`** — `saveAgentMemory()`, `loadAgentMemory()`, `appendLog()` — persistent agent memory on 0G Storage
- **`compute.ts`** — `computeInference()`, `agentReason()`, `streamComputeInference()` — AI inference via 0G Compute
- **`da.ts`** — `submitToDA()`, `postSwarmMessage()`, `postInferenceResult()` — data availability via 0G DA
- Import everything from `@/lib/zerog` (barrel re-export)

### Contract Layer (`contracts/`)

`contracts/config.ts` is a backward-compatible shim that re-exports from the chain registry. The OmeSwap custom AMM (`MultiTokenLiquidityPools` + `MultiHopSwapRouter`, source in `contract/`) is not deployed on HashKey yet — after `--network hashkeyTestnet`, set `omeswapPools` and `omeswapRouter` in `hashkeyTestnetConfig` in `lib/chain-registry/chains/hashkey.ts`. The live app does not require them: swaps route through HSKSwap.

HSKSwap is the only DEX router (`hskswap`, type `custom`). Its adapter is `lib/dex/hskswap.ts`. **SwapRouter02's `exactInputSingle` / `exactInput` structs have no `deadline` field** — using the original V3 SwapRouter ABI will revert. Enabled fee tiers: 100 / 500 / 3000 / 10000 (only 3000 has pools).

### Canonical Bridge (`lib/bridge/hashkey-bridge.ts`)

HashKey Chain is an **OP Stack rollup with a custom gas token**: HSK is native on L2 and an ERC-20 (`0xE7C6…C98a`) on L1. Two consequences, both verified on-chain, drive the bridge UI:

- **ETH cannot be bridged.** `L1StandardBridge.depositETH` reverts with `"StandardBridge: cannot bridge ETH with custom gas token"`. Users bridge **WETH**, the ERC-20.
- **Withdrawals are not one transaction.** L2→L1 is withdraw → fault-proof challenge window → prove → finalize. Deposits run in-app; withdrawals start in-app and finish on the canonical bridge, which tracks the claim.

L1↔L2 token pairings in `BRIDGEABLE_ASSETS` are read from each L2 token's own `remoteToken()` — the authoritative source, since the bridge mints against exactly that mapping. Never add a pairing on trust: a wrong one strands funds permanently. **USDC.e is excluded** — it has no `remoteToken()`, so it is not canonically bridged.

The UI is a **`bridge` mode inside `SwapCardDex`** (`components/trade/BridgePanel.tsx`), not a separate route — bridging is part of entering a position. Bridge mode intentionally bypasses the wrong-network guard, because a deposit is correctly signed on Ethereum.

HashKey markets (`lib/dex/markets.ts`, network `hashkey` / `hashkey-testnet`) are priced on-chain from pool `slot0` (`lib/dex/onchain-pool.ts`); GeckoTerminal does not index HSKSwap. Mainnet liquidity sits in WHSK/USDT, USDT/WETH and USDT/WBTC (0.3%); USDC.e is near-empty, so USDT is the default quote/hub.

### State Management (`store/`)

Zustand stores — no Redux:
- `agent-builder.ts` — canvas nodes/edges, workflow save/load (localStorage key `avax-agent-workflows`), bot run logs, backtest results; persistent memory backed by 0G Storage
- `terminal.ts` — active symbol, watchlist, tile layout (react-grid-layout), bot run state
- `chart.ts` — chart-level state
- `transaction-store.ts` — transaction history

### Marketplace & Creator System (`lib/marketplace/`)

Strategy/indicator marketplace backed by Supabase:

- **`creator.ts`** — `ensureCreator()` upserts a row in the `creators` table (required FK before any strategy/indicator write).
- **`validate-strategy.ts`** — payload validation for strategy creation.
- **`risk-check.ts`** — `computeRiskScore()` / `getRiskCategory()` used in onboarding and strategy publish.
- **`wallet-header.ts`** — `requireWallet()` extracts wallet address from request headers; all creator/marketplace API routes call this first.
- Publish pipeline: validate → backtest → publish (each a separate API sub-route under `creator/strategies/[id]`).

### Agent Builder (`lib/agent-builder/`)

Visual DAG-based trading bot editor. Key concepts:

- **`BaseNode`** (`nodes/BaseNode.ts`) — abstract class all nodes extend. Implement `execute(inputs, context): Promise<Record<string, unknown>>`.
- **Node categories**: `data` (PriceFeed, WalletBalance, DEXPrice), `logic` (Condition, Math, MovingAverage, Threshold, Delay, Variable, Accumulator, PreviousValue), `action` (Swap, LimitOrder, Notification, AddChartMarker), `flow` (Start, End, Merge, ScheduleTrigger).
- **`BotRunner`** (`engine/BotRunner.ts`) — executes the DAG via topological sort. Receives callbacks for logging, status updates, and chart markers.
- **`BacktestRunner`** (`engine/BacktestRunner.ts`) — replays OHLCV candles through the bot, mocking blockchain action nodes.
- **`IndicatorCompiler`** (`engine/IndicatorCompiler.ts`) — compiles custom indicator code.
- **Indicator registry** (`lib/indicators/`) — pub/sub registry for built-in and user-defined indicators. Indicators expose `builtins/` math primitives.
- **`ExecutionContext`** (`types/agent-builder-canvas.ts`) — runtime context injected into nodes: wallet address, provider/signer, logger, toast, chart access.
- **`AgentStorageManager`** (`lib/agent-builder/storage.ts`) — localStorage persistence for the simplified agent system (keys: `omeswap_agents`, `omeswap_active_agent`). Distinct from the visual DAG canvas, which uses the Zustand store (`store/agent-builder.ts`, key `avax-agent-workflows`).

### Trading Terminal (`/(app)/terminal`)

Resizable tile grid (react-grid-layout). Tiles: `chart`, `watchlist`, `trades`, `depth`, `info`, `order`, `copilot`. Charts use `lightweight-charts` v5. The copilot tile integrates OpenAI.

Components live in `components/terminal/`. Tile layout is persisted in the terminal Zustand store.

### Web3 Stack

- **wagmi v2 + viem v2** for contract reads/writes
- **RainbowKit** for wallet modal (WalletConnect, MetaMask, etc.)
- **ethers v6** used in some hooks alongside viem
- Custom hooks in `hooks/` — `use-dex-swap.tsx`, `use-dex-aggregator.tsx`, `use-liquidity.tsx`, `use-token-balances.tsx`, `use-wallet-analysis.tsx`, etc.

### UI

shadcn/ui components (Radix primitives + Tailwind). Component aliases configured in `tsconfig.paths.json` — import as `@/components/ui/...`. Dark theme by default via `next-themes`.

### Supabase

`supabase/` contains migrations. Client initialized in `lib/supabase/`. Used for persistent user data and wallet analysis.

### `avax-agent/` Sub-project

A standalone Next.js app in `avax-agent/` — separate `package.json`, `next.config.ts`, and `tsconfig.json`. Contains its own `app/`, `components/`, `lib/`, `store/`, and `types/`. Run independently of the main app; do not import from or into the root project.

### Graphify

A knowledge graph of this codebase lives in `graphify-out/`. Before answering architecture questions, check `graphify-out/GRAPH_REPORT.md`. After modifying code files, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Key Conventions

- Path alias `@/` maps to the project root — use it everywhere instead of relative imports.
- All contract addresses must come from the chain registry (`lib/chain-registry/chains/hashkey.ts`), not be hardcoded in components or hooks.
- 0G protocol access (Storage, Compute, DA) must go through `lib/zerog/` — never call 0G endpoints directly in components.
- Node.js v25+ `localStorage` shim is injected via webpack BannerPlugin in `next.config.ts` — do not add another localStorage polyfill.
- `export const dynamic = "force-dynamic"` is set on the `(app)` layout to prevent static rendering of wallet-dependent pages.
- 0G Compute `sealed: true` must be used for any AI call that influences an on-chain transaction.
