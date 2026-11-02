# Graph Report - public  (2026-04-18)

## Corpus Check
- Corpus is ~47,642 words - fits in a single context window. You may not need a graph.

## Summary
- 7 nodes · 5 edges · 3 communities detected
- Extraction: 20% EXTRACTED · 80% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Uniswap bento marketing tiles|Uniswap bento marketing tiles]]
- [[_COMMUNITY_Omeswap brand and Explore UI|Omeswap brand and Explore UI]]
- [[_COMMUNITY_UniswapX branding pair|UniswapX branding pair]]

## God Nodes (most connected - your core abstractions)
1. `Omeswap Explore dashboard marketing screenshot` - 2 edges
2. `Liquidity provisions bento illustration` - 2 edges
3. `Trading API bento illustration` - 2 edges
4. `Omeswap purple swirl brand mark` - 1 edges
5. `Unichain bento graphic` - 1 edges
6. `UniswapX purple lightning background` - 1 edges
7. `UniswapX wordmark and gasless swap UI chrome` - 1 edges

## Surprising Connections (you probably didn't know these)
- `Omeswap Explore dashboard marketing screenshot` --conceptually_related_to--> `Trading API bento illustration`  [INFERRED]
  public/swap-preview.png → public/bento/TradingAPI.svg
- `Liquidity provisions bento illustration` --semantically_similar_to--> `Trading API bento illustration`  [INFERRED] [semantically similar]
  public/bento/LiquidityProvisions.svg → public/bento/TradingAPI.svg
- `Omeswap purple swirl brand mark` --conceptually_related_to--> `Omeswap Explore dashboard marketing screenshot`  [INFERRED]
  public/logo.png → public/swap-preview.png
- `Liquidity provisions bento illustration` --conceptually_related_to--> `Unichain bento graphic`  [INFERRED]
  public/bento/LiquidityProvisions.svg → public/bento/Unichain.svg
- `UniswapX purple lightning background` --conceptually_related_to--> `UniswapX wordmark and gasless swap UI chrome`  [EXTRACTED]
  public/bento/UniswapX-bg.svg → public/bento/UniswapX.svg

## Hyperedges (group relationships)
- **Uniswap ecosystem marketing bento set** — liquidityprovisions_bento_art, tradingapi_bento_art, unichain_bento_art, uniswapx_bg_lightning, uniswapx_wordmark_ui [INFERRED 0.75]
- **Uniswap ecosystem marketing bento set** — liquidityprovisions_bento_art, tradingapi_bento_art, unichain_bento_art, uniswapx_bg_lightning, uniswapx_wordmark_ui [INFERRED 0.75]

## Communities

### Community 0 - "Uniswap bento marketing tiles"
Cohesion: 0.67
Nodes (3): Liquidity provisions bento illustration, Trading API bento illustration, Unichain bento graphic

### Community 1 - "Omeswap brand and Explore UI"
Cohesion: 1.0
Nodes (2): Omeswap purple swirl brand mark, Omeswap Explore dashboard marketing screenshot

### Community 2 - "UniswapX branding pair"
Cohesion: 1.0
Nodes (2): UniswapX purple lightning background, UniswapX wordmark and gasless swap UI chrome

## Knowledge Gaps
- **4 isolated node(s):** `Omeswap purple swirl brand mark`, `Unichain bento graphic`, `UniswapX purple lightning background`, `UniswapX wordmark and gasless swap UI chrome`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Omeswap brand and Explore UI`** (2 nodes): `Omeswap purple swirl brand mark`, `Omeswap Explore dashboard marketing screenshot`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UniswapX branding pair`** (2 nodes): `UniswapX purple lightning background`, `UniswapX wordmark and gasless swap UI chrome`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Trading API bento illustration` connect `Uniswap bento marketing tiles` to `Omeswap brand and Explore UI`?**
  _High betweenness centrality (0.267) - this node is a cross-community bridge._
- **Why does `Omeswap Explore dashboard marketing screenshot` connect `Omeswap brand and Explore UI` to `Uniswap bento marketing tiles`?**
  _High betweenness centrality (0.200) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Omeswap Explore dashboard marketing screenshot` (e.g. with `Omeswap purple swirl brand mark` and `Trading API bento illustration`) actually correct?**
  _`Omeswap Explore dashboard marketing screenshot` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `Liquidity provisions bento illustration` (e.g. with `Trading API bento illustration` and `Unichain bento graphic`) actually correct?**
  _`Liquidity provisions bento illustration` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `Trading API bento illustration` (e.g. with `Omeswap Explore dashboard marketing screenshot` and `Liquidity provisions bento illustration`) actually correct?**
  _`Trading API bento illustration` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Omeswap purple swirl brand mark`, `Unichain bento graphic`, `UniswapX purple lightning background` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._