# Demo Video Script — OmeSwap AI Agent Trading on HSKSwap

**Length:** ~3:00 · **Format:** screen recording + voiceover · **Track:** AI Agent Trading (HSKSwap / HashKey Chain)

Scenes marked **[BUILD FIRST]** depend on features not yet built on HSKSwap.
Record them only once they work. If they aren't ready, use the fallback shown
under each one.

---

## Pre-recording checklist

- [ ] `realtime-service` running (`cd realtime-service && npm run dev`) so WHSK/USDT shows live prices, trades and depth
- [ ] App running on mainnet for the market views: `NEXT_PUBLIC_HASHKEY_NETWORK=mainnet bun run dev`
- [ ] Wallet connected on HashKey Chain, holding a small amount of USDT + HSK for gas (or use testnet 133 for the execution scene)
- [ ] Agent wallet funded (Portfolio → Agent Wallet) so the execution scene produces a real tx hash
- [ ] Browser zoom 110–125%, notifications off, bookmarks bar hidden
- [ ] A HashKey Chain explorer tab open (`hashkey.blockscout.com`) to show the tx

---

## Scene 1 — Hook (0:00–0:15)

**Screen:** Landing page → cut to the terminal with the WHSK/USDT chart ticking.

**Voiceover:**
> "Trading on a DEX means watching charts all day, missing opportunities while
> you sleep, and making emotional calls at the worst moment. OmeSwap puts an AI
> agent in charge of the full loop on HSKSwap — monitoring, analysis, signals
> and execution — inside a strict risk framework, while you stay in control
> through plain conversation."

---

## Scene 2 — Live market monitoring on HashKey Chain (0:15–0:40)

**Screen:** `/terminal`. Hover the HashKey Chain market list (WHSK/USDT, WETH/USDT,
WBTC/USDT). Click WHSK/USDT. Point at price, liquidity, trades and depth tiles
updating.

**Voiceover:**
> "Everything here is read straight from HSKSwap's pools on HashKey Chain. Our
> realtime service subscribes to every swap on-chain, so prices, trades and
> depth update block by block — no third-party indexer in between. That live
> feed is what the agent watches."

**On-screen caption:** `Data source: HSKSwap pools on-chain · chain 177`

---

## Scene 3 — The agent analyses and finds a signal (0:40–1:20)

**Screen:** `/research`. Type a question, run it, and let the agent graph
animate (data → regime → signal → risk → execution agents).

**Type:**
> `Should I buy WHSK right now with 50 USDT?`

**Voiceover (while agents run):**
> "Under the hood a team of specialised agents works in parallel. One pulls
> price history and on-chain liquidity, one classifies the market regime, one
> generates the trading signal — and they vote."

**Screen:** Open the Decision Receipt drawer. Highlight confidence, the
BUY/SELL/HOLD call, and the evidence list with its on-chain sources (HSKSwap
route + price impact).

> "Every decision comes with a receipt: what the agent saw, why it decided,
> and the on-chain evidence — including the real HSKSwap route and price
> impact for this exact trade size."

---

## Scene 4 — Risk control and stop-loss (1:20–1:50)

**Screen:** Same receipt, scroll to the risk section: Kelly position size, stop
level, and veto checks.

**Voiceover:**
> "Before anything touches the chain, the risk agent has the final word. It
> sizes the position with fractional Kelly, sets the stop, and enforces hard
> veto rules: low data quality, low confidence, too much drawdown, negative
> edge or an under-funded wallet — any one of them blocks the trade outright.
> No exceptions, no overrides by the signal agents."

**Optional cut:** `/agent-builder` → show a strategy with a **Stop Loss** block
wired after the Swap node.

> "Users building their own strategies get the same guardrails as
> drag-and-drop blocks."

---

## Scene 5 — Autonomous execution on HSKSwap (1:50–2:15)

**Screen:** Approve the trade (or show autonomous mode) → `/terminal` trade
panel shows the route label (e.g. `HSKSwap · WETH -> USDT -> WHSK`), expected
output and price impact → submit → switch to the explorer tab with the tx.

**Voiceover:**
> "Execution goes straight through HSKSwap's router. The agent quotes every fee
> tier and two-hop route through USDT or WHSK, picks the best output, sets
> slippage protection from the live quote, and submits. Here's the transaction,
> confirmed on HashKey Chain."

**On-screen caption:** the tx hash + `HSKSwap SwapRouter02`

---

## Scene 6 — Arbitrage and price-gap capture **[BUILD FIRST]** (2:15–2:35)

**Screen:** A live opportunity feed showing a detected spread (e.g. the
direct WHSK→WETH pool vs the WHSK→USDT→WETH route, or the WHSK/USDC.e vs
WHSK/USDT implied price), the agent's net-of-fees profit estimate, and the
executed trade.

**Voiceover:**
> "The agent also scans for spreads across HSKSwap's pools and routes. When a
> gap exceeds fees and slippage, it executes automatically — and skips the ones
> that don't clear its profit threshold."

**Fallback if not built:** Cut this scene. Mention arbitrage as a roadmap item
in Scene 8 instead. Don't claim it works.

---

## Scene 7 — Natural-language control **[BUILD FIRST]** (2:35–2:50)

**Screen:** The chat panel. Type two commands and show the results.

**Type:**
> `What are my positions and P&L today?`

*(agent replies with positions, entry prices, unrealised P&L)*

> `Lower my risk — max 20 USDT per trade, only trade WHSK, check every 15 minutes.`

*(agent confirms the new settings and shows them applied)*

**Voiceover:**
> "And you stay in charge. Ask about positions and P&L, or change position
> size, frequency, risk appetite and target assets just by saying so. The AI
> runs the strategy; you set the rules."

**Fallback if not built:** Show the existing research chat answering a
question about the portfolio and the agent wallet balance on the Portfolio
page. Skip the settings-change command.

---

## Scene 8 — Close (2:50–3:00)

**Screen:** Architecture slide or quick montage: terminal → receipt → explorer tx.

**Voiceover:**
> "OmeSwap: an AI trading agent for HSKSwap that monitors, analyses, executes
> and controls risk on its own — with a human always able to steer. Built on
> HashKey Chain."

**End card:** project name · repo link · team names · `Built for the HashKey
Chain AI Agent Trading track`

---

## Track requirement → scene map (use in the submission write-up)

| Track requirement | Scene | Status |
|---|---|---|
| Market monitoring | 2 | Built — on-chain HSKSwap feed |
| On-chain data analysis | 3 | Built — multi-agent research + on-chain evidence |
| Trading signal identification | 3 | Built — signal agent + decision receipt |
| Order execution, no manual intervention | 5 | Built — HSKSwap SwapRouter02 best-route execution |
| Arbitrage / price-spread capture | 6 | **Not built yet** |
| Risk control + stop-loss framework | 4 | Built — Kelly sizing + hard vetoes; stop-loss blocks |
| Natural-language positions & P&L | 7 | **Partially** — research chat exists; P&L view needed |
| Adjust strategy via conversation | 7 | **Not built yet** |
