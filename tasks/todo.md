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

- [ ] Task 1 — Repo bootstrap (pnpm + Turbo + tsconfig)
- [ ] Task 2 — Lint, Prettier, markdownlint
- [ ] Task 3 — Husky + lint-staged
- [ ] Task 4 — Test-pair pre-commit gate (with tests)
- [ ] Task 5 — Vitest base config
- [ ] Task 6 — CI skeleton (lint + typecheck + unit)
- [ ] Task 7 — `packages/model`: entity types + Zod
- [ ] Task 8 — `packages/model`: view types + Zod
- [ ] Task 9 — `packages/model`: YAML serde
- [ ] Task 10 — `packages/validator`: PK + duplicate-column rules
- [ ] Task 11 — `packages/validator`: supported-types contract test
- [ ] Task 12 — `packages/generator-duality`: minimal SQL/JSON emitter
- [ ] Task 13 — `packages/generator-duality`: DML annotations
- [ ] Task 14 — `packages/generator-duality`: golden example test
- [ ] Task 15 — `apps/server`: Fastify + health
- [ ] Task 16 — `apps/server`: DDL preview endpoint
- [ ] Task 17 — `apps/web`: Vite + React scaffold
- [ ] Task 18 — `apps/web`: Generate DDL UI + Playwright e2e
- [ ] Task 19 — `packages/exec` stub + deploy route
- [ ] Task 20 — Testcontainers integration: deploy + sample query against live Oracle 26ai
- [ ] Task 21 — Docker build + Compose
- [ ] Task 22 — CI integration + container jobs
- [ ] Task 23 — Example project (`examples/orders/`)
- [ ] Task 24 — README + CONTRIBUTING quickstart

**v0.1 Definition of Done:**

- [ ] CI green; pre-commit gate proven; coverage ≥ 90/85 on packages
- [ ] `docker compose up` opens working JRDM at <http://localhost:3737>
- [ ] End-to-end smoke: edit YAML → see generated DDL → deploy to Oracle container → sample query returns document with `_metadata.etag`

## v0.2 — ERD Designer + Oracle Importer (Weeks 3–4)

- [ ] Draft `docs/plans/<date>-jrdm-v0.2-erd-and-importer.md`
- [ ] Rick reviews v0.2 plan
- [ ] Execute v0.2 tasks (TBD in plan)
- [ ] v0.2 DoD: ERD canvas usable, Oracle reverse-engineering of 50-table fixture in ≤ 5s

## v0.3 — Document Editor + GraphQL Emitter (Weeks 5–6)

- [ ] Draft v0.3 plan
- [ ] Rick reviews
- [ ] Execute
- [ ] v0.3 DoD: every duality view annotation exposed in UI; GraphQL ⇄ SQL/JSON round-trip property test green; DDL regen ≤ 50ms p99 on 200-entity project

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
