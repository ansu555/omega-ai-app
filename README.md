# OmeSwap on HashKey Chain

An AI-agent trading app for HSKSwap on HashKey Chain — autonomous market monitoring, signal detection and order execution with risk controls, plus a natural-language interface for positions, P&L and strategy settings.

![HashKey Chain](https://img.shields.io/badge/Chain-HashKey-4f46e5) ![Next.js](https://img.shields.io/badge/Next.js-15-black) ![React](https://img.shields.io/badge/React-19-blue)

## Features

- Best-route swaps on HSKSwap (direct + two-hop via USDT/WHSK) + liquidity primitives
- HashKey-native chain registry and wallet switching
- HashKey Chain Mainnet (177) + Testnet (133) support
- Agent wallet + ATS research/execution flows
- Integration points for 0G Storage, Compute, and DA (external AI/data infra)
- Next.js + wagmi/viem frontend with modern UI

## Quick Start

1. Install dependencies

```bash
npm install
cd realtime-service && npm install && cd ..
```

2. Create local env file

```bash
cp .env.example .env.local
```

3. Set required values in `.env.local`

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

Optional network overrides (defaults come from chain registry):

```bash
NEXT_PUBLIC_HASHKEY_NETWORK=mainnet            # default: testnet
NEXT_PUBLIC_HASHKEY_RPC=https://mainnet.hsk.xyz
NEXT_PUBLIC_HASHKEY_WSS=wss://mainnet.hsk.xyz/ws
NEXT_PUBLIC_HASHKEY_RPC_TESTNET=https://testnet.hsk.xyz
```

Realtime Service overrides (points the frontend to the realtime service cache server):

```bash
REALTIME_HTTP_URL=http://localhost:8080
NEXT_PUBLIC_REALTIME_HTTP_URL=http://localhost:8080
NEXT_PUBLIC_REALTIME_WS_URL=ws://localhost:8080
```

4. Start the services

Start the realtime service (watches on-chain events, polls prices, and caches market data):

```bash
cd realtime-service
npm run dev
```

Start the Next.js app (in a separate terminal):

```bash
npm run dev
```

Open `http://localhost:3000`.

## Prerequisites

- Node.js 18+
- MetaMask or compatible EVM wallet
- HSK balance for gas on your selected HashKey Chain network

## Tech Stack

- Frontend: Next.js 15, React 19, Tailwind, shadcn/ui
- Web3: wagmi v2, viem v2, RainbowKit
- Contracts: Solidity + Hardhat (under `contract/`)
- Agents: ATS orchestration with optional AXL peer transport

## HashKey Chain Network Configuration

### HashKey Chain Testnet (default)

- Chain ID: `133`
- RPC: `https://testnet.hsk.xyz`
- Explorer: `https://testnet-explorer.hsk.xyz`

### HashKey Chain Mainnet

- Chain ID: `177`
- RPC: `https://mainnet.hsk.xyz`
- WSS: `wss://mainnet.hsk.xyz/ws`
- Explorer: `https://hashkey.blockscout.com`

Switch the default trading chain with:

```bash
NEXT_PUBLIC_HASHKEY_NETWORK=mainnet  # anything else → testnet
```

The terminal's HSKSwap markets (WHSK/USDT, WETH/USDT, WBTC/USDT on mainnet; WHSK/USDT on testnet) trade on their own chain regardless of this setting.

## Core Addresses (HashKey Chain Mainnet)

From `lib/chain-registry/chains/hashkey.ts` (HSKSwap developer docs, verified on-chain):

| Contract | Mainnet (177) | Testnet (133) |
|---|---|---|
| HSKSwap UniswapV3Factory | `0x972cA9D1662F5e029cD18327D29026532E84c742` | `0x2dC2c21D1049F786C535bF9d45F999dB5474f3A0` |
| HSKSwap SwapRouter02 | `0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3` | `0xa6914E66690c6794244B5f66a09eAEbf66254237` |
| HSKSwap QuoterV2 | `0x603f70466fDdbE3F238220B9a74FFF419a2BbFDD` | `0x73820d9eE5Bf1BfcD429580320FC7A374E8fa1cC` |
| WHSK | `0xB210D2120d57b758EE163cFfb43e73728c471Cf1` | `0xCA8aAceEC5Db1e91B9Ed3a344bA026c4a2B3ebF6` |
| USDT | `0xF1B50eD67A9e2CC94Ad3c477779E2d4cBfFf9029` (6 dec) | `0x98B6173A8B7DFc52ce8bc88f1184a918A1CCaa4F` (18 dec) |

> OmeSwap's own AMM (`omeswapPools` / `omeswapRouter`, source in `contract/`) is not yet deployed on HashKey Chain. The app swaps through HSKSwap and does not need it.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint

# Smart contracts (self-contained hardhat project — run inside contract/)
cd contract && npm install
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deployTokens.js --network hashkeyTestnet
npx hardhat run scripts/deploy.js       --network hashkeyTestnet
npx hardhat run scripts/addLiquidity.js --network hashkeyTestnet

npm run axl:agent
npm run axl:demo
```

## AXL Peer-to-Peer ATS Swarm

Run ATS agents on separate peers with transport selection (`local` | `axl` | `auto`).

```bash
ATS_AGENT_TRANSPORT=axl bun run axl:demo BTC solo
```

See: `doc/axl.md`

## Documentation

- `doc/README.md`
- `doc/idea.md`
- `doc/recode.md`
- `doc/phases/index.md`

## Project Structure

```text
omeswap-templet/
├── app/
├── components/
├── contracts/
├── contract/
├── hooks/
├── lib/
├── scripts/
└── doc/
```

## Deployment

### Deploying Realtime Service on Render

The `realtime-service` runs as a persistent Node process and is fully Dockerized. It consolidates both REST HTTP and WebSocket APIs onto a single port (`8080`), making it ideal for Render:

1. **Blueprint Deployment (Recommended)**:
   We provide a `render.yaml` Blueprint file in the repository root. Log in to Render, click **Blueprints**, connect your repository, and it will deploy the service with all default configurations automatically.

2. **Manual Web Service Deployment**:
   - Create a new **Web Service** on Render.
   - Connect your repository.
   - Set the **Root Directory** to `realtime-service`.
   - Select **Docker** as the Runtime (Render will automatically detect the `Dockerfile` inside `realtime-service`).
   - Choose a plan (e.g. Free or Starter).
   - Add the following environment variables:
     - `PORT`: `8080`
     - `HASHKEY_NETWORK`: `mainnet` (or `testnet` — also set `HASHKEY_WSS`, no public testnet WebSocket is known)
     - `HASHKEY_RPC`: `https://mainnet.hsk.xyz`
     - `HASHKEY_WSS`: `wss://mainnet.hsk.xyz/ws`
   - Click **Deploy Web Service**.

Once deployed, copy your Render web service URL (e.g., `https://omeswap-realtime.onrender.com`) and configure the Next.js app to use it:
- `REALTIME_HTTP_URL=https://omeswap-realtime.onrender.com`
- `NEXT_PUBLIC_REALTIME_HTTP_URL=https://omeswap-realtime.onrender.com`
- `NEXT_PUBLIC_REALTIME_WS_URL=wss://omeswap-realtime.onrender.com` (note the `wss://` protocol for secure WebSockets).

## Security Note

This project includes on-chain execution paths. Before production usage, perform:

- Contract and integration audits
- Key management hardening
- Runtime risk limits and monitoring

## Support

- Issues: GitHub Issues
- HashKey Chain Explorer: https://hashkey.blockscout.com
- HSKSwap: https://app.hskswap.com

Built for the HashKey Chain "AI Agent Trading" track
