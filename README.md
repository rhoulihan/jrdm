# JRDM — JSON Relational Duality Mapper

Visual designer for Oracle JSON Relational Duality Views. Connect to an Oracle schema, reverse-engineer it into an ERD, author a JSON document template with nested fields and asymmetric join columns, generate dual-syntax DDL (SQL/JSON and GraphQL), and deploy live — with sample queries, ETag-guarded document edits, and a conflict demo — all from the UI.

## Quick Start

```sh
docker compose -f tools/docker/docker-compose.yml up
```

Open <http://localhost:3737/api/health> to verify the API is running, then open <http://localhost:3737> in a browser for the visual designer.

For local development without Docker:

```sh
pnpm install
pnpm build
# In one terminal:
pnpm --filter @jrdm/server dev      # API on :3737
# In another:
pnpm --filter @jrdm/web dev         # UI dev server on :5173
```

## What JRDM does

1. **Import** — reverse-engineer a live Oracle schema (`POST /api/import/oracle`): tables, columns, PKs, FKs, and cardinality are rendered as a React Flow ERD.
2. **Author** — drag entity columns onto a JSON document tree; configure nested objects, arrays, and unnest fields; set DML permissions and ETag mode per nested table; declare asymmetric join columns (`link.from` on the parent, `link.to` on the child).
3. **Generate** — live DDL preview in both SQL/JSON (`CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW … AS …`) and GraphQL (`@dualityView … @link(from:[…] to:[…])`), updated on every keystroke.
4. **Deploy** — one-click deploy to a connected Oracle instance: a sandbox schema is created, DDL runs in a transaction, and success or failure surfaces immediately in the deploy dialog.
5. **Sample** — fetch up to five prettified documents from the deployed view, rendered as a collapsible JSON tree with visible ETags.
6. **Edit** — open any sampled document, change a field value, and save; Oracle enforces the ETag round-trip and returns a new ETag on success.
7. **Conflict demo** — a stale write (second save against an already-advanced ETag) raises `ORA-42699`; the UI surfaces the conflict clearly via the ConflictBanner.
8. **Teardown** — one-button sandbox teardown; verified to leave no orphaned schemas.

## Package / App Layout

```text
jrdm/
├── apps/
│   ├── web/        # React 18 + Vite 6 + Zustand 5 + Tailwind 3 — visual designer
│   └── server/     # Fastify 5 HTTP API
├── packages/
│   ├── model/              # Canonical IR + Zod schemas + YAML serde
│   ├── generator-duality/  # SQL/JSON + GraphQL DDL emitters; fast-check 10k round-trip property
│   ├── importer-oracle/    # Live Oracle schema reverse-engineering
│   ├── validator/          # Lint rules over the IR
│   └── exec/               # Deploy, sample, sandbox lifecycle, ETag edit, conflict simulator
└── tools/
    └── docker/     # Dockerfile + docker-compose.yml
```

## API Endpoints

| Method | Path                  | Purpose                                           |
| ------ | --------------------- | ------------------------------------------------- |
| GET    | `/api/health`         | Health check                                      |
| POST   | `/api/import/oracle`  | Reverse-engineer Oracle schema → project IR       |
| POST   | `/api/ddl/preview`    | Generate DDL preview (sql \| graphql)             |
| POST   | `/api/deploy`         | Deploy DDL to Oracle                              |
| POST   | `/api/sample`         | Sample documents from a deployed duality view     |
| POST   | `/api/document/read`  | Read one document by `_id`                        |
| POST   | `/api/document/write` | Write document back with ETag (→ 409 on conflict) |
| POST   | `/api/sandbox`        | Create sandbox schema                             |
| DELETE | `/api/sandbox`        | Tear down sandbox schema (idempotent)             |

## Milestone Status

| Milestone | What shipped                                                                                                | Status  |
| --------- | ----------------------------------------------------------------------------------------------------------- | ------- |
| v0.1      | Monorepo, CI/CD, model IR, SQL/JSON emitter, deploy engine, Testcontainers Oracle integration               | ✅ Done |
| v0.2      | Oracle importer, React Flow ERD canvas, entity/relationship inspector, connection UI                        | ✅ Done |
| v0.3      | GraphQL emitter, nested document editor (drag-drop, toolbar, a11y), dual-syntax DDL pane, 10k property test | ✅ Done |
| v0.4      | Asymmetric `link {from,to}` (I3 closed), exec sample/sandbox/edit/conflict, all API routes, preview UI, e2e | ✅ Done |
| v0.5      | MongoDB inference + suggested duality view                                                                  | 🔜 Next |
| v0.6      | Migrations (Liquibase/Flyway), ORDS DDL + OpenAPI, Redwood theme polish                                     | Planned |
| v1.0      | Demo polish, docs site, signed release artifacts                                                            | Planned |

## Tech Stack

Node 22, pnpm + Turborepo, TypeScript strict, Zod, Fastify 5, `oracledb` ^6.6 (thin mode), `testcontainers` ^11 (Oracle Free), React 18, Vite 6, Zustand 5, Tailwind 3, Vitest 4, `@testing-library/react`, Playwright, `fast-check`.

## License

MIT — see [LICENSE](LICENSE).
