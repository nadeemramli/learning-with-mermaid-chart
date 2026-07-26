# Nested Systems Explorer

Viewer app (Vite + React Flow + ELK) that renders the mermaid files in
`content/` as a zoomable universe of nested systems. Live at
https://learning-with-mermaid-chart.vercel.app.

## Content pipeline

- `content/manifest.json` is the hierarchy source of truth:
  `links: { nodeId → childSystemId }` on each system defines drill-downs;
  parents are derived. Optional `notes: { nodeId → text }` feeds the
  click-through detail panel; optional `details: { nodeId → text }` renders
  the text INLINE inside the node (Kaplan-summary style — used by fa-sys1..6).
  Both maps are hard-validated against the diagram's node/subgraph ids.
  Optional `layout: { elkOption → value }` overrides ELK options per system
  (fa-architecture pins `elk.layered.cycleBreaking.strategy: MODEL_ORDER` so
  its feedback loops don't scramble the 1→6 reading order; the default is
  GREEDY_MODEL_ORDER).
- Mermaid `<br/>` in labels becomes a real line break (parser converts to \n;
  nodes render with pre-line).
- Diagrams are plain mermaid `flowchart` blocks inside markdown fences.
  Supported subset (parser: `src/lib/mermaid/parse.ts`, fails loudly with
  line numbers): subgraphs with `direction`, `ID["label"]` rectangles,
  `-->` / `-.->` edges with optional `-- "label" -->` / `-. "label" .->`
  variants, chained edges, and edges targeting subgraph IDs. Extend the
  parser rather than swapping in the mermaid npm package.
- Dotted arrows mean "influence without direct authority" — preserve this
  semantic when authoring.

## content/staging workflow

`content/staging/` is a drop zone for raw markdown dumps; it is excluded from
the app bundle (glob in `src/lib/loadUniverse.ts`) and from tests. When asked
to "process staging": normalize each dump into one clean flowchart per zoom
level, move to `content/<subject>/<system-id>.md`, add manifest entries +
drill-down links (a `parent: <system-id> / <NODE_ID>` line in the dump names
the intended hook; otherwise ask), run `npm test`, verify it renders
(`npm run dev`), commit, redeploy, then delete the staging file. Details in
`content/staging/README.md`.

## Gotchas

- `src/lib/mermaid/parse.test.ts` asserts exact node/edge counts of the real
  content files — editing `content/accounting/*.md` intentionally breaks
  them; update the counts.
- React Flow viewport calls (fitView/fitBounds/zoomTo) cancel each other when
  issued in the same tick — chain them with `.then()` (see SystemCanvas.tsx).
- Edges are routed by ELK (`elk.edgeRouting: ORTHOGONAL`) and rendered by the
  custom `ElkEdge` component from `data.points`; don't switch edges back to
  built-in React Flow types or they'll cut through nodes.
- The Vercel project is NOT git-connected — a `git push` alone does not
  redeploy. The repo is linked to project `learning-with-mermaid-chart`
  (team `nadeemramlis-projects`) via the authenticated Vercel CLI: deploy
  with `npx vercel deploy --prod --yes`.

## Commands

- `npm run dev` — dev server (content errors crash the overlay with precise
  messages at startup, by design)
- `npm test` — parser / universe / layout suites
- `npm run build` — type-check + production build
