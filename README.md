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

1. **Connect → Import** — click **Connect** to fetch available schemas from the live Oracle instance (`POST /api/schemas`), pick one from the dropdown, then click **Import** (`POST /api/import/oracle`): tables, columns, PKs, FKs, and cardinality are rendered as a draggable React Flow ERD. FK-connected tables are laid out by dagre (left-to-right); isolated tables land in a grid — the ERD never collapses to a single column. Nodes are draggable: position changes persist until a new import re-seeds the layout.
2. **Author** — **right-click an entity node** (or click the **⋯** button in the entity header) to open the context menu. Choose **New duality view from this table** to make the entity the root of a new duality view, or **Map to document…** (enabled once a root view exists) to open the **Map Table to Document** modal for an additional entity. In the modal: select all columns or cherry-pick; click `+ add node` to choose the embed location in the document tree (FK cardinality auto-sets "embed as array" for 1:N); click **Map to Path** to bind; **Save** commits the view and immediately renders a synthetic sample document (no Oracle deploy required for this preview). Use **Inspect table** to open the column/PK/FK inspector drawer, or **Hide from canvas** to declutter the ERD (restorable via "Show hidden (N)").
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
| POST   | `/api/schemas`        | List non-Oracle-maintained schemas (for dropdown) |
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
| v0.4.2    | ERD hybrid grid+dagre layout (never single column), draggable nodes, Connect→schema-picker→Import           | ✅ Done |
| v0.5-map  | Map-to-Document modal (M.T1–M.T5): entity drag → FK-aware batch map → synthetic sample preview              | ✅ Done |
| v0.5      | MongoDB inference + suggested duality view                                                                  | 🔜 Next |
| v0.6      | Migrations (Liquibase/Flyway), ORDS DDL + OpenAPI, Redwood theme polish                                     | Planned |
| v1.0      | Demo polish, docs site, signed release artifacts                                                            | Planned |

## Tech Stack

Node 22, pnpm + Turborepo, TypeScript strict, Zod, Fastify 5, `oracledb` ^6.6 (thin mode), `testcontainers` ^11 (Oracle Free), React 18, Vite 6, Zustand 5, Tailwind 3, Vitest 4, `@testing-library/react`, Playwright, `fast-check`.

## License

MIT — see [LICENSE](LICENSE).
