# JRDM — "Map Table to Document" Modal (FINAL design — Rick, 2026-05-18)

> **Status:** FINAL. Rick provided this as the authoritative guide ("use this guide for the final design"). No open questions. This is the central authoring interaction of the redesigned shell and **reshapes Phase 1/5** of `2026-05-18-jrdm-ui-redesign.md` (it replaces blind one-column-at-a-time dragging with a deliberate, FK-aware embed step). Wireframe: `./wireframes/07-map-to-document-modal.svg`.

## 1. Trigger — REVISED 2026-05-19 (drag conflicted with node repositioning)

**Superseded:** the original "drag entity onto the document canvas" trigger conflicted irreconcilably with React Flow node-drag (dragging an entity repositions it on the ERD — the v0.4.2 behavior we keep). Native HTML5 entity-drag could not coexist with pointer-based node drag on the same gesture.

**Final trigger — an entity context menu** (right-click on an ERD entity **and** a visible `⋯` affordance on the entity header, both opening the same accessible menu via React Flow `onNodeContextMenu` + one canvas-level `ContextMenu`):

| Item                                 | Action                                                                                       | Enablement                                                                                                                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Map to document…**                 | Opens the Map-to-Document modal (§2) to embed this entity into the existing document.        | **Disabled (grayed, with tooltip) unless a root entity already exists in the document** (i.e. there is an `editingView` with a root entity). Empty document → use "New view from this table" first. |
| **New duality view from this table** | `startNewView(table)` — make this entity the **root** of a fresh duality view.               | Always enabled.                                                                                                                                                                                     |
| **Inspect table**                    | Select the entity + open the Inspector drawer (columns/PK/FKs).                              | Always enabled.                                                                                                                                                                                     |
| **Hide from canvas**                 | View-only declutter (entity stays in the model; restorable via a "show hidden (N)" control). | Always enabled.                                                                                                                                                                                     |

ERD entity **node-drag still repositions** the table on the left canvas (v0.4.2, unchanged). The legacy **per-column quick-drag is retired** in this change (it shared the same React-Flow conflict and is fully superseded by the modal's field checklist) — its drag source, the now-dead document/FieldNode column-drop handlers, and the old column→nested-field drag-authoring path (and its tests) are removed as a deliberate supersession; all other guards remain intact.

## 2. Modal layout (left list · middle button · right tree · footer)

```text
┌──────────────────── Map “ORDER_ITEMS” to Document ──────────────────────┐
│ ┌─ Fields ──────────┐                  ┌─ Document ────────────────────┐ │
│ │ [✓] Select All     │                 │ ▾ orders     root · ORDERS 🔒 │ │
│ │ ─────────────────  │                 │   • _id                    🔒 │ │
│ │ [✓] id             │     ┌────────┐  │   • status                 🔒 │ │
│ │ [✓] order_id       │     │  Map   │  │   ▾ items  ◀ new (selected)  │ │
│ │ [ ] sku            │ ──▶ │   to   │ ─│─▶   (target path)            │ │
│ │ [✓] qty            │     │  Path  │  │                               │ │
│ │ [ ] price          │     └────────┘  │                               │ │
│ │   …scrollable…     │                 │ ☑ embed as array              │ │
│ │ (grayed when       │                 │   FK: ORDERS→ORDER_ITEMS 1:N  │ │
│ │  Select All on)    │                 │ [ + add node ] [ − delete ]   │ │
│ └────────────────────┘                 └───────────────────────────────┘ │
│                                              [ Cancel ]    [ Save ]      │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Left — Fields panel.** Scrollable checkbox list of every column of the dropped table (name + type). A **“Select All”** checkbox above the list control: when checked, every column is selected **and the list below is disabled/grayed out** (whole-table take; to cherry-pick, uncheck Select All).
- **Middle — “Map to Path” button.** Binds the **currently-checked columns** as **scalar fields** of the **currently-selected node** in the document tree on the right. Disabled when nothing is checked or no node is selected.
- **Right — Document tree.** Shows the current document (the working copy of `editingView`). The user **defines the target location by clicking the tree and using the +/− buttons** — there is **no draggable node**. Specifically:
  - **`+ add node`**: if **no node is selected**, it creates a **new root node**; if a node **is selected**, it adds a **new subnode** under that selected node. The newly created node is auto-selected and becomes the **embed location** for the dropped entity table (auto-labelled with the table name).
  - **`− delete`**: deletes the selected node — **only if it was created in this modal session**.
  - **Edit boundary (hard rule):** nodes that existed in the document **before the modal opened are locked** (🔒) — they render (so you can pick where to attach, and as parent context) but **cannot be deleted or structurally changed**. Only session-created nodes are mutable/deletable. `−` is disabled on locked nodes.
  - Selecting a node = choosing the target path; “Map to Path” then fills that node with the checked columns.
- **`☑ embed as array` checkbox** (under the tree, by the placed entity node): whether the entity table embeds as an **array of documents** vs a single embedded **object**. **Populated automatically as the user places the new entity-table node** (i.e. when `+ add node` creates the node under a given parent) — see §4. User-settable only when no FK decides it.
- **Footer — `Cancel` / `Save`.**
  - `Cancel` → discard the working copy; the main document pane is unchanged.
  - `Save` → **embed the entity table into the document at the chosen location** and commit to `editingView`. The **main workspace right-hand pane then renders the new document populated with representative sample data** (§5) and the live DDL updates.

## 3. Mapping semantics (onto the existing model)

- The placed entity-table node = a `NestedField` (`@jrdm/model`): `{ key:<tableName>, kind:"array"|"object", table:<entity.name>, link:{from,to}, fields:[…] }` — UNLESS it is created as the document **root** (no prior `editingView`), in which case it sets `view.root.table` and seeds `fields:[{key:"_id", source:"<table>.<pk>"}]`.
- “Map to Path”’d columns = `ScalarField` children via the existing `documentModel.scalarField(col, table, col)` → `{ key:col, source:"<table>.<col>" }`.
- `+ add node` with a selection = `nestedField(<table>, kind, <table>)` under the selected node (kind from §4); with no selection = a new root.
- `− delete` / Save use the existing immutable `documentModel` ops (`addField`/`removeField`/`patchField`); the pre-existing subtree is copied through unchanged — this is what enforces the locked-node boundary.
- Invariants preserved: root `fields[0].key === "_id"`; nested fields require non-empty `link.from/to` (validator’s `NESTED_LINK_REQUIRED`, unchanged).

## 4. FK-aware “embed as array” rule

When the entity-table node for **T** is placed (via `+ add node`) under a parent node whose table is **P**, search `store.relationships` (populated at import; `Relationship { from:{table,columns}, to:{table,columns}, cardinality:"1:1"|"1:N" }`, `from`=PK/parent side, `to`=FK/child side):

| Relationship between P and T          | `kind`        | `link`                                           | `embed as array`                                           |
| ------------------------------------- | ------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| `from=P`, `to=T`, cardinality **1:N** | `array`       | `from=P.columns`, `to=T.columns`                 | **checked, auto (FK-driven)**                              |
| `from=P`, `to=T`, cardinality **1:1** | `object`      | same join columns                                | unchecked, auto                                            |
| reversed (T is PK/parent side of P)   | `object`      | join columns from the reversed rel               | unchecked, auto                                            |
| **no relationship** P↔T               | user’s choice | blank → user sets `link` in Inspector after Save | **user toggles the checkbox** (default unchecked = object) |
| node created as **root** (no parent)  | n/a           | n/a (root)                                       | n/a (hidden)                                               |

Live: creating/recreating the node under a different parent re-evaluates and re-sets the checkbox. When an FK unambiguously decides it, the checkbox is disabled (forced) with a tooltip naming the relationship (“FK: ORDERS → ORDER_ITEMS (1:N)”). Manual toggle is sticky only in the no-FK case.

## 5. Sample data in the main pane after Save

On Save the main right-hand pane shows the **resulting document populated with representative sample data** so the user immediately sees the shape with values — **no live Oracle required** for this preview. A pure generator `sampleDocument(view, entities)` walks the saved `DualityView` and emits a JSON document: each scalar → a synthetic value by the source column’s type (`NUMBER`→`123`, `VARCHAR2`/`CHAR`→`"sample"`, `DATE`/`TIMESTAMP`→an ISO string, `BOOLEAN`→`true`, etc.); `object` nodes → a nested object; `array` nodes → a 2-element array of the child shape; plus a synthetic `_metadata.etag`. (If/when the view is actually deployed, the real v0.4 `/api/sample` data supersedes the synthetic preview — synthetic is the immediate post-Save feedback.)

## 6. State / components (new, under the redesigned shell)

- `apps/web/src/mapping/MapToDocumentModal.tsx` — composes the three regions + footer on the existing `shell/Modal` primitive; owns the working copy + session-new-node set.
- `apps/web/src/mapping/FieldChecklist.tsx` — left: Select-All (grays the list), scrollable selectable column list.
- `apps/web/src/mapping/MappingTree.tsx` — right: working-copy tree, node selection, `+ add node`(root if none selected / subnode if selected) / `− delete`, locked-node enforcement, the live “embed as array” checkbox.
- `apps/web/src/mapping/fkEmbed.ts` — **pure**: `decideEmbed(relationships, parentTable, childTable) → { kind, link, fkDriven, rel? }` (the §4 table). Unit-tested, no UI.
- `apps/web/src/mapping/workingCopy.ts` — **pure**: seed working copy from `editingView`, record pre-existing (locked) node paths, apply add-node/delete-node/map-fields/set-embed ops immutably, emit the final `DualityView` for Save. Unit-tested.
- `apps/web/src/mapping/sampleDocument.ts` — **pure**: `sampleDocument(view, entities) → unknown` synthetic sample (§5). Unit-tested.
- Store: ephemeral `mapping` slice (`open`, `table`, working state) — not persisted, cleared on Save/Cancel/`reset()`. Saved view flows into existing `editingView` (main pane + DDL react as today); `sampleDocs` set to `[sampleDocument(...)]` so the existing main-pane results view renders it.
- ERD `EntityNode` gains an `application/x-jrdm-entity` drag payload (table name); the document-canvas drop handler opens this modal.

## 7. Phasing (each = TDD + CI-gated PR + independent review, per project discipline)

- **M.T1 — `fkEmbed.ts` + `workingCopy.ts` + `sampleDocument.ts`** (pure core: the FK rule, the locked-node boundary + immutable apply, the synthetic sample). Heaviest test focus — these are the correctness-critical pieces.
- **M.T2 — `FieldChecklist`** (Select-All graying/disable, scroll, selection).
- **M.T3 — `MappingTree`** (working tree, select, `+`=root-if-none/subnode-if-selected, `−` session-only, locked-node enforcement, live embed checkbox bound to `fkEmbed`).
- **M.T4 — `MapToDocumentModal`** compose + “Map to Path” wiring + `Save`→`editingView` + post-Save sample into the main pane; `Cancel` discards.
- **M.T5 — ERD→doc entity drop opens the modal**; e2e (drop table → Select-All grays list / or pick fields → `+ add node` builds path → embed-as-array auto from FK → Map to Path → Save → main pane shows the new document with sample data + DDL updates); docs/lessons; rebuild container.
- Independent opus review: end-to-end drop→build-path→FK-array→map→Save→sample genuinely works; locked-node boundary genuinely blocks pre-existing deletion; FK rule correct for 1:N/1:1/reverse/none; sample generator faithful to the shape; guards non-tautological; CI green on exact HEAD.

Slots in as **redesign Phase 1** (the authoring core), ahead of the cosmetic ConnectModal/dock/drawer polish — highest user value first.
