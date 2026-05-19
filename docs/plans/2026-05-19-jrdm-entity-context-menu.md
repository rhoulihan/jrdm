# JRDM — Entity Context Menu (replaces drag trigger) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. Locked design + rationale: `docs/design/2026-05-18-jrdm-map-to-document-modal.md` §1 (REVISED 2026-05-19) — **do not relitigate**.

**Goal:** Replace the conflicting "drag entity onto document" trigger with an accessible **entity context menu** (right-click + a visible `⋯` header affordance) offering: **Map to document…** (disabled unless a root entity exists in the document), **New duality view from this table**, **Inspect table**, **Hide from canvas**. Keep React Flow node-drag for repositioning (v0.4.2). **Retire** the legacy per-column quick-drag and the now-superseded column→nested-field drag-authoring path (the Map-to-Document modal replaces it).

**Architecture:** One canvas-level accessible `ContextMenu` (React Flow `onNodeContextMenu` + a `⋯` button in `EntityNode` both open it). A pure `canMapToDocument(editingView)` gate. A store `hiddenEntities` view-state slice (declutter; not persisted, cleared by `reset()`). Remove the native entity-drag from `EntityNode`, the per-column `<li draggable>`, the dead `application/x-jrdm-entity` + `application/x-jrdm-column` drop handlers (`DocumentTree`, `FieldNode`), and the v0.3b.1 column-drag-authoring tests/e2e (intentional supersession — not a weakened guard).

**Tech Stack:** unchanged — React 18 + @xyflow/react 12, Zustand 5, Tailwind 3, Vitest+RTL+jsdom, Playwright. No new deps.

---

## Conventions (inherited — do not relitigate)

- Branch/PR per task. Merge `--squash --delete-branch` ONLY when `lint/typecheck/unit/integration/e2e` all `success`; **`container` (Trivy/Docker) failure is the known non-blocking carry-forward — does NOT block; `integration` is the real-Oracle job and MUST be success.** Then `git checkout main && git pull --ff-only`. Poll CI to completion yourself (`for i in $(seq 1 120); do S=$(gh run list --branch <b> --limit 1 --json status,conclusion --jq '.[0]'); echo "[$i] $S"; echo "$S"|grep -q '"status":"completed"'&&break; sleep 20; done` then `gh run view <id> --json jobs --jq '.jobs[]|"\(.name): \(.conclusion)"'`); never stop at "waiting"; one `gh run rerun <id> --failed` only for an isolated Oracle container-startup flake unrelated to a web-only diff; never merge red; never `--no-verify`.
- Test-pair gate: every staged `*.ts(x)` source co-stages its colocated/annotated test with a genuine assertion. `apps/web` ≥ 70/65. **Production DOM stays clean** (scoped queries, no markup contortion). a11y: `ContextMenu` = `role="menu"`/`menuitem`, `aria-disabled` on gated items, Esc/outside-click close, keyboard nav, focus mgmt. `gh` authed `rhoulihan`, repo `rhoulihan/jrdm`. TDD strictly.

## Current state (verified)

`EntityNode.tsx`: header `<button draggable onDragStart=ENTITY_DRAG_MIME onClick=selectEntity>` + per-column `<li draggable onDragStart=DRAG_MIME>`. `DiagramPane.tsx`: React Flow `useNodesState`/`onNodesChange`, no `nodesDraggable={false}` (nodes reposition), `nodeTypes={{entity:EntityNode}}`, no `onNodeContextMenu`. `DocumentTree.tsx` `onDrop` handles `application/x-jrdm-entity` (→`openMapping`) and `application/x-jrdm-column` (quick scalar bind); `FieldNode.tsx` accepts `application/x-jrdm-column` nested drop (v0.3b.1). Store: `openMapping(table)`, `closeMapping`, `mapping`, `startNewView(table)`, `selectEntity`, `editingView`, inspector drawer slice, `reset()`. `shell/Modal` + Phase-0 `MenuBar` exist (a context menu is a distinct small popover — new). v0.3b.1 nested-authoring + the M.T5 entity-drag e2e currently exercise the drag paths being retired.

---

## Task Sequencing

| #     | Task                                                                                                                                  | Depends |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| ER.T1 | `ContextMenu` component + `canMapToDocument` pure gate (isolated, unit-tested)                                                        | —       |
| ER.T2 | Wire menu into `EntityNode` (`⋯`) + `DiagramPane` (`onNodeContextMenu`); 4 actions; store `hiddenEntities`; remove native entity-drag | ER.T1   |
| ER.T3 | Retire per-column quick-drag + dead drop handlers + superseded v0.3b.1 column-authoring tests                                         | ER.T2   |
| ER.T4 | e2e (right-click/`⋯`→modal, gating, new-view, hide/show, no column drag) + docs/lessons + container rebuild                           | ER.T1-3 |

---

## ER.T1 — `ContextMenu` + `canMapToDocument`

**Files:** create `apps/web/src/diagram/ContextMenu.tsx`(+test); `apps/web/src/diagram/canMapToDocument.ts`(+test). Additive (no importers yet → main stays green).

- [ ] Branch `feat/erctx-contextmenu`.
- [ ] **`canMapToDocument` — tests first.** Pure: `canMapToDocument(editingView: DualityView | null): boolean` → `true` iff `editingView` is non-null with a root entity (a started duality view exists to embed into); `false` for `null`. (This is the "Map to document grayed unless a root entity exists" gate.) Tests: null→false; a minimal valid view→true.
- [ ] **`ContextMenu` — tests first.** Controlled/presentational, no store import. Props: `{ open:boolean; x:number; y:number; items: {label:string; onSelect():void; disabled?:boolean; title?:string}[]; onClose():void }`. Assert: nothing when `!open`; when open → fixed-positioned popover at (x,y), `role="menu"`, each item `role="menuitem"`; click enabled item → its `onSelect` + `onClose`; **disabled item: `aria-disabled="true"`, not clickable, shows `title` tooltip**; Esc closes; outside/overlay click closes; ArrowUp/Down move focus, Enter activates focused; opens with focus on the first enabled item. Tailwind locked tokens. Scoped queries; no markup contortion.
- [ ] Implement minimally; `pnpm --filter @jrdm/web test` green; coverage ≥70/65. Commit (source+test co-staged); PR; poll; merge.

**Self-review:** gate correct; menu a11y (menu/menuitem/aria-disabled/keyboard/Esc/outside-close); zero importers; main green.

## ER.T2 — Wire the menu; remove native entity-drag; `hiddenEntities`

**Files:** modify `apps/web/src/diagram/EntityNode.tsx`(+test), `apps/web/src/diagram/DiagramPane.tsx`(+test), `apps/web/src/state/store.ts`(+test). Possibly `inspector` selection wiring (reuse existing select→inspector).

- [ ] Branch `feat/erctx-wire` off fresh `main` (after ER.T1).
- [ ] **Store — tests first.** Add `hiddenEntities: string[]` (default `[]`) + `hideEntity(name)` / `showEntity(name)` / `showAllEntities()`. NOT persisted; cleared by `reset()` (add to the cleared set like other ephemeral view-state). Tests: defaults, each action, `reset()` clears.
- [ ] **EntityNode — tests first then implement.** REMOVE the header's native `draggable`/`onDragStart` (ENTITY_DRAG_MIME) — keep `onClick=selectEntity`. Add a visible **`⋯` button** (`data-testid="entity-menu-<name>"`, accessible label "Table actions") that opens the context menu (lift open/coords/target via props/callback so `DiagramPane` owns the single menu instance — EntityNode signals "open menu for entity X at coords"). Do NOT remove React Flow node-drag (leave node repositioning intact). (Per-column `<li draggable>` is retired in ER.T3, not here — leave for now to keep this task focused, OR remove here if cleaner; if left, ER.T3 finishes it.)
- [ ] **DiagramPane — tests first then implement.** Add React Flow `onNodeContextMenu` (preventDefault; capture entity + client coords) and render ONE `<ContextMenu>` driven by local state, with items:
  - **Map to document…** → `openMapping(entity)`; `disabled = !canMapToDocument(editingView)`, `title` when disabled = "Create a root view first (New duality view from this table)".
  - **New duality view from this table** → `startNewView(entity)`.
  - **Inspect table** → `selectEntity(entity)` + open the Inspector drawer (reuse the existing select→drawer mechanism).
  - **Hide from canvas** → `hideEntity(entity)`.
    Filter hidden entities out of the rendered React Flow `nodes` (respect `hiddenEntities`); add a small **"Show hidden (N)"** control (`data-testid="show-hidden"`) visible when `hiddenEntities.length>0` → `showAllEntities()`. The `⋯` button path opens the same single menu at the button's coords.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` green; coverage ≥70/65. Commit; PR; poll; merge.

**Self-review:** right-click AND `⋯` open the same accessible menu; Map-to-document gated by `canMapToDocument` (disabled+tooltip when no root); New-view/Inspect/Hide work; hidden entities filtered + restorable; **node-drag still repositions** (v0.4.2 intact); native entity-drag gone; existing diagram/store tests green.

## ER.T3 — Retire per-column quick-drag + superseded authoring path

**Files:** `apps/web/src/diagram/EntityNode.tsx`(+test) (remove `<li draggable onDragStart=DRAG_MIME>`), `apps/web/src/document/DocumentTree.tsx`(+test) (remove the `application/x-jrdm-column` AND now-dead `application/x-jrdm-entity` drop branches/handlers), `apps/web/src/document/FieldNode.tsx`(+test) (remove the v0.3b.1 column nested-drop handler), `apps/web/src/document/dropTarget.ts` (remove `DRAG_MIME` if now unused; keep file/exports others need), and the v0.3b.1 + M.T5-entity-drag **unit tests/e2e** that exercised the removed drag-authoring (remove or rewrite — the Map-to-Document modal is the replacement; this is intentional supersession, NOT a weakened/disabled guard — delete the obsolete assertions cleanly, do not leave hollow skipped tests).

- [ ] Branch `feat/erctx-retire-coldrag` off fresh `main` (after ER.T2).
- [ ] Remove the drag source + dead drop handlers + dead MIME constants; ensure no dead `onDrop`/`onDragOver` left on `DocumentTree`/`FieldNode` and no unused imports. Keep DocumentTree/FieldNode rendering + the v0.3b.1 **tree a11y / +add-node toolbar / keyboard nav** (those are NOT drag — keep them; only the column-drop authoring is retired). Update affected unit tests to assert the new reality (no column drag; document is authored via the modal); remove the obsolete v0.3b.1 column→FieldNode-drop and M.T5 entity-drag scenarios from `smoke.spec.ts` (ER.T4 adds the replacement e2e).
- [ ] `grep -rn "x-jrdm-column\|x-jrdm-entity\|ENTITY_DRAG_MIME\|DRAG_MIME" apps/web/src` → only intentional remaining refs (ideally none in source). `pnpm lint && pnpm typecheck && pnpm test` green; coverage ≥70/65. Commit; PR; poll; merge.

**Self-review:** no column/entity native-drag source or drop handler remains; no dead code/imports/MIME; retired tests deleted cleanly (not skipped/hollow); all OTHER guards (v0.4 conflict, v0.4.2 layout/draggable, mapping-modal Save/Cancel + locked-node, importer ALL\_\* fix, Phase-0 shell, v0.3b.1 tree-a11y/toolbar) still pass unweakened.

## ER.T4 — e2e + docs + container rebuild

**Files:** `apps/web/src/__tests__/smoke.spec.ts`; `tasks/lessons.md`; `docs/plans/2026-05-15-jrdm-roadmap.md` (short note); `README.md` (authoring flow → "right-click / ⋯ entity → Map to document").

- [ ] Branch `feat/erctx-e2e-docs` off fresh `main` (after ER.T3).
- [ ] New e2e (mock JRDM endpoints only): import `ORDERS_DEMO`-like schema → **right-click an entity** AND (separately) the **`⋯` button** → assert the context menu opens with the 4 items → with NO editingView assert **"Map to document…" is disabled (aria-disabled + tooltip)** and "New duality view from this table" enabled → click New-view (root created) → now right-click another entity → **"Map to document…" is enabled** → click it → the Map-to-Document modal opens → minimal genuine map+Save → main pane shows the embedded doc w/ sample (reuse the established non-tautological assertions). Also: **Hide from canvas** hides a node and "Show hidden (N)" restores it; assert **no element is `draggable` for entity/column** (the retired drag) while a **node still repositions** via React Flow drag (keep the v0.4.2 draggable guard). Keep ALL other scenarios green & unweakened. Run `pnpm --filter @jrdm/web test:e2e` locally until all green.
- [ ] `tasks/lessons.md` dated entry: React-Flow node-drag vs native HTML5 drag are mutually exclusive on one gesture → entity actions moved to a context menu (right-click + `⋯`); Map-to-document gated on an existing root view; per-column drag retired (superseded by the modal). Markdown lint-clean (`prettier --write` + `markdownlint-cli2 --fix`). Update roadmap note + README authoring flow.
- [ ] PR; poll; merge. Then rebuild local container: `git checkout main && git pull --ff-only && docker compose -f tools/docker/docker-compose.yml build && docker compose -f tools/docker/docker-compose.yml up -d --force-recreate`, `CID=$(docker compose -f tools/docker/docker-compose.yml ps -q jrdm); docker network connect json-sql-guide_default "$CID" 2>/dev/null; curl -s -m5 -o /dev/null -w "GET / %{http_code}\n" http://localhost:3737/` — report.

**Self-review:** menu reachable via right-click AND `⋯`; gating correct; new-view/inspect/hide/show all work; modal still works post-Save with the non-tautological sample/DDL assertions; the retired drag is genuinely gone (asserted) while node-repositioning still works; all prior guards intact; docs accurate + lint-clean; container live.

---

## Exit / review

Independent opus review on the exact merged HEAD: (1) the drag conflict is genuinely resolved (node-drag repositions; entity actions are on the context menu via right-click AND `⋯`); (2) "Map to document…" is correctly gated (disabled unless a root view exists) and the full menu→modal→Save→sample chain is reachable; (3) the per-column/entity drag retirement is a CLEAN removal (no dead code/handlers/MIME, retired tests deleted not hollow-skipped, the modal genuinely covers the superseded use cases); (4) NO other guard (v0.4/v0.4.2/mapping-modal/importer-fix/Phase-0/v0.3b.1-tree-a11y) regressed or was weakened; CI green incl. real-Oracle `integration`. Then the container rebuild is verified live.
