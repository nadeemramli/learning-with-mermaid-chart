# Staging — raw content drop zone

Paste raw markdown/mermaid here in any state of mess. Nothing in this folder
is loaded by the app or shipped in the bundle — it only becomes part of the
universe once it's processed into a real `content/` file and registered in
`manifest.json`.

## How to use it

1. Create a file here (any name, e.g. `provisions-dump.md`) and paste your
   raw material — one or several mermaid blocks, notes, half-finished ideas.
2. Optionally tell the processor where it belongs, at the top of the file:

   ```markdown
   # Provisions & Contingencies (MFRS 137)
   parent: fa-architecture / M3
   ```

   `parent: <system-id> / <NODE_ID>` names the existing system and the node
   that should drill down into this new one. Leave it out if you're not sure —
   you'll be asked.

3. Ask Claude to "process content/staging". Processing means:
   - normalize each dump to one clean `flowchart` per system, in the
     supported syntax (see root README);
   - split or merge blocks into sensible zoom levels;
   - move the result to `content/<subject>/<system-id>.md`;
   - register it in `manifest.json` with its drill-down link (and notes if
     the dump contained prose worth keeping);
   - run the test suite, verify it renders, commit, and redeploy;
   - delete the processed staging file.

## Ground rules

- One *system* (one zoom level) per output file — if a dump contains both an
  overview and a deep taxonomy, it becomes two files linked by a node.
- Node IDs must be unique within a file; reuse the parent diagram's ID style
  (mnemonic acronyms like `MFRS`, or ordinal ones like `M1..M4`).
- Dotted arrows (`-.->`) mean influence without direct authority; solid
  arrows are direct flows. Keep that semantic distinction.
