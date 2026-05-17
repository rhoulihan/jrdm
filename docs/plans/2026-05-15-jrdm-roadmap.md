# JRDM Implementation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement the per-milestone plans this roadmap references. The roadmap itself is the navigation map; bite-sized TDD tasks live in the per-milestone plan documents.

**Goal:** Ship JRDM v1.0 — a visual, point-and-click designer for Oracle JSON Relational Duality Views, deployable as a Docker Compose service or single-binary launcher — within 13 weeks.

**Architecture:** Node.js + React monorepo (pnpm workspaces, Turborepo). Canonical project IR drives N independent generators; importers convert external schemas (Oracle, MongoDB, files) into the same IR. UI is a four-pane SSMS-inspired workspace built on React Flow + Monaco. Project state persists as git-friendly YAML on the filesystem.

**Tech Stack:** Node 22 LTS, Fastify, React 18, TypeScript, React Flow, Monaco, Zustand, Tailwind, Vitest, Playwright, Testcontainers, node-oracledb, mongodb driver, Docker Compose, GitHub Actions.

**Companion docs:**

- Product spec: [`docs/spec.md`](../spec.md)
- v0.1 detailed plan: [`docs/plans/2026-05-15-jrdm-v0.1-spike.md`](./2026-05-15-jrdm-v0.1-spike.md)
- v0.2 – v1.0 detailed plans: written when we approach each milestone

---

## How to Read This Roadmap

This document gives the **shape** of the work, not the bite-sized steps. Each milestone section specifies:

- **Goal** — one sentence describing what the milestone produces.
- **Packages touched** — every monorepo package created or modified.
- **Files** — file-level scope, not exhaustive but specific enough to estimate effort.
- **Acceptance criteria** — the tests and demos that must pass to call the milestone done.
- **Dependencies** — prior milestones or external resources required before starting.
- **Subagent strategy** — how to parallelize within the milestone.
- **Demo capability gained** — what we can show stakeholders at the end of this milestone.

When you start a milestone, draft its detailed bite-sized plan (`docs/plans/YYYY-MM-DD-jrdm-vX.Y-<name>.md`) by following the structure of the v0.1 plan. Use the writing-plans skill.

---

## Repository Conventions

These hold for every milestone.

### Monorepo Layout

```text
jrdm/
├── .github/
│   └── workflows/             # CI pipelines (one file per stage group)
├── apps/
│   ├── web/                   # React SPA — UI
│   └── server/                # Fastify HTTP + WebSocket service
├── packages/
│   ├── model/                 # Canonical IR, YAML serde, Zod schemas
│   ├── generator-duality/     # Duality view DDL emitters (GraphQL + SQL/JSON)
│   ├── generator-jct/         # JSON Collection Table emitter
│   ├── generator-migrate/     # Liquibase + Flyway emitters
│   ├── generator-ords/        # ORDS DDL + OpenAPI emitter
│   ├── generator-ts/          # TypeScript types emitter
│   ├── importer-oracle/       # Live Oracle reverse-engineering
│   ├── importer-mongo/        # $jsonSchema + sample-based inference
│   ├── importer-files/        # DBML / Hackolade / SQL DDL parsers
│   ├── validator/             # Lint rules over the IR
│   ├── exec/                  # Live deploy + sample query + ETag round-trip
│   └── theme/                 # Redwood-derived design tokens
├── tools/
│   ├── launcher/              # Single-binary packager
│   └── docker/                # Compose + Dockerfiles
├── docs/                      # Spec + plans (this directory)
└── tasks/                     # Active TODO list
```

### TDD Discipline

- **Pre-commit gate** (custom hook in `.husky/pre-commit`): any staged file under `packages/*/src` or `apps/*/src` must have a corresponding modified `*.test.ts` or `*.spec.ts` in the same commit; otherwise the commit is blocked with a clear message. Bypass requires `--no-verify` and is logged in `tasks/lessons.md` if used.
- **Red-green-refactor**: every task in every plan follows write-test → run-fail → implement → run-pass → commit. No exceptions.
- **No mocks for external systems**: Oracle and MongoDB tests use Testcontainers (Oracle Database Free 26ai image, official MongoDB image). Unit tests for the IR and generators are pure-function and don't touch I/O.
- **Coverage gates** enforced in CI: 90% line / 85% branch on `packages/*`, 70% on `apps/*`. Coverage drop fails the build.
- **Property-based testing**: dual-syntax duality view emitters round-trip via `fast-check` — random IR → emit GraphQL → parse → emit SQL/JSON → parse → assert IR equivalence.

### CI/CD Pipeline

A single GitHub Actions workflow file (`.github/workflows/ci.yml`) defines the pipeline; matrix jobs and reusable workflows split it for parallelism.

| Stage          | Trigger       | Tool                                          | Blocks merge? |
| -------------- | ------------- | --------------------------------------------- | ------------- |
| Lint           | PR + push     | ESLint, Prettier, markdownlint                | yes           |
| Typecheck      | PR + push     | `tsc --noEmit` per package                    | yes           |
| Unit           | PR + push     | Vitest, per package, parallel                 | yes           |
| Integration    | PR + push     | Vitest + Testcontainers (Oracle 26ai + Mongo) | yes           |
| UI e2e         | PR + push     | Playwright (Chromium, Firefox, WebKit)        | yes           |
| Build          | PR + push     | `turbo build` + `vite build` + server bundle  | yes           |
| Single-binary  | PR + push     | Bun compile or `pkg` per OS target            | yes           |
| Container      | PR + push     | Docker build + Trivy scan                     | yes           |
| Sign + publish | Tag `v*` only | cosign, GHCR, GH releases                     | n/a           |

PR previews: each PR builds a container and posts a comment with a short-lived preview URL backed by a per-PR Oracle Database Free schema. Cleaned up on PR close.

### Branching & Commits

- Trunk-based on `main`. Feature branches short-lived (≤ 3 days).
- Conventional commits (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`).
- One PR per task or per small task cluster. PRs squash-merge by default.
- Every commit must have green pre-commit hooks; CI is the second line of defense.

### Subagent Strategy (cross-cutting)

Per global rules ("Use subagents liberally to keep main context clean"):

- **Implementation tasks** → `general-purpose` subagent with the bite-sized plan section pasted in. One task = one subagent.
- **Codebase exploration** ("where is X defined") → `Explore` subagent.
- **Architecture decisions on a new subsystem** → `feature-dev:code-architect` subagent.
- **Independent parallel tasks** (e.g., two emitters in different packages) → dispatch multiple subagents in a single message.
- **Code review before merge** → `feature-dev:code-reviewer` subagent on the branch diff.

The main session orchestrates: pick the next task, dispatch, review the diff, mark done, pick the next.

---

## Cross-Cutting Acceptance Criteria

These hold for every milestone and are checked at the end of each:

- [ ] All new code has tests written **before** the implementation (commit history shows test commit preceding implementation commit, or paired in the same commit).
- [ ] Coverage gates green on `packages/*`.
- [ ] No new lint or typecheck warnings.
- [ ] CI green on every commit on `main`.
- [ ] No mocks for Oracle or MongoDB anywhere in the test suite.
- [ ] Pre-commit hook blocks committing source without a test pair (verified by attempting to bypass without `--no-verify`).
- [ ] Demo script updated to include any new capability.

---

## Milestone Schedule (13 Weeks)

| #    | Milestone                                  | Weeks | Detailed plan                                |
| ---- | ------------------------------------------ | ----- | -------------------------------------------- |
| v0.1 | Spike: foundations + end-to-end skeleton   | 1–2   | [v0.1 plan](./2026-05-15-jrdm-v0.1-spike.md) |
| v0.2 | ERD Designer + Oracle Importer             | 3–4   | written at v0.1 close                        |
| v0.3 | Document Editor + GraphQL Emitter          | 5–6   | written at v0.2 close                        |
| v0.4 | Live Oracle Preview + ETag round-trip      | 7–8   | written at v0.3 close                        |
| v0.5 | MongoDB Inference + suggested duality view | 9–10  | written at v0.4 close                        |
| v0.6 | Migrations + ORDS + Redwood theme          | 11–12 | written at v0.5 close                        |
| v1.0 | Demo polish + docs site + release          | 13    | written at v0.6 close                        |

---

## v0.1 — Spike: Foundations + End-to-End Skeleton (Weeks 1–2)

**Goal:** Stand up the full monorepo skeleton with TDD discipline, CI/CD, and one working end-to-end path: define a trivial ERD in code, generate one trivial duality view, render it in the React app, and deploy it against an Oracle 26ai Testcontainer.

**Detailed plan:** [`docs/plans/2026-05-15-jrdm-v0.1-spike.md`](./2026-05-15-jrdm-v0.1-spike.md)

**Demo capability gained:** "Here's the skeleton. The pipeline is green; the gates are real; CI deploys a generated duality view to a live Oracle and runs a sample query. Now we hang features off this." This is the foundation everything else builds on.

---

## v0.2 — ERD Designer + Oracle Importer (Weeks 3–4)

**Goal:** Users can draw entities, columns, PK/UK/FK relationships visually in a React Flow canvas, and reverse-engineer an existing Oracle schema into that canvas.

**Packages touched (created or modified):**

- `packages/model` — extend IR to cover all ERD constructs (constraints, indexes, virtual columns).
- `packages/importer-oracle` — NEW. Live Oracle reverse engineering.
- `packages/validator` — entity-level lint rules (PK/UK required for duality view root, supported types only).
- `apps/web` — diagram pane component, entity inspector, connection management UI.
- `apps/server` — `/api/import/oracle` endpoint; SSE stream for import progress.

**Files (selected, not exhaustive):**

- `packages/model/src/types/entity.ts`, `relationship.ts`, `constraint.ts`, `index.ts`
- `packages/model/src/yaml/serde.ts` extended for new types
- `packages/importer-oracle/src/connect.ts` — connection pool management
- `packages/importer-oracle/src/introspect.ts` — `USER_TABLES`/`USER_TAB_COLUMNS`/`USER_CONS_COLUMNS` queries
- `packages/importer-oracle/src/cardinality.ts` — 1:1 vs 1:N inference from unique constraints
- `apps/web/src/diagram/EntityNode.tsx`, `RelationshipEdge.tsx`, `DiagramPane.tsx`
- `apps/web/src/inspector/EntityInspector.tsx`, `ColumnInspector.tsx`
- `apps/web/src/connections/ConnectionList.tsx`, `OracleConnectForm.tsx`

**Acceptance criteria:**

- [ ] User can create a new entity by clicking the canvas, name it, add columns with all Oracle types, save to YAML.
- [ ] User can draw a relationship by dragging from one entity to another; cardinality picker appears; resulting YAML round-trips through the validator.
- [ ] User can connect to a live Oracle instance (Testcontainer in CI), select a schema, and have all tables + relationships rendered on the canvas with positions deterministic enough for golden-file testing.
- [ ] Validator surfaces all five v1 lint rules with clear inspector messages.
- [ ] Reverse-engineering an Oracle schema with 50 tables completes in under 5 seconds against the test fixture.

**Dependencies:** v0.1 complete; Oracle Database Free 26ai Testcontainer image available in CI.

**Subagent strategy:** Three parallel tracks:

1. Model + validator extensions (one subagent).
2. Oracle importer package (one subagent).
3. Diagram pane + inspector (one subagent, but split entity/column inspectors into separate sub-tasks).
   Synchronize at the end of week 3 on the IR contract; week 4 is integration.

**Risks:**

- React Flow performance with large schemas — benchmark with a 500-entity fixture early.
- Oracle 26ai constraint metadata exposed differently in `USER_*` vs `ALL_*` views — pin to `USER_*` for the user-owned schema, document the limitation.

> Carry-forward cleared in v0.2a: I3 (`ifNotExists` invalid DDL) removed; I2 (validator test-theater) replaced with real relationship/project rules.
>
> v0.2b complete: visual ERD designer (React Flow) over the v0.2a importer. v0.2a milestone-review Important items closed — DraftProject type (no more Project over-promise on PK-less import) and loud UNMAPPED_TYPE warning (no more silent VARCHAR2 fallback). @jrdm/web now has a real Vitest+RTL unit suite in the CI `unit` job; the import golden path is covered by an API-mocked Playwright e2e (the real Oracle path stays covered by the server integration test).

---

## v0.3 — Document Editor + GraphQL Emitter (Weeks 5–6)

**Goal:** Users can build a JSON document template alongside the ERD, drag entity columns onto document fields, configure every duality view annotation, and see live-generated DDL in both GraphQL and SQL/JSON forms.

**Packages touched:**

- `packages/model` — duality view IR (document tree, field bindings, annotation map).
- `packages/generator-duality` — NEW. GraphQL and SQL/JSON emitters.
- `packages/validator` — duality-view-level rules (composite `_id` columns NOT NULL, no orphan junctions, etc.).
- `apps/web` — document tree component, drag-drop binding, annotation inspector, DDL pane with syntax toggle.

**Files (selected):**

- `packages/model/src/types/dualityView.ts`, `documentNode.ts`, `fieldBinding.ts`
- `packages/generator-duality/src/ir.ts` — canonical-IR-to-emitter-IR transform
- `packages/generator-duality/src/emit-graphql.ts`
- `packages/generator-duality/src/emit-sql-json.ts`
- `packages/generator-duality/src/__golden__/` — golden DDL fixtures matched by the property-based round-trip tests
- `apps/web/src/document/DocumentTree.tsx`, `FieldNode.tsx`, `ArrayNode.tsx`
- `apps/web/src/inspector/FieldInspector.tsx`, `TableAnnotationInspector.tsx`, `ViewInspector.tsx`
- `apps/web/src/ddl/DdlPane.tsx`, `SyntaxToggle.tsx`

**Acceptance criteria:**

- [ ] User can build a duality view from an existing ERD entirely via drag-drop: drag an entity onto the document root, drag related entities onto array/unnest slots, configure DML and ETag per the inspector.
- [ ] Every duality view annotation listed in Spec §7 has a UI control that produces the corresponding DDL.
- [ ] DDL pane updates in ≤ 50ms p99 on a 200-entity project (measured benchmark in CI).
- [ ] GraphQL ⇄ SQL/JSON toggle produces equivalent DDL; round-trip property test passes 10k random IRs.
- [ ] Golden DDL fixtures match Oracle's documented examples (departments_dv, race_dv, driver_dv, team_dv from oracle-samples).

**Dependencies:** v0.2 complete; ERD canvas stable.

**Subagent strategy:** Two parallel tracks:

1. `packages/generator-duality` (heavy pure-function work; well-suited to TDD subagent).
2. `apps/web` document + inspector + DDL pane (interactive; needs UI-test subagent).
   Validator updates folded into either track depending on what's blocking.

**Risks:**

- GraphQL grammar edge cases (Oracle's subset) — start by implementing only the documented subset; gate broader support on user demand.
- Drag-drop state model can get hairy — settle on Zustand stores per pane with a single "selection" store coordinating across panes.

> v0.3a complete: dual-syntax (SQL/JSON + GraphQL) duality-view emitter with full nested emission, collision-safe aliasing (closes carried-debt M1), fast-check 10k round-trip equivalence, validator duality-view rules, and a syntax-selectable /api/ddl/preview. v0.3b (document-tree drag-drop editor + DDL pane toggle) is next.
>
> v0.3b complete: browser duality-view authoring — drag entity columns into a document-tree, edit every annotation via Field/View inspectors, live DDL pane toggling SQL/JSON ⇄ GraphQL over the v0.3a engine. Closes the v0.2b-review IssuesPanel.focus carried debt. v0.3 (Document Editor + GraphQL Emitter) is fully delivered (v0.3a engine + v0.3b UI). I3 (asymmetric join columns) remains deferred to v0.4 — live deploy must split NestedField.link into from/to before joins are correct against real FKs.
>
> v0.3b.1 closes the v0.3b milestone-review findings: nested authoring is now reachable (DocumentTree `+ object/unnest/array` toolbar targeting the selected nested field; FieldNode is a drop target so columns drop into nested fields) and the document tree has real a11y (`role=tree/treeitem`, `aria-selected/expanded`, ArrowUp/Down keyboard selection). v0.3 (Document Editor + GraphQL Emitter) is now genuinely complete — the editor can author the full JSON document hierarchy the duality engine emits. Known minor follow-ups tracked in lessons (duplicate-column dedup; cross-pane ERD↔doc drag UX). I3 (asymmetric join columns) remains v0.4.

---

## v0.4 — Live Oracle Preview + ETag Round-Trip (Weeks 7–8)

**Goal:** Users can deploy a generated duality view to a connected Oracle instance, run a sample query, edit a document in the UI, and watch the ETag round-trip succeed or conflict — all without leaving the tool.

**Packages touched:**

- `packages/exec` — NEW. Deployment, sample-query, document-edit, conflict-test routines.
- `apps/server` — `/api/deploy`, `/api/sample`, `/api/document/*` endpoints; SSE for deploy progress.
- `apps/web` — deploy dialog, results pane, document-edit modal, conflict-resolution UI.

**Files (selected):**

- `packages/exec/src/sandbox.ts` — per-project schema management (`CREATE USER JRDM_PROJ_<id>`, grants, teardown).
- `packages/exec/src/deploy.ts` — DDL execution with transactional pre-flight checks.
- `packages/exec/src/sample.ts` — `JSON_SERIALIZE(...PRETTY)` query, result paging.
- `packages/exec/src/edit.ts` — `UPDATE view SET data = ... WHERE data."_id" = ...` with ETag.
- `packages/exec/src/conflict.ts` — deliberate conflict simulator for the demo.
- `apps/web/src/preview/DeployDialog.tsx`, `ResultsPane.tsx`, `DocumentEditModal.tsx`, `ConflictBanner.tsx`

**Acceptance criteria:**

- [ ] Single-click deploy from the UI: target schema is created (or reused), DDL runs in a transaction, success/failure surfaces in the deploy dialog.
- [ ] Sample query returns up to 5 prettified documents, rendered as a JSON tree in the results pane.
- [ ] User can edit a field in a returned document, save, and observe the new ETag in the UI; subsequent read shows the new value.
- [ ] Conflict demo: two tabs both edit the same document; second save fails with `ORA-42699`; UI surfaces ETag mismatch clearly.
- [ ] Teardown is one button; verified that no orphaned schemas remain after a demo cycle.

**Dependencies:** v0.3 complete; reliable `node-oracledb` connection management; per-PR Oracle instance in CI for integration tests.

**Subagent strategy:** Two parallel tracks (exec backend; preview UI) plus a third subagent owning the demo-script update.

**Risks:**

- Sandbox schema name collisions across concurrent sessions — use UUID-suffixed schemas, document the cleanup cron.
- `node-oracledb` thin vs thick — start thin; document precisely which v1 features force thick (likely none for v0.4).

> v0.4 complete: live Oracle deploy, sample, ETag edit, conflict demo, and idempotent sandbox teardown all integration-verified (Tasks 1–16, PRs #89–#104). Single-click deploy surfaces success/error in the UI; sample returns ≤5 prettified JSON documents rendered as a collapsible tree; editing a field and saving rounds-trips the new ETag visibly; a deliberate stale write raises ORA-42699 and the ConflictBanner surfaces the mismatch; teardown is one button and leaves no orphaned schemas (verified via `all_users` assertion in integration). **I3 carried debt closed**: `NestedField.link` is now asymmetric `{ from, to }` — real FKs with differently-named parent/child columns join correctly, and the 10k round-trip property now genuinely exercises distinct from/to names (the arbitrary generates equal-length but usually different column name arrays). SSE for deploy progress was deliberately out of scope (synchronous JSON met every DoD — YAGNI). Oracle Free tablespace lesson: `GRANT UNLIMITED TABLESPACE` is required instead of `ALTER USER … QUOTA UNLIMITED ON USERS` (no `USERS` tablespace in FREEPDB1). Next: v0.5 MongoDB inference + suggested duality view.

---

## v0.5 — MongoDB Inference + Suggested Duality View (Weeks 9–10)

**Goal:** Users can connect to a MongoDB cluster, scan one or more collections, and have JRDM infer an ERD plus a candidate duality view that reproduces the document shape — backed by Oracle relational tables.

**Packages touched:**

- `packages/importer-mongo` — NEW. `$jsonSchema` reader + sample-based inferrer + reference-detection heuristics + duality-view suggestion engine.
- `packages/model` — minor extensions (provenance metadata: "this entity was inferred from collection X").
- `apps/server` — `/api/import/mongo` endpoint with SSE progress.
- `apps/web` — Mongo connection form, scan-progress UI, inference-review screen (accept/reject per inferred entity, FK, view).

**Files (selected):**

- `packages/importer-mongo/src/connect.ts` — URI parsing, auth modes (X.509, AWS, OIDC).
- `packages/importer-mongo/src/schema.ts` — `$jsonSchema` reader.
- `packages/importer-mongo/src/sample.ts` — `$sample` aggregation, configurable N.
- `packages/importer-mongo/src/infer-types.ts` — frequency-based type detection with union resolution.
- `packages/importer-mongo/src/infer-refs.ts` — ObjectId, naming-convention, and value-overlap heuristics.
- `packages/importer-mongo/src/infer-denorm.ts` — sub-object shape matching against top-level collections.
- `packages/importer-mongo/src/suggest-view.ts` — candidate duality view from dominant document shape.
- `apps/web/src/import-mongo/ScanProgress.tsx`, `InferenceReview.tsx`, `AcceptRejectPanel.tsx`

**Acceptance criteria:**

- [ ] Connect to a live MongoDB Testcontainer with the sample `restaurants` and `orders` datasets; produce a non-trivial ERD and at least one candidate duality view in under 30 seconds for the seed dataset.
- [ ] Inference review screen lets the user accept/reject each inferred entity, relationship, and field; rejections are preserved on re-scan so they're not re-proposed.
- [ ] Property test: for any document-shaped IR, encoding → decoding via the inferrer round-trips (where "round-trip" is defined per the suggestion engine's deterministic mapping).
- [ ] Demo script update: the Mongo-inference flow lands in 3 minutes including a deploy to Oracle.

**Dependencies:** v0.4 complete; the deploy path works (so we can land the demo at the end of the Mongo flow).

**Subagent strategy:** Three parallel tracks given the inference complexity:

1. `connect.ts` + `schema.ts` (straightforward, fast).
2. `sample.ts` + `infer-types.ts` + `infer-refs.ts` + `infer-denorm.ts` (the inference core; one subagent owns this end-to-end for cohesion).
3. UI review flow (one subagent).

**Risks:**

- Sample-based inference on polymorphic collections — surface unions explicitly, let the user resolve, never silently drop data.
- The "suggested duality view" is a heuristic; demo it as a starting point, not a final answer.

---

## v0.6 — Migrations + ORDS + Redwood Theme (Weeks 11–12)

**Goal:** Generated artifacts include Liquibase/Flyway migrations and ORDS REST endpoints with OpenAPI specs. UI gets a Redwood-faithful theming pass.

**Packages touched:**

- `packages/generator-migrate` — NEW. Liquibase XML/YAML + Flyway SQL emitters.
- `packages/generator-ords` — NEW. ORDS DDL + OpenAPI 3.1 emitter.
- `packages/generator-ts` — NEW. TypeScript types emitter.
- `packages/theme` — NEW. Redwood-derived design tokens (color, type, spacing, motion).
- `apps/web` — theme application across every component; accessibility audit.

**Files (selected):**

- `packages/generator-migrate/src/liquibase.ts`, `flyway.ts`, `diff.ts`
- `packages/generator-ords/src/ords-ddl.ts`, `openapi.ts`
- `packages/generator-ts/src/emit.ts`
- `packages/theme/src/tokens.css`, `tailwind-preset.ts`
- `apps/web/src/theme/*` — top bar, rails, dock, command palette polish

**Acceptance criteria:**

- [ ] Generated Liquibase changeset deploys cleanly to a fresh Oracle Free instance; Flyway equivalents do the same.
- [ ] Generated ORDS DDL enables the duality view as a REST resource; OpenAPI spec validates against Spectral.
- [ ] Generated TypeScript types compile under `tsc --strict` against a generated client that exercises the OpenAPI spec.
- [ ] axe-core reports zero violations on main flows.
- [ ] Lighthouse perf budget: UI ≤ 1.2 MB gzip first paint; LCP ≤ 2.5 s on local Docker.
- [ ] Visual regression suite (Playwright + screenshots) covers the four panes across light theme + compact density.

**Dependencies:** v0.5 complete; generator IR stable enough that adding emitters is additive.

**Subagent strategy:** Four parallel tracks (one per new package) plus a fifth owning the theme application + accessibility sweep.

**Risks:**

- Liquibase XML schema versions drift — pin to Liquibase 4.x XSD; document the version.
- ORDS DDL syntax varies between ADB and on-prem — emit the ADB-compatible form; document on-prem caveats.

---

## v1.0 — Demo Polish + Documentation Site + Release (Week 13)

**Goal:** JRDM is demo-ready, documented, and released. The 7-minute demo script runs end-to-end without manual intervention.

**Packages touched:**

- `tools/launcher` — single-binary builds for Linux x64, macOS arm64, Windows x64.
- `tools/docker` — Compose file + Dockerfile + multi-stage build.
- `apps/web` — onboarding tutorial, command palette polish, error states, empty states.
- `docs/` — full user docs site (Docusaurus), API docs, contribution guide.

**Files (selected):**

- `tools/launcher/build.ts` — Bun compile / pkg pipeline per OS.
- `tools/docker/Dockerfile`, `docker-compose.yml`
- `docs/site/` — Docusaurus project, all user-facing docs.
- `.github/workflows/release.yml` — tag-triggered release pipeline with signing.

**Acceptance criteria:**

- [ ] Demo script v1 runs end-to-end in ≤ 7 minutes with zero manual intervention; recorded video committed to repo.
- [ ] Docs site live at `jrdm.oracle.com` (or interim URL) with quickstart, full feature reference, API reference, examples gallery.
- [ ] Three release artifacts published to GHCR + GH Releases: container image, Linux binary, macOS binary, Windows binary; signatures verifiable with cosign.
- [ ] One-command quickstart works on a fresh machine: `docker run -p 3737:3737 ghcr.io/oracle/jrdm:1.0` opens a working JRDM in the browser.
- [ ] Onboarding tutorial (first-launch overlay) covers the four panes in under 90 seconds.

**Dependencies:** v0.6 complete; demo connection (live Oracle ADB) provisioned for the actual demo day.

**Subagent strategy:** Three parallel tracks (launcher/docker; docs site; UI polish + tutorial).

**Risks:**

- Single-binary on Windows often has antivirus quirks — test on a clean Windows VM well before demo day.
- Docs site scope creep — fix the v1 doc set in writing before starting; defer anything not on that list to v1.1.

---

## Definition of Done — Whole Project

JRDM v1.0 ships when every box below is checked. This is the master gate.

### Functional

- [ ] All milestone acceptance criteria green.
- [ ] Demo script runs end-to-end in ≤ 7 minutes, recorded.
- [ ] Generated duality view DDL accepted by Oracle 26ai for every documented example pattern (nested arrays, UNNEST, junction-table N:M, composite `_id`, computed fields, flex columns).
- [ ] Importers correctly handle the seed test fixtures (50-table Oracle schema, 10-collection Mongo sample dataset).

### Quality

- [ ] CI green on `main`; no flakes in the integration suite over the last 50 runs.
- [ ] Coverage ≥ 90/85 on `packages/*`, ≥ 70 on `apps/*`.
- [ ] No critical or high CVEs (Trivy).
- [ ] Zero axe-core violations on main flows.
- [ ] Performance budget met (DDL regen ≤ 50ms p99, UI bundle ≤ 1.2 MB gzip).

### Release

- [ ] Tagged `v1.0.0`; release notes published.
- [ ] Container image signed (cosign) and published.
- [ ] Single-binary artifacts published for Linux x64, macOS arm64, Windows x64.
- [ ] Docs site live with quickstart + feature reference + examples gallery.

### Process

- [ ] `tasks/lessons.md` reviewed at the end of every milestone; recurring patterns codified into pre-commit checks or lint rules where possible.
- [ ] No `--no-verify` commits in the project history without a corresponding lessons entry.

---

## Open Decisions Tracked

These are deferred from the spec for the working team to resolve, with my recommendation:

1. **Project file format — YAML vs TOML.** _Rec: YAML._ Revisit if anchor/alias misuse causes review friction.
2. **GraphQL parser.** _Rec: write our own minimal parser bounded to the duality view subset._ Pulls in less dependency risk than a full GraphQL parser; spec the subset precisely in v0.3.
3. **License.** **Decided: MIT** (Rick, 2026-05-15). Maximally permissive for community contribution.
4. **Telemetry.** _Rec: design the hook in v0.6, ship off in v1.0; flip on opt-in in v1.1._
5. **Plugin API for custom generators.** _Rec: defer to v2._ Build generators behind a stable contract anyway so the door stays open.
