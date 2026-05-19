# JRDM — "New View" via Modal + Modal Sizing + Create-View Gating

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. Builds on the entity-context-menu feature (`docs/plans/2026-05-19-jrdm-entity-context-menu.md`) and the Map-to-Document modal (`docs/design/2026-05-18-jrdm-map-to-document-modal.md`). Do not relitigate locked design.

**Goal (Rick, 2026-05-19):**

1. **Enlarge the modal** — bigger overall; the right-hand (document tree) side gets more space.
2. **"New duality view from this table"** now **opens the Map-to-Document modal** (not a direct `startNewView`).
3. **Verified fact (drives behavior):** an Oracle duality view's **root entity is ALWAYS the document root — it cannot be stored at a nested path** (confirmed in `@jrdm/model` `DualityViewSchema` — single `root.table`, `fields[0].key==="_id"` — and both emitters: SQL `SELECT JSON {…} FROM <root>` / GraphQL `<root> { … }`). Therefore in the **create-root flow** (no `editingView` yet) the modal **disables the `+ add node` / `− delete` buttons** and the selected attributes **populate the document ROOT directly**. (Add/remove path-building remains enabled only for the embed flow — `editingView` already exists.)
4. **OK/Save** writes the selected attributes to the main right-hand pane exactly as Map-to-Document already does (`setEditingView` + `setSampleDocs([sampleDocument(...)])`).
5. **Once a duality view is created, disable "New duality view from this table"** on every entity **until the editor is reset** (add a lightweight Reset that clears the working view without re-importing).

**Architecture:** The two context-menu items become complementary, gated on `editingView`: **New duality view from this table** enabled iff `editingView === null`; **Map to document…** enabled iff `editingView !== null` (existing `canMapToDocument`). Both open the same `MapToDocumentModal`; the modal already derives **create-root mode from `editingView === null`** (M.T4 set `root.table` + `_id` from the entity PK) — this change adds: disable +/− in create-root mode, enlarge the modal, and a `resetEditor()` store action + a "Reset view" affordance to re-enable New-view.

**Tech Stack:** unchanged — React 18 + @xyflow/react 12, Zustand 5, Tailwind 3, Vitest+RTL+jsdom, Playwright. No new deps.

---

## Conventions (inherited — do not relitigate)

- Branch/PR per task. Merge `--squash --delete-branch` ONLY when `lint/typecheck/unit/integration/e2e` all `success`; **`container` (Trivy/Docker) failure is the known non-blocking carry-forward; `integration` is real-Oracle and MUST be success.** Then `git checkout main && git pull --ff-only`. Poll CI to completion yourself (`for i in $(seq 1 120); do S=$(gh run list --branch <b> --limit 1 --json status,conclusion --jq '.[0]'); echo "[$i] $S"; echo "$S"|grep -q '"status":"completed"'&&break; sleep 20; done` then `gh run view <id> --json jobs --jq '.jobs[]|"\(.name): \(.conclusion)"'`); never stop at "waiting"; one `gh run rerun <id> --failed` only for an isolated Oracle container-startup flake unrelated to a web-only diff; never merge red; never `--no-verify`.
- Test-pair gate; `apps/web` ≥70/65; production DOM clean (scoped queries, no contortion); a11y preserved. `gh` authed `rhoulihan`, repo `rhoulihan/jrdm`. TDD strictly.
- **HARD GUARDRAIL (Rick, durable):** ERD entities MUST stay draggable on the left canvas to reposition/group (React Flow node-drag, v0.4.2). Do not touch/weaken it or its e2e guard.

## Current state (verified)

`@jrdm/model`: `DualityView { root:{table,permissions,etag}, fields:AnyField[] }`, `fields[0].key==="_id"`; emitters root the doc at `view.root.table` — **no nested-root representation exists** (verification for goal #3). `apps/web/src/diagram/DiagramPane.tsx`: context menu items — "New duality view from this table" currently → `startNewView(table)`; "Map to document…" → `openMapping(table)` disabled unless `canMapToDocument(editingView)` (`apps/web/src/diagram/canMapToDocument.ts` = `editingView!==null`). `apps/web/src/mapping/MapToDocumentModal.tsx` (on `shell/Modal`): when `editingView===null` it builds the entity as the root (M.T4); `MappingTree` shows `+ add node`/`− delete`; Save → `setEditingView(toDualityView(wc))` + `setSampleDocs([sampleDocument(...)])`. Store `apps/web/src/state/store.ts`: `startNewView`, `openMapping/closeMapping/mapping`, `editingView`, `setEditingView`, `selectedFieldPath`, `sampleDocs`, `reset()` (full clear incl. project), ephemeral-slice pattern.

---

## Task Sequencing

| #     | Task                                                                                          | Depends      |
| ----- | --------------------------------------------------------------------------------------------- | ------------ |
| NV.T1 | Store `resetEditor()` + `canCreateNewView` gate (pure)                                        | —            |
| NV.T2 | Modal: enlarge + give right side more space; create-root mode disables +/− and populates root | —            |
| NV.T3 | Context menu: "New view" opens modal + gated on `!editingView`; "Reset view" affordance       | NV.T1, NV.T2 |
| NV.T4 | e2e + docs + container rebuild                                                                | NV.T1-3      |

---

## NV.T1 — `resetEditor()` + `canCreateNewView`

**Files:** `apps/web/src/state/store.ts`(+test); `apps/web/src/diagram/canCreateNewView.ts`(+test).

- [ ] Branch `feat/nv-store`.
- [ ] **`canCreateNewView` — tests first.** Pure `canCreateNewView(editingView: DualityView | null): boolean` → `true` iff `editingView === null` (no view created yet → New-view allowed). Complementary to `canMapToDocument`. Tests: null→true; a valid view→false.
- [ ] **Store — tests first.** Add `resetEditor()`: clears `editingView`, `mapping` (closed), `sampleDocs` (`[]`), `selectedFieldPath` (`null`), and any in-flight authoring/inspector-selection ephemeral state — but **keeps `project`, `relationships`, `connection`, `schemas`, `hiddenEntities`, layout** (so the user does NOT have to re-import to start a new view). `reset()` (full) is unchanged. Tests: after seeding an `editingView`+sampleDocs+mapping, `resetEditor()` clears exactly those and preserves project/relationships/hiddenEntities/layout; `reset()` still clears everything.
- [ ] Implement; `pnpm --filter @jrdm/web test` green; coverage ≥70/65; commit (sources+tests co-staged); PR; poll; merge.

**Self-review:** gate complementary to `canMapToDocument`; `resetEditor` clears working view but preserves the imported project (no re-import needed); `reset()` untouched.

## NV.T2 — Modal sizing + create-root mode

**Files:** `apps/web/src/mapping/MapToDocumentModal.tsx`(+test); possibly `apps/web/src/mapping/MappingTree.tsx`(+test) and `apps/web/src/shell/Modal.tsx`(+test) if sizing is owned there.

- [ ] Branch `feat/nv-modal` off fresh `main` (after NV.T1).
- [ ] **Enlarge the modal.** Increase the modal's overall width/height and re-balance the internal layout so the **right-hand document-tree region gets more space** (e.g. wider right column / give it more flex). If `shell/Modal` constrains size, add an opt-in size prop (`size?: "md"|"lg"` or a max-width/height override) used by `MapToDocumentModal`; keep `Modal`'s a11y (focus trap/Esc/portal) and other modal callers unaffected. Tests: assert the larger sizing class/style is applied; the right region has more relative width than before (assert the layout class/ratio, not a brittle pixel); other `Modal` consumers unchanged.
- [ ] **Create-root mode (editingView === null).** Per the verified fact (duality-view root cannot be nested): when the modal is in create-root mode, **disable the `+ add node` and `− delete` controls** (render them `disabled` with a `title` tooltip like "A duality view's root is the document root — add child tables later via Map to document") and the selected attributes (Map to Path / OK) **populate the document ROOT directly** (the entity is the root; `_id` seeded from its PK; checked columns become root scalar fields). Embed mode (`editingView !== null`) is **unchanged** (+/− enabled, FK embed, locked nodes — full M.T1-T5 behavior). Drive create-root vs embed purely off `editingView === null` (no new flag). Save in BOTH modes writes to the main pane exactly as today (`setEditingView` + `setSampleDocs([sampleDocument(...)])`).
- [ ] **Tests (TDD first):** create-root mode (no `editingView`): `+ add node`/`− delete` are `disabled` (+ tooltip); selecting fields + OK/Save → `editingView` has `root.table === <entity>`, `fields[0] === {_id, <table>.<pk>}`, and the checked columns appear as root scalar fields; `sampleDocs` populated with a real `sampleDocument(...)` (non-tautological — concrete values). Embed mode regression: with an existing `editingView`, +/− still enabled and the M.T4 Save/Cancel + locked-node + FK-embed keystone assertions still pass UNWEAKENED. Modal sizing assertion. Keep all existing mapping tests green.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` green; coverage ≥70/65; commit; PR; poll; merge.

**Self-review:** modal bigger + right side roomier; create-root disables +/− and writes selected cols to the root with `_id` from PK; embed mode fully unchanged (keystones unweakened); Save→main-pane+sample identical to Map-to-document; `shell/Modal` a11y + other callers intact.

## NV.T3 — Context menu: New-view opens modal, gated; Reset affordance

**Files:** `apps/web/src/diagram/DiagramPane.tsx`(+test); possibly a small Reset control in `DiagramPane`/`Toolbar`.

- [ ] Branch `feat/nv-menu` off fresh `main` (after NV.T1+T2).
- [ ] **"New duality view from this table"** → `openMapping(entity)` (open the modal; create-root mode follows from `editingView===null`) **instead of** the direct `startNewView`. **Disabled** (`aria-disabled` + tooltip "Reset the current view to start a new one") when `!canCreateNewView(editingView)` (i.e. a view already exists) — until reset. "Map to document…" stays gated by `canMapToDocument` (unchanged). The two are now complementary (exactly one enabled depending on whether a view exists).
- [ ] **Reset affordance.** Add a clearly-labelled "Reset view" / "Start over" action (a context-menu item OR a Toolbar button — pick the one matching the existing shell patterns; a Toolbar button `data-testid="reset-view"` is the cleaner home) that calls `resetEditor()`, re-enabling "New duality view…". Show it only when `editingView !== null`. (Confirm whether `startNewView` is now unused; if dead and nothing else references it, remove it cleanly + its tests; if still used, leave it.)
- [ ] **Tests (TDD first):** with no `editingView`: "New duality view…" enabled, clicking it calls `openMapping(entity)`; "Map to document…" disabled. After an `editingView` exists: "New duality view…" disabled (`aria-disabled`+tooltip), "Map to document…" enabled; the Reset control is visible and calls `resetEditor()`, after which "New duality view…" is enabled again. **Rick's guardrail: a test asserts React Flow node-drag/reposition still works, unweakened.** Keep all existing DiagramPane/context-menu tests green.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` green; coverage ≥70/65; commit; PR; poll; merge.

**Self-review:** New-view opens the modal and is disabled once a view exists until Reset; Map-to-document complementary; Reset clears the working view (not the import) and re-enables New-view; node-drag guardrail intact; existing menu/gating tests green.

## NV.T4 — e2e + docs + container rebuild

**Files:** `apps/web/src/__tests__/smoke.spec.ts`; `tasks/lessons.md`; `docs/plans/2026-05-15-jrdm-roadmap.md`; `README.md`.

- [ ] Branch `feat/nv-e2e-docs` off fresh `main` (after NV.T1-3).
- [ ] **New/extended e2e** (mock JRDM endpoints only): import a schema → right-click an entity → **"New duality view from this table"** → the **modal opens** → assert in create-root mode the `+ add node`/`− delete` controls are **disabled** → Select fields → OK/Save → main right pane shows the new root document **with sample data** (non-tautological: concrete root key + a `SAMPLE0000`-style sample value + DDL reflects the root) → assert "New duality view…" is now **disabled** on entities → click **Reset view** → assert "New duality view…" is **enabled** again. Keep ALL other scenarios green & unweakened, **including the v0.4.2 node-reposition guard** (do not modify it). Run `pnpm --filter @jrdm/web test:e2e` locally until all pass.
- [ ] **Docs:** `tasks/lessons.md` dated 2026-05-19 entry — duality-view root is always the document root (verified vs model+emitters), so create-root mode disables path-building and writes selected cols to root; New-view & Map-to-document are complementary gates on `editingView`; `resetEditor()` clears the working view without re-import. Roadmap note + README authoring-flow update (right-click → New duality view → modal → pick fields → OK; Reset to start over). Markdown lint-clean (`prettier --write` + `markdownlint-cli2 --fix`).
- [ ] PR; poll; merge. Then rebuild container: `git checkout main && git pull --ff-only && docker compose -f tools/docker/docker-compose.yml build && docker compose -f tools/docker/docker-compose.yml up -d --force-recreate`; `CID=$(docker compose -f tools/docker/docker-compose.yml ps -q jrdm); docker network connect json-sql-guide_default "$CID" 2>/dev/null; until curl -s -m2 -o /dev/null http://localhost:3737/api/health; do sleep 1; done; curl -s -m5 -o /dev/null -w "GET / %{http_code}\n" http://localhost:3737/; docker exec "$CID" node -e 'require("net").connect(1521,"json-sql-guide-oracle").on("connect",()=>{console.log("oracle REACHABLE");process.exit(0)}).on("error",e=>{console.log(e.code);process.exit(1)})'` — report.

**Self-review:** e2e proves New-view→modal(create-root, +/− disabled)→Save→main-pane+sample, the disable-until-reset gate, and Reset re-enabling — all non-tautological; node-reposition guard + all prior guards intact; docs accurate + lint-clean; container live.

---

## Exit / review

Independent opus review on exact merged HEAD: (1) verified-fact correctly applied — create-root mode disables +/− and writes selected cols to the document root; embed mode unchanged & keystones unweakened; (2) New-view opens the modal and is disabled once a view exists until `resetEditor()`, complementary to Map-to-document; Reset clears the working view but NOT the imported project; (3) modal genuinely larger with more right-side space; (4) Save→main-pane+sample identical to Map-to-document and non-tautological; (5) **Rick's node-drag guardrail intact & unweakened**; no other guard (v0.4/v0.4.2/mapping-modal/importer/Phase-0/v0.3b.1-tree-a11y/context-menu) regressed; CI green incl. real-Oracle integration. Then verify the container rebuild is live.
