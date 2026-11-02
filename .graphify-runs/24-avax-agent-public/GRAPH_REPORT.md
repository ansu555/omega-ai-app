# Graph Report - avax-agent/public  (2026-04-18)

## Corpus Check
- Corpus is ~462 words - fits in a single context window. You may not need a graph.

## Summary
- 24 nodes · 30 edges · 5 communities detected
- Extraction: 43% EXTRACTED · 57% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Globe icon SVG|Globe icon SVG]]
- [[_COMMUNITY_Next.js logo|Next.js logo]]
- [[_COMMUNITY_Window chrome icon|Window chrome icon]]
- [[_COMMUNITY_Document file icon|Document file icon]]
- [[_COMMUNITY_Vercel triangle mark|Vercel triangle mark]]

## God Nodes (most connected - your core abstractions)
1. `SVG root (viewBox 0 0 16 16, fill none)` - 3 edges
2. `Group with clip-path url(#a)` - 3 edges
3. `Globe meridian grid path (fill #666, fill-rule evenodd)` - 3 edges
4. `ClipPath id a: 16x16 rectangular mask (white fill)` - 3 edges
5. `SVG root (viewBox 0 0 394 80, fill none, xmlns SVG 1.1)` - 3 edges
6. `Primary path: large Next.js wordmark geometry (fill #000)` - 3 edges
7. `Secondary path: small Next.js mark / sub-wordmark detail (fill #000)` - 3 edges
8. `Next.js framework default logo asset (public static SVG)` - 3 edges
9. `SVG root (viewBox 0 0 16 16, fill none)` - 3 edges
10. `Window outer frame path (rounded rectangle, fill #666)` - 3 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Hyperedges (group relationships)
- **16px document glyph: one SVG root and one filled path (folded page plus rules)** — file_svg_root, file_path_document_glyph [EXTRACTED 1.00]
- **Clipped 16px globe grid icon (defs clipPath plus single path)** — globe_svg_root, globe_g_clipped, globe_path_grid, globe_clip_rect_def [EXTRACTED 1.00]
- **Next.js horizontal logo: transparent canvas with two black path layers** — next_svg_root, next_path_primary, next_path_secondary [EXTRACTED 1.00]
- **Minimal one-path triangle logo asset (transparent SVG, white fill)** — vercel_svg_root, vercel_triangle_path [EXTRACTED 1.00]
- **Single-path 16px window chrome glyph (frame plus three dots)** — window_svg_root, window_path_frame, window_path_titlebar_dots [EXTRACTED 1.00]

## Communities

### Community 0 - "Globe icon SVG"
Cohesion: 0.53
Nodes (5): ClipPath id a: 16x16 rectangular mask (white fill), Group with clip-path url(#a), World or internet globe UI glyph (16px), Globe meridian grid path (fill #666, fill-rule evenodd), SVG root (viewBox 0 0 16 16, fill none)

### Community 1 - "Next.js logo"
Cohesion: 0.7
Nodes (4): Primary path: large Next.js wordmark geometry (fill #000), Secondary path: small Next.js mark / sub-wordmark detail (fill #000), SVG root (viewBox 0 0 394 80, fill none, xmlns SVG 1.1), Next.js framework default logo asset (public static SVG)

### Community 2 - "Window chrome icon"
Cohesion: 0.7
Nodes (4): Browser or OS window chrome icon (frame + traffic-light dots), Window outer frame path (rounded rectangle, fill #666), Title bar control dots (three .75-radius circles, fill #666), SVG root (viewBox 0 0 16 16, fill none)

### Community 3 - "Document file icon"
Cohesion: 0.67
Nodes (3): Generic document or file attachment icon (page with folded corner and text lines), Single compound path: folded sheet, corner fold triangle, horizontal rule lines (fill #666, evenodd), SVG root (viewBox 0 0 16 16, fill none, W3C SVG namespace)

### Community 4 - "Vercel triangle mark"
Cohesion: 0.67
Nodes (3): Vercel-style upward triangle mark (brand-associated raster/vector glyph), SVG root (viewBox 0 0 1155 1000, fill none, SVG namespace), Single path triangle (d m577.3 0 577.4 1000H0z, fill #fff)

## Suggested Questions
_Not enough signal to generate questions. This usually means the corpus has no AMBIGUOUS edges, no bridge nodes, no INFERRED relationships, and all communities are tightly cohesive. Add more files or run with --mode deep to extract richer edges._