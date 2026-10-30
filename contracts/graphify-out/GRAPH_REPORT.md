# Graph Report - contracts  (2026-04-19)

## Corpus Check
- Corpus is ~1,728 words - fits in a single context window. You may not need a graph.

## Summary
- 12 nodes · 6 edges · 6 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Contract Config Constants|Contract Config Constants]]
- [[_COMMUNITY_Config File Artifact|Config File Artifact]]
- [[_COMMUNITY_Contract Exports Index|Contract Exports Index]]
- [[_COMMUNITY_ABI Exports Index|ABI Exports Index]]
- [[_COMMUNITY_Contracts Index Module|Contracts Index Module]]
- [[_COMMUNITY_Contract Exports Alias|Contract Exports Alias]]

## God Nodes (most connected - your core abstractions)
1. `contracts/config.ts` - 6 edges
2. `CONTRACT_ADDRESSES` - 1 edges
3. `DEX_ROUTERS` - 1 edges
4. `TRADER_JOE_V2` - 1 edges
5. `TOKEN_ADDRESSES` - 1 edges
6. `WAVAX_ADDRESS` - 1 edges
7. `Backward-Compatibility Re-Export Shim` - 1 edges
8. `contracts/index.ts` - 0 edges
9. `index.ts (Contract Exports)` - 0 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Hyperedges (group relationships)
- **Chain Registry Configuration Aggregation** — config_ts, contract_addresses_export, dex_routers_export, token_addresses_export [INFERRED 0.80]
- **Contract Config** — config_ts [EXTRACTED 1.00]
- **Contract Exports** — contracts_index_ts [EXTRACTED 1.00]
- **ABI Exports** — abis_index_ts [EXTRACTED 1.00]

## Communities

### Community 0 - "Contract Config Constants"
Cohesion: 0.29
Nodes (7): Backward-Compatibility Re-Export Shim, contracts/config.ts, CONTRACT_ADDRESSES, DEX_ROUTERS, TOKEN_ADDRESSES, TRADER_JOE_V2, WAVAX_ADDRESS

### Community 1 - "Config File Artifact"
Cohesion: 1.0
Nodes (0): 

### Community 2 - "Contract Exports Index"
Cohesion: 1.0
Nodes (0): 

### Community 3 - "ABI Exports Index"
Cohesion: 1.0
Nodes (0): 

### Community 4 - "Contracts Index Module"
Cohesion: 1.0
Nodes (1): contracts/index.ts

### Community 5 - "Contract Exports Alias"
Cohesion: 1.0
Nodes (1): index.ts (Contract Exports)

## Knowledge Gaps
- **8 isolated node(s):** `CONTRACT_ADDRESSES`, `DEX_ROUTERS`, `TRADER_JOE_V2`, `TOKEN_ADDRESSES`, `WAVAX_ADDRESS` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Config File Artifact`** (1 nodes): `config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Contract Exports Index`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ABI Exports Index`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Contracts Index Module`** (1 nodes): `contracts/index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Contract Exports Alias`** (1 nodes): `index.ts (Contract Exports)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `CONTRACT_ADDRESSES`, `DEX_ROUTERS`, `TRADER_JOE_V2` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._