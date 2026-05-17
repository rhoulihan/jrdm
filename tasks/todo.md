# JRDM — TODO

High-level checkable items. Detailed bite-sized steps live in the per-milestone plan documents in `docs/plans/`.

## Planning

- [x] Product spec (`docs/spec.md`)
- [x] Roadmap (`docs/plans/2026-05-15-jrdm-roadmap.md`)
- [x] v0.1 detailed plan (`docs/plans/2026-05-15-jrdm-v0.1-spike.md`)
- [ ] Rick reviews and approves the roadmap + v0.1 plan ← **NEXT**
- [ ] GitHub repo `oracle/jrdm` created
- [ ] Execution mode chosen: subagent-driven vs inline

## v0.1 — Spike: Foundations + End-to-End Skeleton (Weeks 1–2)

Detailed plan: [`docs/plans/2026-05-15-jrdm-v0.1-spike.md`](../docs/plans/2026-05-15-jrdm-v0.1-spike.md)

- [x] Task 1 — Repo bootstrap (pnpm + Turbo + tsconfig) — `d24177b`
- [x] Task 2 — Lint, Prettier, markdownlint — `62477d4` / `fd5c8f1`
- [x] Task 3 — Husky + lint-staged — `b33c1ff`
- [x] Task 4 — Test-pair pre-commit gate (with tests) — `1b1607b`
- [x] Task 5 — Vitest base config — `4947571`
- [x] Task 6 — CI skeleton (lint + typecheck + unit) — PR #1
- [x] Task 7 — `packages/model`: entity types + Zod — PR #2
- [x] Task 8 — `packages/model`: view types + Zod — PR #3
- [x] Task 9 — `packages/model`: YAML serde — PR #4
- [x] Task 10 — `packages/validator`: PK + duplicate-column rules — PR #5
- [x] Task 11 — `packages/validator`: supported-types contract test — PR #5
- [x] Task 12 — `packages/generator-duality`: minimal SQL/JSON emitter — PR #6
- [x] Task 13 — `packages/generator-duality`: DML annotations — PR #6
- [x] Task 14 — `packages/generator-duality`: golden example test — PR #6
- [x] Task 15 — `apps/server`: Fastify + health — PR #7
- [x] Task 16 — `apps/server`: DDL preview endpoint — PR #7
- [x] Task 17 — `apps/web`: Vite + React scaffold — PR #8
- [x] Task 18 — `apps/web`: Generate DDL UI + Playwright e2e — PR #8
- [x] Task 19 — `packages/exec` stub + deploy route — PR #9
- [x] Task 20 — Testcontainers integration: deploy + sample query against live Oracle 26ai — PR #10
- [x] Task 21 — Docker build + Compose — PR #11
- [x] Task 22 — CI integration + container jobs — PR #12
- [x] Task 23 — Example project (`examples/orders/`) — PR #13
- [x] Task 24 — README + CONTRIBUTING quickstart — PR #13

**v0.1 Definition of Done:**

- [x] CI green; pre-commit gate proven (bypass verified closed at real git level); coverage ≥ 90/85 on `packages/*` (100% on model/validator/generator-duality/exec), ≥ 70/65 on `apps/*` per roadmap. The `/api/deploy` live branch is covered by a real Oracle Testcontainers integration test (green in CI), intentionally not oracledb-mocked unit tests — see `tasks/lessons.md`.
- [x] Docker: `docker compose -f tools/docker/docker-compose.yml up` serves the API at <http://localhost:3737> (UI shell in v0.2)
- [x] End-to-end smoke: YAML → generated DDL → deploy to live Oracle 26ai container → sample query returns document with `_metadata.etag` (verified locally AND in CI integration job)
- [~] Known carry-forward: container/Trivy CI job non-blocking pending dep-hygiene pass (tracked in `tasks/lessons.md`, scheduled v0.2)

## v0.2 — ERD Designer + Oracle Importer (Weeks 3–4)

### v0.2a — Model relationships + Oracle importer (headless) — DONE

- [x] I3 fix — drop invalid `ifNotExists` createMode
- [x] Model — ForeignKey, Relationship, deriveRelationships, Project + serde
- [x] Validator — honest rules + validateRelationships/validateProject (closes I2)
- [x] `@jrdm/importer-oracle` — dictionary SQL, mapRowsToEntities, classifyCardinality, importSchema
- [x] Importer Testcontainers integration (live Oracle reverse-engineering)
- [x] Server — `POST /api/import/oracle` + unit + integration tests
- [x] CI — importer-oracle integration test enforced

### v0.2b — React Flow ERD canvas + inspector + connection UI — DONE

- [x] Hardening — DraftProject type (v0.2a review #1)
- [x] Hardening — loud UNMAPPED_TYPE warning (v0.2a review #2)
- [x] Web Vitest + RTL + jsdom harness (web joins unit CI job)
- [x] Tailwind + Redwood-leaning theme tokens
- [x] Zustand store
- [x] Typed importOracle API client
- [x] ConnectionForm + useImport hook
- [x] projectToGraph + DiagramPane + EntityNode + RelationshipEdge
- [x] Inspector + IssuesPanel
- [x] App shell composition
- [x] Golden-path Playwright e2e (API mocked)
- [x] 50-entity layout perf guard

### v0.3 — Document Editor + GraphQL Emitter (Weeks 5–6) — DONE

## v0.3 — Document Editor + GraphQL Emitter (Weeks 5–6)

### v0.3a — Nested + GraphQL duality emitter (headless) — DONE

- [x] M1 fix — collision-safe AliasContext
- [x] emit-sql-json on AliasContext + recursive walk
- [x] SQL/JSON nested object/unnest (1:1) + MissingLinkError
- [x] SQL/JSON nested arrays (1:N) incl. array-of-object
- [x] SQL/JSON root etag + replication clause
- [x] SQL/JSON golden fixtures (departments_dv, employee_dv)
- [x] GraphQL emitter (root/scalars/nested/@link/anns)
- [x] GraphQL golden fixtures
- [x] fast-check dual-syntax round-trip equivalence (10k, root-etag + M1 repeated-table genuinely covered — v0.3a hardening)
- [x] validator validateDualityView rules
- [x] /api/ddl/preview syntax selector (sql|graphql) + 422
- [x] generator emit perf guard

### v0.3b — Document editor UI + DDL pane toggle — DONE

- [x] IssuesPanel.focus carried-debt cleanup
- [x] Store duality-view authoring state
- [x] fetchDdlPreview client + useDdlPreview hook
- [x] documentModel pure tree ops
- [x] FieldNode + DocumentTree
- [x] Native drag-drop: EntityNode columns → DocumentTree
- [x] FieldInspector + ViewInspector
- [x] SyntaxToggle + DdlPane
- [x] ERD/Design mode shell + ContextInspector
- [x] Authoring golden-path e2e
- [x] DDL-pane perf guard

### v0.4 — Live Oracle Preview + ETag Round-Trip (Weeks 7–8) — NEXT

## v0.4 — Live Oracle Preview + ETag Round-Trip (Weeks 7–8)

- [ ] Draft v0.4 plan
- [ ] Rick reviews
- [ ] Execute
- [ ] v0.4 DoD: single-click deploy + sample + edit + conflict demo all working; one-button teardown

## v0.5 — MongoDB Inference + Suggested Duality View (Weeks 9–10)

- [ ] Draft v0.5 plan
- [ ] Rick reviews
- [ ] Execute
- [ ] v0.5 DoD: Mongo → ERD + candidate view in ≤ 30s on seed dataset; inference review UI accepts/rejects per entity/FK/field

## v0.6 — Migrations + ORDS + Redwood Theme (Weeks 11–12)

- [ ] Draft v0.6 plan
- [ ] Rick reviews
- [ ] Execute
- [ ] v0.6 DoD: Liquibase + Flyway migrations deploy cleanly; ORDS DDL + OpenAPI spec validate; zero axe-core violations; perf budget met

## v1.0 — Demo Polish + Docs Site + Release (Week 13)

- [ ] Draft v1.0 plan
- [ ] Rick reviews
- [ ] Execute
- [ ] v1.0 DoD: 7-minute demo runs end-to-end recorded; docs site live; signed artifacts published (container + Linux/macOS/Windows binaries)

## Lessons & Self-Improvement

- [ ] `tasks/lessons.md` reviewed at the end of every milestone
- [ ] Recurring patterns codified into pre-commit checks or lint rules
- [ ] No `--no-verify` commits without a lessons entry
