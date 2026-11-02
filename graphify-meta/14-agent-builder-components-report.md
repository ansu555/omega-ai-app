# Graph Report - /home/anik2003/Documents/omeswap/components/agent-builder  (2026-04-18)

## Corpus Check
- Corpus is ~12,939 words - fits in a single context window. You may not need a graph.

## Summary
- 52 nodes · 37 edges · 17 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Top Bar Actions|Top Bar Actions]]
- [[_COMMUNITY_Workflow Persistence|Workflow Persistence]]
- [[_COMMUNITY_Toolbar Operations|Toolbar Operations]]
- [[_COMMUNITY_Agent Block Node|Agent Block Node]]
- [[_COMMUNITY_Canvas View Controls|Canvas View Controls]]
- [[_COMMUNITY_Configuration Panel|Configuration Panel]]
- [[_COMMUNITY_Base Node UI|Base Node UI]]
- [[_COMMUNITY_Chart Interactions|Chart Interactions]]
- [[_COMMUNITY_Agent Manager|Agent Manager]]
- [[_COMMUNITY_Block Palette|Block Palette]]
- [[_COMMUNITY_Backtest Strip|Backtest Strip]]
- [[_COMMUNITY_Canvas Wrapper|Canvas Wrapper]]
- [[_COMMUNITY_Module Exports|Module Exports]]
- [[_COMMUNITY_Agent Sidebar|Agent Sidebar]]
- [[_COMMUNITY_Backtest Summary|Backtest Summary]]
- [[_COMMUNITY_Node Palette|Node Palette]]
- [[_COMMUNITY_Toast Notifications|Toast Notifications]]

## God Nodes (most connected - your core abstractions)
1. `handleRun()` - 3 edges
2. `getScheduleNode()` - 2 edges
3. `executeOnce()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Top Bar Actions"
Cohesion: 0.38
Nodes (3): executeOnce(), getScheduleNode(), handleRun()

### Community 1 - "Workflow Persistence"
Cohesion: 0.29
Nodes (0): 

### Community 2 - "Toolbar Operations"
Cohesion: 0.33
Nodes (0): 

### Community 3 - "Agent Block Node"
Cohesion: 0.5
Nodes (0): 

### Community 4 - "Canvas View Controls"
Cohesion: 0.5
Nodes (0): 

### Community 5 - "Configuration Panel"
Cohesion: 0.5
Nodes (0): 

### Community 6 - "Base Node UI"
Cohesion: 0.5
Nodes (0): 

### Community 7 - "Chart Interactions"
Cohesion: 0.67
Nodes (0): 

### Community 8 - "Agent Manager"
Cohesion: 1.0
Nodes (0): 

### Community 9 - "Block Palette"
Cohesion: 1.0
Nodes (0): 

### Community 10 - "Backtest Strip"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "Canvas Wrapper"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Module Exports"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Agent Sidebar"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Backtest Summary"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Node Palette"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Toast Notifications"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Agent Manager`** (2 nodes): `AgentManager()`, `AgentManager.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Block Palette`** (2 nodes): `handleDragStart()`, `BlockPalette.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Backtest Strip`** (2 nodes): `clsx()`, `BacktestConfigStrip.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Canvas Wrapper`** (2 nodes): `FlowCanvas.tsx`, `FlowCanvas()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Exports`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Agent Sidebar`** (1 nodes): `AgentSidebar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Backtest Summary`** (1 nodes): `BacktestSummaryModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Node Palette`** (1 nodes): `NodePalette.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Toast Notifications`** (1 nodes): `ToastContainer.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Not enough signal to generate questions. This usually means the corpus has no AMBIGUOUS edges, no bridge nodes, no INFERRED relationships, and all communities are tightly cohesive. Add more files or run with --mode deep to extract richer edges._