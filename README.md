# Nested Systems Explorer

An interactive mapping app for learning through systems-thinking mental models.
A tree of plain mermaid flowchart files becomes a zoomable universe: click a
node to **dive into** the system it contains, zoom back out without ever losing
sight of where you are in the whole.

Current universe: **The Economy → Accounting & Regulatory Ecosystem → Financial
Accounting Architecture** (ACCA study material).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # parser / universe / layout tests
npm run build    # production build in dist/
```

## Navigation

- **Double-click** a glowing node (or its ⤵ badge) to enter its child system.
- **Click** any node for its detail panel: notes, what feeds it, what it feeds.
- **Esc** zooms out to the parent system; the bottom-left card always shows the
  parent with your entry point pulsing — click it to zoom out too.
- **⌘K / Ctrl+K / `/`** searches every node in every system.
- Every view is deep-linkable: `/s/<system-id>?node=<NODE_ID>`.
- Dotted arrows mean *influence without direct authority*; solid arrows are
  direct flows.

## Adding content

Content lives in `content/` as ordinary mermaid flowcharts inside markdown
fences — they stay previewable on GitHub and easy to generate with AI.

1. Write a new diagram, e.g. `content/accounting/provisions.md`:

   ````markdown
   ```mermaid
   flowchart TB
       P["Provisions and contingencies"]
       ...
   ```
   ````

2. Register it in `content/manifest.json` and link it from a node (or subgraph)
   of its parent system:

   ```json
   "systems": {
     "fa-architecture": {
       "links": { "M3": "provisions" }
     },
     "provisions": {
       "title": "Provisions & Contingencies (MFRS 137)",
       "file": "accounting/provisions.md",
       "links": {}
     }
   }
   ```

   `links` maps a node ID in the parent diagram → child system ID. Optional
   `notes` maps node IDs → text for the detail panel.

3. `npm run dev` — the loader validates everything at startup and fails with a
   precise message if a link points at a node that doesn't exist. Push to
   deploy.

Supported mermaid subset: `flowchart TB|LR|...`, `subgraph ID["Label"]` with
`direction`, `ID["label"]` rectangles, `-->` and `-.->` edges (with optional
`-- "label" -->` / `-. "label" .->` variants), chained edges (`A --> B --> C`),
and edges that target subgraph IDs. Anything else fails loudly with a line
number — extend `src/lib/mermaid/parse.ts` when you need more.
