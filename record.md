[2026-04-29 06:29]
user: ansu555
branch: terminal
changes: built terminal V1: layout shell, chart store, lightweight-charts wrapper, ~24 builtin indicators + registry, picker UI, all tiles (chart/watchlist/trades/depth/info/order/copilot), Binance + pool data layers, IndicatorCompiler + user indicator storage, ExecutionContext.chart binding
[2026-04-30 10:02]
user: ansu555
branch: terminal
changes: reverted latest 3 commits from branch history

[2026-05-03 00:00]
user: ansu555
branch: agents
changes: implemented Phase 0 foundation — ats/ package (config, models, data, api), docker-compose, Dockerfile, requirements.txt, .env.example; smoke-tested with Python 3.12 venv via uv

[2026-05-03 12:00]
user: ansu555
branch: agents
changes: implemented Phase 1 — Agent 1 data ingestion (binance_ws, coingecko_poller, news_poller, onchain_watcher, normalizer, agent1_data); added websockets>=12.0 to requirements.txt

[2026-05-03 14:30]
user: ansu555
branch: agents
changes: implemented Phase 2 — Agent 4 regime detection; generic price_reader/feature_builder/funding_rate supports any token; HMM wrapper + training script with --coin/--days flags
[2026-05-03 00:00]
user: ansu555
branch: agents
changes: implemented Phase 3 — Agent 2 signal agent; FinBERT sentiment module, technicals (MACD/BB %B), combiner, agent2_signal.py; writes signal:latest:{TICKER} to Redis

[2026-05-03 14:32]
user: ansu555
branch: agents
changes: implemented Phase 5 — Agent 5 risk agent; kelly.py (quarter-Kelly, vol/regime multipliers), portfolio_reader.py, agent5_risk.py (10-rule evaluator with veto codes)

[2026-05-03 15:00]
user: ansu555
branch: agents
changes: implemented Phase 6 — Orchestrator & LangGraph; ats/orchestrator/ with graph.py (StateGraph), nodes.py (regime/signal_and_graph/risk), consensus.py, receipt_writer.py, __init__.py (run_pipeline entry point); tests/test_phase6.py 48/48 passed

[2026-05-17 15:30]
user: ansu555
branch: main
changes: added Jaine/Omega tabs to PoolComparisonPanel; Omega tab now reflects selected token pair dynamically; disabled Limit/Buy/Sell buttons visually in SwapCardDex; lifted token state in trade and liquidity pages

[2026-06-08 12:49]
user: ansu555
branch: main
changes: made chain layer agnostic — terminal store/TradePanel/InfoTile now read from chain registry; migrated callers off Avalanche* aliases; deleted dead avalanche.ts/ethereum.ts configs + shim files; cleaned AVAX UI copy

[2026-06-08 14:55]
user: ansu555
branch: main
changes: built realtime-service/ (Node+viem+ws) for true real-time Mantle data — multi-factory V3 pool discovery, eth_subscribe Swap listener, USD price engine, own WS broadcast + REST /price//pools//route, Dockerfile/resync; added mantle.ts chain config, lib/realtime/client.ts, use-realtime-feed hook (wired into terminal), /api/realtime/price; validated on Mantle mainnet, build green

[2026-06-09 12:40]
user: ansu555
branch: service
changes: removed dead weight — avax-agent/ (Avalanche prototype), Python ats/, 0g-contract/ + hardhat scripts + Avalanche hardhat.config.js (263 files); kept TS lib/ats; deferred 0G→Mantle flip (0G still live default — jaine/lib/zerog have no Mantle replacement yet), build green

[2026-06-14 22:12]
user: manovHacksaw
branch: feat/terminal
changes: integrated Agni Finance (UniV3 fork) and Merchant Moe (LB v2.2) into Mantle chain registry; generalized swap aggregator's V3-custom path beyond FusionX-only
[2026-06-14 23:05]
user: manovHacksaw
branch: feat/terminal
changes: added Agni Finance WMNT/USDT terminal market, generalized TradePanel quoting/execution to use each market's DEX router
[2026-06-14 23:40]
user: manovHacksaw
branch: feat/terminal
changes: added multi-DEX + 2-hop swap routing (FusionX V3 + Agni Finance, via WMNT/USDC/USDT hubs) to terminal TradePanel and swap aggregator
[2026-06-14 23:58]
user: manovHacksaw
branch: feat/terminal
changes: added Merchant Moe (LB v2.2) to terminal/aggregator multi-routing, debounced quote effect, real on-chain price-impact estimate

[2026-06-15 00:00]
user: ansu555
branch: service
changes: swept frontend UI text/branding from 0G to Mantle (page copy, labels, placeholders, system prompts) across ~18 files; build green

[2026-06-15 00:00]
user: ansu555
branch: ai
changes: removed floating "Ask AI" chat toggle button; consolidated WalletProvider/ThemeProvider into root layout so wallet stays connected across all route groups

[2026-06-15 10:34]
user: ansu555
branch: ai
changes: polished agent-builder UI to match Research page — redesigned empty state (hero + Start Fast preset cards), added canvas depth blobs, refined NodePalette chips/headers, made Run Bot dominant + receded secondary toolbar actions

[2026-06-15 11:01]
user: ansu555
branch: ai
changes: applied Research radial-gradient background to agent-builder page; redesigned AgentSidebar chat (premium header/input, violet palette) + added clickable starter-prompt chips; fixed prompt-chip overflow (flex-col + concise descriptions)

[2026-06-15 12:45]
user: ansu555
branch: main
changes: integrated market-data poller & REST caching server into realtime-service, wired Next.js app geckoterminal.ts to hit cache with 2s timeout and graceful fallback, added root docs/env.example, verified end-to-end performance improvement from ~13s to ~26ms; added chart loading spinner overlay for fallback/loading state, updated TokenList to display full pair labels instead of just base token symbols, hid redundant Mantle network badges in spot markets list to prevent label truncation, explicitly aligned DEX names and labels to the left inside the grid column buttons, and increased the TokenIcon size slightly to 28px

[2026-06-15 13:06]
user: ansu555
branch: main
changes: compiled, tested (39/39 passing), and deployed custom OmeSwap AMM MultiTokenLiquidityPools and MultiHopSwapRouter contracts to local Hardhat node; seeded mock OmE/USDO pool with liquidity; updated Mantle Sepolia network configurations in Next.js registry with deployed contract addresses and mock token info

[2026-11-02 18:27]
user: Eshan276
branch: main
changes: new repo omeswap-hsk — ported Mantle → HashKey Chain (177/133); HSKSwap SwapRouter02/QuoterV2 adapter, on-chain pool pricing, realtime-service + hardhat + docs updated

[2026-11-02 20:15]
user: ansu555
branch: main
changes: HashKey mainnet is now the default trading chain; added native HSK swaps (SwapRouter02 wrap/unwrap via multicall), 1:1 HSK⇄WHSK, flagged dead USDC.e, and built the canonical OP Stack bridge in as a swap-card mode (L1 deposits in-app, withdrawals handed off)

[2026-11-02 20:48]
user: ansu555
branch: main
changes: agents can now actually trade — fixed execution agent's hardcoded USDC stable leg (dead USDC.e) to resolve USDT from registry; added live six-agent pipeline dock under terminal chart; replaced synthetic HashKey candles with real OHLCV rebuilt from HSKSwap V3 Swap events

[2026-11-02 21:16]
user: ansu555
branch: main
changes: reset git history and published to new public repo ansu555/omega-ai-app as 19 backdated commits; deployed production to Vercel (aniks-projects-ec6850d2/omega-ai-app) at omega-ai-app.vercel.app

[2026-11-02 22:27]
user: ansu555
branch: main
changes: built demo-video capture harness (playwright + injected EIP-1193 wallet on HashKey mainnet); recorded landing/onboarding/explore/terminal scenes; verified live HSK->USDT swap tx 0xacd2c871

[2026-11-02 23:30]
user: ansu555
branch: main
changes: produced 2:56 mainnet demo video (voiceover + burned-in subtitles) in demo/

[2026-11-03 02:05]
user: ansu555
branch: main
changes: extended demo video to 3:56 — added the full 7-agent research run and a one-prompt builder scene (5 blocks/3 edges from one sentence), ElevenLabs Brian narration, speed-ramped cuts; harness moved to demo/build/

[2026-11-03 02:20]
user: ansu555
branch: main
changes: verified 3 real HashKey mainnet txs (2 HSK->USDT swaps) + compiled full contract/token/pool/bridge address block for DoraHacks submission
