# HashKey Chain & 0G Integration Guideline

This guide explains what to create, edit, or delete when you want to:

1. **Work with the HashKey Chain config** (add DEXes, update tokens, change RPC)
2. **Integrate 0G Storage** (persistent agent memory — KV state + Log history)
3. **Integrate 0G Compute** (decentralized AI inference — qwen3, GLM-5-FP8)
4. **Integrate 0G DA** (data availability for high-throughput agent output)
5. **Add a new chain** alongside HashKey Chain (multi-chain support)
6. **Add or remove a DEX** on HashKey Chain

> **Trading chain vs. AI infra.** The DEX trades on **HashKey Chain** (config in
> `lib/chain-registry/chains/hashkey.ts`). 0G's Storage / Compute / DA are used as
> **external AI/data services**, independent of the trading chain — their config
> lives in `lib/zerog/config.ts`, not in the chain registry.

---

## Architecture in One Sentence

Everything chain-specific lives in `lib/chain-registry/`. All 0G SDK wrappers
live in `lib/zerog/`. All other files read from those two directories — you
almost never need to touch app code to change a chain, DEX, or 0G integration.

```
lib/chain-registry/
  types.ts              ← type definitions (rarely touch)
  index.ts              ← registry lookup + DEFAULT_CHAIN_ID (touch to swap default chain)
  chains/
    hashkey.ts           ← ALL HashKey Chain addresses, RPC, DEX routers, tokens (touch to edit HashKey Chain)
    polygon.ts          ← (create this for another chain, if needed)

lib/zerog/
  config.ts             ← 0G service endpoints (Storage/Compute/DA — independent of trading chain)
  storage.ts            ← 0G Storage SDK wrapper (KV blobs + Log blobs)
  compute.ts            ← 0G Compute inference wrapper (qwen3, GLM-5-FP8)
  da.ts                 ← 0G DA data availability wrapper
  index.ts              ← re-export barrel (import everything from '@/lib/zerog')
```

---

## Core Components

### 1. HashKey Chain (EVM-compatible L2 — the trading chain)
- **Chain ID**: 177 (Mainnet) / 133 (Sepolia Testnet)
- **RPC**: `https://mainnet.hsk.xyz` (mainnet) / `https://testnet.hsk.xyz` (testnet)
- **Explorer**: `https://hashkey.blockscout.com` / `https://testnet-explorer.hsk.xyz`
- **Native token**: HSK (18 decimals)
- **DEXes**: HSKSwap (Uniswap V3 fork; SwapRouter02 + QuoterV2)
- Config file: `lib/chain-registry/chains/hashkey.ts`
- Select network with `NEXT_PUBLIC_HASHKEY_NETWORK=mainnet|testnet`

### 2. 0G Storage (decentralized persistent memory)
- **Use for**: agent KV state (real-time), conversation/decision history (Log)
- **Indexer**: `https://indexer-storage-turbo.0g.ai` (mainnet)
- **SDK**: `@0glabs/0g-ts-sdk`
- Wrapper: `lib/zerog/storage.ts` — config in `lib/zerog/config.ts`

```typescript
import { saveAgentMemory, loadAgentMemory, appendLog } from '@/lib/zerog'

// Save agent state to 0G Storage
const { rootHash } = await saveAgentMemory('agent-001', { position: 'LONG', size: 100 })

// Retrieve later by rootHash
const { state } = await loadAgentMemory<MyState>(rootHash)

// Append to conversation log
await appendLog('agent-001', { role: 'user', content: 'Check BTCUSDT' })
```

### 3. 0G Compute (decentralized AI inference)
- **Use for**: agent reasoning, signal analysis, natural language decisions
- **Endpoint**: `https://compute-api.0g.ai/v1`
- **Models**: `qwen3-8b` (fast), `qwen3.6-plus` (sealed ZK), `GLM-5-FP8` (accurate)
- **Sealed inference**: ZK-verified output — use `sealed: true` for decision-critical calls
- Wrapper: `lib/zerog/compute.ts`

```typescript
import { computeInference, agentReason, streamComputeInference } from '@/lib/zerog'

// Quick single-turn reasoning
const answer = await agentReason('Is BTC in a bull regime?', 'You are a crypto analyst.')

// Full inference with sealed ZK proof
const { content, proofRef } = await computeInference({
  model: 'qwen3.6-plus',
  messages: [{ role: 'user', content: 'Analyze this signal...' }],
  sealed: true,
})

// Streaming inference for the copilot tile
for await (const chunk of streamComputeInference({ model: 'qwen3-8b', messages })) {
  process.stdout.write(chunk.delta)
}
```

### 4. 0G DA (data availability layer)
- **Use for**: large inference results, swarm coordination messages, high-volume attestations
- **RPC**: `https://da-client.0g.ai`
- Wrapper: `lib/zerog/da.ts`

```typescript
import { postSwarmMessage, postInferenceResult, verifyDAAvailability } from '@/lib/zerog'

// Post swarm coordination message
const { commitment } = await postSwarmMessage({ from: 'planner', to: 'executor', action: 'buy' })

// Store large inference output with availability proof
const { commitment: proof } = await postInferenceResult(largeOutput, {
  agentId: 'signal-agent',
  model: 'GLM-5-FP8',
})

// Verify the data is available on-chain
const isAvailable = await verifyDAAvailability(proof)
```

---

## Scenario 1: Edit the HashKey Chain Config

Everything HashKey Chain-specific is in **one file**: `lib/chain-registry/chains/hashkey.ts`.

### Change the RPC URL

```typescript
// lib/chain-registry/chains/hashkey.ts (or override via env)
export const HASHKEY_RPC = 'https://your-custom-mainnet.hsk.xyz'   // ← change this
// Env override: NEXT_PUBLIC_HASHKEY_RPC
```

### Update DEX router addresses

Update the `dexRouters` array (HSKSwap is configured by default):

```typescript
dexRouters: [
  {
    id: 'hskswap',
    name: 'HSKSwap',
    type: 'custom',
    routerAddress: '0x5989FB161568b9F133eDf5Cf6787f5597762797F' as Address,
  },
],
```

### Update OmeSwap contract addresses

After deploying the OmeSwap AMM to HashKey Chain (source in `contract/`):

```typescript
omeswapPools:  '0xYourDeployedPoolsAddress...' as Address,
omeswapRouter: '0xYourDeployedRouterAddress...' as Address,
```

### Add tokens

```typescript
tokens: {
  // ... existing tokens ...
  MYTOKEN: {
    address: '0xTokenAddress...' as Address,
    name: 'My Token',
    symbol: 'MYTOKEN',
    decimals: 18,
    coingeckoId: 'my-token',   // optional
  },
},
```

### What updates automatically after editing hashkey.ts

| What changes automatically | Why |
|---|---|
| Wallet provider supports HashKey Chain | `WalletProvider` calls `getSupportedChains()` |
| Swap hooks use HashKey Chain DEX routers | `useDexAggregator` calls `getChainConfig(chainId)` |
| Explorer links point to HashKey Chain explorer | `getExplorerLink(chainId, 'tx', hash)` reads from config |
| Agent builder nodes show HashKey Chain tokens | They call `getChainConfig(getDefaultChainId())` |

---

## Scenario 2: Switch to a Different Chain (Replace HashKey Chain)

### Step 1 — Create the chain config file

Create `lib/chain-registry/chains/<your-chain>.ts`. Use `hashkey.ts` as your template:

```typescript
import { defineChain } from 'viem'        // or: import { polygon } from 'viem/chains'
import type { Address } from 'viem'
import type { ChainConfig } from '../types'

export const MY_CHAIN_RPC = 'https://my-chain-rpc.example.com'

export const myChain = defineChain({ /* ... */ })

export const myChainConfig: ChainConfig = {
  chain: myChain,
  nativeWrapped: '0x...' as Address,
  hubTokens: ['0x...' as Address],
  explorerUrl: 'https://explorer.my-chain.com',
  explorerTxPath: '/tx/',
  explorerAddressPath: '/address/',
  dexRouters: [{ id: 'my_dex', name: 'My DEX', type: 'uniswapV2', routerAddress: '0x...' as Address }],
  tokens: { /* ... */ },
}
```

### Step 2 — Register the chain and set it as default

Open `lib/chain-registry/index.ts` and make two changes:

```typescript
// 1. Import your new config
import { myChainConfig } from './chains/my-chain'

// 2. Add it to the registry (remove hashkeyConfig if replacing entirely)
const REGISTRY: Record<number, ChainConfig> = {
  [myChainConfig.chain.id]: myChainConfig,
}

// 3. Change the default
export const DEFAULT_CHAIN_ID: number = myChainConfig.chain.id
```

---

## Scenario 3: Add a New Chain Alongside HashKey Chain (Multi-Chain)

Keep HashKey Chain and add another chain. In `lib/chain-registry/index.ts`:

```typescript
import { hashkeyConfig }  from './chains/hashkey'
import { polygonConfig } from './chains/polygon'   // ← new

const REGISTRY: Record<number, ChainConfig> = {
  [hashkeyConfig.chain.id]:  hashkeyConfig,
  [polygonConfig.chain.id]: polygonConfig,   // ← add here
}

// Keep HashKey Chain as the default
export const DEFAULT_CHAIN_ID: number = hashkeyConfig.chain.id
```

---

## Scenario 4: Add a New DEX to HashKey Chain

Open `lib/chain-registry/chains/hashkey.ts` and add an entry to `dexRouters`:

```typescript
dexRouters: [
  { id: 'hskswap',   name: 'HSKSwap',   type: 'custom',      routerAddress: '0x...' as Address },
  { id: 'my_v3_fork',   name: 'My V3 Fork',   type: 'custom',      routerAddress: '0x...' as Address },
  // ↓ NEW DEX
  {
    id: 'new_dex',
    name: 'New DEX',
    type: 'uniswapV2',
    routerAddress: '0xNewRouterAddress...' as Address,
  },
],
```

`useDexAggregator` picks up UniswapV2-style routers automatically. Custom (V3 /
Liquidity-Book) routers also need quote logic in `hooks/use-dex-aggregator.tsx`.

---

## Scenario 5: Remove a DEX

Delete the entry from `dexRouters` in `lib/chain-registry/chains/hashkey.ts`. It
immediately disappears from all swap UIs, agent nodes, and quote logic.

Also remove the fallback in `contracts/config.ts` if you want to keep it clean.

---

## Scenario 6: Add a 0G Storage Node to the Agent Builder

Create a new node class that uses the `lib/zerog/storage.ts` helpers:

```typescript
// lib/agent-builder/nodes/action/ZeroGStorageNode.ts
import { BaseNode } from '../../nodes/BaseNode'
import { saveAgentMemory, loadAgentMemory } from '@/lib/zerog'

export class ZeroGStorageNode extends BaseNode {
  async execute(inputs: Record<string, unknown>) {
    const { action, agentId, data, rootHash } = inputs

    if (action === 'save') {
      const result = await saveAgentMemory(agentId as string, data)
      return { rootHash: result.rootHash }
    }

    if (action === 'load') {
      const result = await loadAgentMemory(rootHash as string)
      return { state: result.state }
    }

    throw new Error(`Unknown action: ${action}`)
  }
}
```

---

## Scenario 7: Add a 0G Compute Node to the Agent Builder

```typescript
// lib/agent-builder/nodes/action/ZeroGComputeNode.ts
import { BaseNode } from '../../nodes/BaseNode'
import { computeInference } from '@/lib/zerog'

export class ZeroGComputeNode extends BaseNode {
  async execute(inputs: Record<string, unknown>) {
    const { prompt, model = 'qwen3-8b', sealed = false } = inputs

    const response = await computeInference({
      model: model as string,
      messages: [{ role: 'user', content: prompt as string }],
      sealed: sealed as boolean,
    })

    return {
      output: response.content,
      proofRef: response.proofRef,
      model: response.model,
    }
  }
}
```

---

## Quick Reference Table

| What you want to do | File(s) to edit |
|---|---|
| Change HashKey Chain RPC URL | `lib/chain-registry/chains/hashkey.ts` — edit `HASHKEY_RPC` (or `NEXT_PUBLIC_HASHKEY_RPC`) |
| Switch HashKey Chain mainnet/testnet | env `NEXT_PUBLIC_HASHKEY_NETWORK=mainnet\|testnet` |
| Update 0G Storage endpoint | `lib/zerog/config.ts` — edit `storageIndexerUrl` |
| Update 0G Compute endpoint | `lib/zerog/config.ts` — edit `ZEROG_COMPUTE_ENDPOINT` |
| Update 0G DA endpoint | `lib/zerog/config.ts` — edit `daRpcUrl` |
| Add a DEX (UniswapV2-compatible) | `lib/chain-registry/chains/hashkey.ts` — add entry to `dexRouters` |
| Add a DEX (custom interface) | `lib/chain-registry/chains/hashkey.ts` + add quote logic in `hooks/use-dex-aggregator.tsx` |
| Remove a DEX | `lib/chain-registry/chains/hashkey.ts` — remove entry from `dexRouters` |
| Add/edit a token | `lib/chain-registry/chains/hashkey.ts` — add/edit entry in `tokens` |
| Update OmeSwap contract address | `lib/chain-registry/chains/hashkey.ts` — edit `omeswapPools` / `omeswapRouter` |
| Switch to a different chain entirely | Create `lib/chain-registry/chains/<chain>.ts`, update `lib/chain-registry/index.ts` |
| Add a second chain | Create `lib/chain-registry/chains/<chain>.ts`, add to registry in `lib/chain-registry/index.ts` |
| Use 0G Storage in a component/hook | `import { saveAgentMemory, loadAgentMemory } from '@/lib/zerog'` |
| Use 0G Compute in a component/hook | `import { computeInference, agentReason } from '@/lib/zerog'` |
| Use 0G DA in a component/hook | `import { submitToDA, postSwarmMessage } from '@/lib/zerog'` |
| Add 0G env vars | `.env` — see `.env.example` for all 0G keys |

---

## Environment Variables

### HashKey Chain (trading chain)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_HASHKEY_NETWORK` | `mainnet` (177) or `testnet` (133) |
| `NEXT_PUBLIC_HASHKEY_RPC` | HashKey Chain EVM RPC (default: `https://mainnet.hsk.xyz`) |
| `NEXT_PUBLIC_HASHKEY_WSS` | HashKey Chain WebSocket RPC (default: `wss://wss.hashkey.xyz`) |

### 0G (external AI/data services)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_0G_NETWORK` | 0G service network for Storage/Compute/DA (`mainnet`/`testnet`) |
| `ZEROG_STORAGE_PRIVATE_KEY` | Wallet key for paying 0G storage fees |
| `NEXT_PUBLIC_0G_STORAGE_RPC` | 0G Storage indexer URL |
| `NEXT_PUBLIC_0G_COMPUTE_ENDPOINT` | 0G Compute API base URL |
| `ZEROG_COMPUTE_API_KEY` | 0G Compute API key |
| `ZEROG_COMPUTE_MODEL` | Default model (`qwen3-8b`, `qwen3.6-plus`, `GLM-5-FP8`) |
| `ZEROG_COMPUTE_SEALED` | `true` to use ZK-verified inference for critical decisions |
| `NEXT_PUBLIC_0G_DA_RPC` | 0G DA client URL |

Both the HashKey Chain config and the 0G service config have safe defaults — the
app works out of the box without configuring them for development.

---

## Files You Should NEVER Need to Edit for Chain/DEX Changes

These files read from the registry and should not need changes:

- `hooks/use-dex-aggregator.tsx`
- `hooks/use-dex-swap.tsx`
- `hooks/use-liquidity.tsx`
- `hooks/use-dex-pools.tsx`
- `hooks/use-pool-details.tsx`
- `hooks/use-token-balances.tsx`
- `components/trade/SwapCardDex.tsx`
- `components/trade/AddLiquidityCard.tsx`
- `components/providers/wallet-provider.tsx`
- `store/transaction-store.ts`
- `contracts/config.ts`
- Any agent builder node file

If you find yourself editing those files just to change a chain or DEX,
something is wrong — the data should come from the registry instead.

---

## Checklist for Switching Chains

- [ ] Create `lib/chain-registry/chains/<chain>.ts` with a full `ChainConfig` export
- [ ] Import it in `lib/chain-registry/index.ts` and add it to `REGISTRY`
- [ ] Update `DEFAULT_CHAIN_ID` in `lib/chain-registry/index.ts`
- [ ] Update `contracts/config.ts` DEX IDs if they differ from the old chain's
- [ ] Add/update chain env vars in `.env` (see `.env.example`)
- [ ] Verify the app runs: `bun run dev`
- [ ] Connect wallet — the new chain should appear in the RainbowKit chain selector
- [ ] Test a swap — quotes should come from the DEXes you configured
- [ ] Test explorer links — "View on Explorer" should go to the correct block explorer

---

## 0G Hackathon Track — Integration Checklist

For the **Best Agent Frameworks** and **Best Autonomous Agents** tracks:

- [ ] At least one agent uses `saveAgentMemory` / `loadAgentMemory` (0G Storage KV)
- [ ] Conversation history appended via `appendLog` (0G Storage Log)
- [ ] AI inference calls routed through `computeInference` (0G Compute)
- [ ] Critical decisions use `sealed: true` for ZK-verified inference
- [ ] High-volume outputs posted via `postInferenceResult` (0G DA)
- [ ] Swarm coordination messages sent via `postSwarmMessage` (0G DA)
- [ ] Contract deployment addresses committed in `lib/chain-registry/chains/hashkey.ts`
- [ ] Working example agent in the README with inline code or link

---

## Gensyn AXL Hackathon Track — Integration Checklist

For the **Best Application of Agent eXchange Layer (AXL)** track:

- [ ] At least two AXL nodes are running and exchange messages over the mesh
      (verify with `curl http://127.0.0.1:9002/topology` and `curl http://127.0.0.1:9012/topology`)
- [ ] The peer-side MCP router exposes the OmeSwap agent service
      (verify with `curl http://127.0.0.1:9013/services` — should list `ats-agents`)
- [ ] At least one ATS run executes with `transport: 'axl'` and the SSE stream
      contains `payload.axl = { peer_id, role }` annotations on agent events
- [ ] `bun run axl:demo` completes and prints both Node A and Node B public keys
- [ ] Per-role peer mapping is documented in `.env.example` (`AXL_PEER_*`)
- [ ] Setup, env vars, and demo command are documented in `doc/axl.md`
      and linked from the root `README.md`
- [ ] No central message broker replaces what AXL provides — only the local
      Next API (SSE) and persistence layer remain in-process
- [ ] AXL private keys (`*.pem`) are kept out of git
