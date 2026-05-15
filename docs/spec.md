# JRDM — JSON Relational Duality Mapper

**Product Specification v1.0 — Draft for Internal Review**
Repository: `oracle/jrdm` (to be created)
Owner: Rick Houlihan, Field CTO, Oracle
Status: Spec for development team demo

---

## 1. Executive Summary

JRDM is a visual, point-and-click design tool that lets developers build Oracle JSON Relational Duality Views without writing SQL. Users drag tables from an entity-relationship diagram and fields from document templates onto a duality view canvas; JRDM produces deployable DDL (both GraphQL and SQL/JSON forms), JSON Collection Table definitions, Liquibase/Flyway migrations, and ORDS REST endpoints with OpenAPI specs.

It plays the same role for Oracle 26ai duality views that SQL Server Management Studio's Visual Database Tools play for relational queries: it lowers the barrier to entry for developers who think in documents, and it makes the _converged_ nature of the unified model obvious by making the relational ↔ JSON mapping visible and tactile.

JRDM ships as a Node.js + React web service. The same artifact runs locally (single-binary launcher, no auth) or as a Docker Compose deployment on a shared host. Project state is stored as git-friendly YAML/JSON on the filesystem so models are diffable, branchable, and reviewable like code.

The v1 demo deliverable proves three things to the development team:

1. A developer with **no SQL background** can produce a working duality view from an existing schema in under five minutes.
2. JRDM can **point at a live MongoDB collection**, infer an ERD, and propose a candidate duality view shape — making the migration story tactile.
3. The generated DDL **deploys cleanly to a live Oracle 26ai instance** and supports the full optimistic-locking round trip with ETag.

---

## 2. Product Vision

**For** developers building on Oracle 26ai who already understand documents,
**Who** find duality view DDL syntactically unfamiliar and operationally opaque,
**JRDM** is a visual design tool that
**Converts** entity diagrams plus document templates into deployable duality view DDL, migrations, and REST APIs,
**Unlike** writing CREATE JSON RELATIONAL DUALITY VIEW by hand,
**Our product** makes the relational ↔ JSON mapping a direct-manipulation experience and turns the unified model from a slide into a tool you click on.

### Design Pillars

1. **Direct manipulation.** Every duality view configuration option is exposed as a UI affordance — no hidden behavior, no required SQL editing. Power users may drop into a SQL pane, but it's never the only path.
2. **Round-trip fidelity.** Generated DDL → live deploy → drift detect → re-import is a closed loop. Hand-edits made in the database can be pulled back into the model.
3. **Source-of-truth in git.** Projects are folders of YAML, designed to live in version control next to the application repo. Code review on a duality view is just `git diff`.
4. **Oracle-native polish.** Redwood-inspired theme, Oracle Sans typography, motion and detail at the bar of an Oracle product. This is a demo asset and a recruiting asset for the platform.
5. **Convergence-forward.** JRDM speaks Oracle 26ai _and_ MongoDB on equal footing. Importing a Mongo collection is a first-class action, not an afterthought.

---

## 3. User Personas

| Persona                     | Background                                                                          | Primary Need                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Doc Developer Dana**      | Node/Python full-stack, last wrote SQL in school, comfortable with Mongoose/MongoDB | Generate duality views from existing relational schema so her app can `find()`/`update()` documents without ORM         |
| **Migration Engineer Mike** | Moving a Mongo workload to Oracle 26ai                                              | Point JRDM at his Mongo cluster, get an ERD + a starter duality view that replicates today's document shape             |
| **DBA Diana**               | Oracle DBA, owns the schema, gatekeeper for any DDL that touches prod               | Review JRDM's generated DDL/migrations as a PR; sign off on permissions, ETag scope, and check constraints before merge |
| **Architect Aamir**         | Designing a new system, wants to model document and relational together             | Use JRDM as a whiteboard that produces deployable artifacts — design _is_ the deliverable                               |

### Primary Use Cases

1. **Greenfield modeling.** Draw an ERD from scratch, draw a document template alongside, draw mapping lines, deploy.
2. **Reverse engineer from Oracle.** Connect to an existing schema, pick tables, drag them onto a document canvas, generate views.
3. **Migrate from MongoDB.** Connect to a Mongo URI, scan collections, accept the inferred ERD and suggested duality view, tune, deploy.
4. **Maintain.** Open an existing JRDM project (folder of YAML), make changes, JRDM emits a Liquibase changeset, ship via CI.

---

## 4. Functional Architecture

JRDM borrows its mental model from SSMS Visual Database Tools. Three synchronized panes plus a navigator, with bidirectional editing:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Navigator    │  Diagram pane          │ Document template pane │ Inspector │
│  ─────────    │  ─────────────         │ ─────────────────────  │ ────────  │
│  Connections  │  ERD canvas            │ JSON shape canvas      │ Selected  │
│  Schemas      │  (entities, FKs,       │ (nested objects,       │ object's  │
│  Views        │   cardinality)         │  arrays, scalars)      │ options:  │
│  Migrations   │                        │                        │ DML, etag │
│               │  ←——— drag to ———→ map fields to document       │ scope,    │
│               │                                                  │ etc.      │
├─────────────────────────────────────────────────────────────────┬───────────┤
│  DDL pane (live preview, GraphQL ⇄ SQL/JSON toggle, copy/deploy)            │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Diagram pane** — interactive ERD. Tables shown as boxes with column lists and PK/FK adornments. Relationship lines indicate cardinality (1:1, 1:N, N:M via junction). Powered by React Flow with custom node + edge components.
- **Document template pane** — the JSON document shape JRDM will materialize. Hierarchical view with scalars, arrays (`[ ]`), nested objects (`{ }`). Drag a table column from the diagram onto a field slot to bind it; drag a related table onto an array slot to nest it.
- **Inspector** — context-sensitive options for whatever is selected (a table, a field, a relationship, or the view as a whole). Every duality view annotation is reachable here.
- **DDL pane** — live, read-only by default. Toggle GraphQL ⇄ SQL/JSON. Buttons: Copy, Save Migration, Deploy to Connection, Preview Sample Document.

All four panes are synchronized: selecting a field in the document highlights its source column in the diagram and the relevant fragment in the DDL pane, and surfaces its options in the inspector.

---

## 5. ERD Designer

### Capabilities

- **Entities (tables)** — name, schema, columns, PK, unique indexes, comments, tablespace (advanced), partitioning (advanced).
- **Columns** — name, Oracle type, precision/scale, nullable, default, identity, generated-always-as, comment, virtual.
- **Relationships** — 1:1, 1:N, N:M (auto-creates a junction entity with two FKs). Drag from one entity to another to create. Cardinality and optionality (mandatory/optional on each end) are explicit.
- **Constraints** — PK, UK, FK, CHECK. PK and UK can be declared `RELY` (required by duality views even when not enforced).
- **Indexes** — name, columns, type (BTREE, BITMAP, JSON Search Index, JSON Multivalue), uniqueness.
- **Auto-layout** — force-directed default; manual nudge with snap-to-grid; user positions persist in YAML.
- **Diff overlay** — when imported from a live connection, show drift between in-tool model and database state.

### Supported Column Types (matches duality view allowed set)

`JSON, BLOB, CLOB, NCLOB, VARCHAR2, NVARCHAR2, CHAR, NCHAR, RAW, BOOLEAN, DATE, TIMESTAMP, TIMESTAMP WITH TIME ZONE, INTERVAL YEAR TO MONTH, INTERVAL DAY TO SECOND, NUMBER, BINARY_DOUBLE, BINARY_FLOAT, VECTOR`

Unsupported types are flagged in the UI with a warning that the table cannot be used in a duality view until the column is excluded, projected, or retyped.

### Validation Rules (surfaced live)

- A table used as a duality view root must declare a PK or UK constraint (it may be `RELY`).
- A table used in a nested array or via UNNEST must have an FK relationship traceable to its parent.
- Identity columns appearing as `_id` cannot be marked as user-supplied on insert.
- Columns with unsupported types block duality view inclusion until resolved.

---

## 6. Document Schema Editor

The document pane is a structured JSON template editor — not a free-text editor — so that every node has known semantics for code generation.

### Node Types

| Node             | UI affordance                                             | Generated mapping                  |
| ---------------- | --------------------------------------------------------- | ---------------------------------- |
| Object root      | Top-level `{ }` with `_id` slot                           | The root table of the duality view |
| Scalar field     | Named slot, type badge, source column drop zone           | `'fieldName' : column`             |
| Nested object    | Named `{ }` block, source table drop zone                 | Subquery returning a JSON object   |
| Array of objects | Named `[ ]` block, source table drop zone, FK link picker | Subquery with `JSON_ARRAYAGG`      |
| Unnested object  | `{ }` block tagged `unnest`, source table drop zone       | `UNNEST (subquery)` flattening 1:1 |
| Computed field   | Named slot with expression input                          | `@generated(path: "...")`          |
| Composite `_id`  | Multi-column `_id` slot                                   | `'_id' : {col1, col2, col3}`       |

### Inspector Options per Field

- **Source column** (single-column FKs auto-inferred from selected relationship).
- **Updatable** (`WITH UPDATE` / `WITH NOUPDATE` at the column tag level).
- **In ETag scope** (`WITH CHECK ETAG` / `WITH NOCHECK ETAG`). Default: in scope.
- **JSON key name** (defaults to camelCased column name; override allowed).
- **Type override** (e.g., NUMBER projected as string for ID safety in JS).
- **Description** (carried into OpenAPI when generating ORDS endpoints).

### Inspector Options per Object/Array Node

- **Source table** with FK relationship picker.
- **DML permissions** — INSERT/UPDATE/DELETE checkboxes per table → `WITH INSERT UPDATE DELETE` or `@insert @update @delete`.
- **ETag scope** — CHECK/NOCHECK per table.
- **Link override** — explicit `@link(to: ["col"])` when the inferred FK isn't right.
- **Filter (WHERE)** — additional predicate restricting the relationship (advanced).

### Inspector Options per View

- **View name** and **schema**.
- **Replace mode** — `OR REPLACE`, `IF NOT EXISTS`, plain `CREATE`.
- **Replication** — `ENABLE/DISABLE LOGICAL REPLICATION`.
- **Augmentation** — read augmentation / write augmentation (advanced; opens SQL editor).
- **Flex columns** — enable per-table flex storage for schema-flexible fields.

---

## 7. Duality View Designer — Complete Configuration Matrix

This is the surface that must be 100% feature-complete for v1. Every annotation that affects the generated DDL is exposed in the UI.

### 7.1 Table-Level Annotations

| UI control     | Generated SQL           | Generated GraphQL | Default         |
| -------------- | ----------------------- | ----------------- | --------------- |
| Insert allowed | `WITH INSERT`           | `@insert`         | off (read-only) |
| Update allowed | `WITH UPDATE`           | `@update`         | off             |
| Delete allowed | `WITH DELETE`           | `@delete`         | off             |
| ETag check     | `WITH CHECK` (implicit) | (implicit)        | on              |
| ETag exclude   | `WITH NOCHECK`          | `@nocheck`        | —               |

### 7.2 Column-Level Annotations

| UI control         | Generated SQL       | Default        |
| ------------------ | ------------------- | -------------- |
| Column updatable   | `WITH UPDATE`       | inherits table |
| Column read-only   | `WITH NOUPDATE`     | —              |
| Column in ETag     | `WITH CHECK ETAG`   | on             |
| Column out of ETag | `WITH NOCHECK ETAG` | —              |

### 7.3 Relationship Mapping

| Cardinality       | UI gesture                                                        | Generated form                                             |
| ----------------- | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| 1:1, 1:N (nested) | Drag related table onto array slot `[ ]`                          | `JSON_ARRAYAGG` subquery / `[ ]` in GraphQL                |
| 1:1 (flattened)   | Drag related table onto a "flatten" slot                          | `UNNEST (subquery)` / `@unnest`                            |
| N:M               | Drag a junction table; JRDM auto-builds nested-via-junction shape | Nested array through junction with secondary nested object |
| Composite FK      | FK picker exposes multi-column choice                             | `@link(to: ["c1","c2"])`                                   |

### 7.4 ETag / Metadata Behavior

JRDM exposes ETag scope at three levels with a single, consistent mental model:

1. **View-default** — all tables and columns are CHECK unless overridden.
2. **Per-table override** — flag a whole table as NOCHECK (it contributes data but never invalidates the cached ETag).
3. **Per-column override** — flag a specific column as NOCHECK.

A "what's in my ETag" inspector panel shows the computed scope for any selected view so the user can audit it before deployment.

### 7.5 Computed / Generated Fields

`@generated(path: "...")` is exposed as "Computed field" with a JSON-path expression builder. JRDM ships with a snippet library for the common cases (`sum()`, `count()`, `max()`, `avg()` over nested arrays).

### 7.6 Flex Columns

Flex storage is exposed as a per-table checkbox plus a flex-column picker. When enabled, the document editor offers an "Allow additional properties" toggle on the corresponding JSON object node.

### 7.7 Augmentation Clauses

Read and write augmentation are advanced features behind a disclosure. They open a SQL editor with Monaco + Oracle SQL grammar and syntax checking. The generated DDL splices the augmentation block into the appropriate position.

### 7.8 Replication

A single dropdown: `ENABLE LOGICAL REPLICATION` / `DISABLE LOGICAL REPLICATION` / off. RAC pre-flight requirements (`ALTER SYSTEM ENABLE RAC TWO_STAGE ROLLING UPDATES ALL`) are surfaced as a documentation tooltip with a copy button.

### 7.9 Validation, Linting, Errors

JRDM performs design-time validation before generation:

- All annotation prerequisites (PK/UK declared on referenced tables).
- No unsupported column types in mapped fields.
- No duplicated JSON keys at the same level.
- Composite `_id` columns all NOT NULL.
- No circular nesting without a join predicate.
- Junction-table N:M never generates a NODELETE on the junction (would orphan rows).
- Lint-level warnings (e.g., "NOCHECK on a NUMBER means concurrent edits can silently overwrite").

Errors are surfaced in three places: the affected node in the document/diagram (red badge), the inspector panel, and a Problems pane in the bottom dock.

---

## 8. Schema Importers

### 8.1 Oracle → ERD

- Connects via `node-oracledb` with thick or thin mode (thick required for some advanced features).
- Connection profiles support: TNS alias, Easy Connect, wallet (mTLS for ADB).
- Reads `USER_TABLES`, `USER_TAB_COLUMNS`, `USER_CONS_COLUMNS`, `USER_CONSTRAINTS`, `USER_INDEXES`, `USER_TAB_COMMENTS`, `USER_COL_COMMENTS`.
- Renders entities and FK relationships; preserves Oracle types verbatim.
- For each `R` (FK) constraint, infers cardinality (1:N default, 1:1 when child FK column is unique).
- Detects existing duality views (`USER_JSON_DUALITY_VIEWS`) and offers to import them as JRDM models so users can edit them visually.
- Detects JSON Collection Tables and represents them as document-shaped entities.

### 8.2 MongoDB → Document Schema (`$jsonSchema`)

- Connects via official `mongodb` driver. Supports standard URI, X.509, AWS auth, OIDC.
- For each collection, runs `db.getCollectionInfos({name})` and pulls `options.validator.$jsonSchema` if present.
- Converts the JSON Schema to JRDM's internal document model (objects, arrays, scalars, types).
- Round-trips required/optional, enums, min/max, regex constraints, and BSON type hints.

### 8.3 MongoDB → ERD (sample-based inference)

For collections without validators (the common case), JRDM samples documents and infers structure:

- **Sampling strategy** — random sample of N documents (default 1000, configurable up to 100k). Uses `$sample` aggregation stage for fairness.
- **Type detection** — per-path frequency distribution of BSON types. Conflicts surface as a union type with the user able to resolve to one.
- **Optionality** — fields present in < 100% of samples are marked optional.
- **Array shape** — arrays are inferred from element type frequencies; mixed-type arrays produce union element types.
- **Reference detection** — heuristics:
  - `ObjectId` fields whose name follows `<collection>_id` or `<collection>Id` convention.
  - `ObjectId` fields whose values are found as `_id` in another sampled collection (statistical, not exhaustive).
  - Shared scalar key names across collections (`customer_id`, `customerNumber`) as candidate FKs, surfaced as suggestions only.
- **Denormalization detection** — sub-objects whose shape matches another top-level collection are flagged as candidates for normalization in the proposed ERD.
- **Output** — a suggested ERD (one entity per collection, FK candidates flagged for review) plus a candidate duality view that reproduces the dominant document shape from each root collection.

The sample-based inference is the marquee demo moment: "point at a Mongo URI, get an Oracle data model."

### 8.4 File Import / Export

- **DBML** (dbdiagram.io) — read/write.
- **Hackolade JSON** — read/write (Hackolade is a related tool in the Oracle ecosystem).
- **SQL DDL** — read CREATE TABLE / ALTER TABLE for Oracle dialect; produce CREATE TABLE for migration generation.
- **JRDM YAML** — native format, always round-trippable.

---

## 9. Code Generation

A single generator core drives all outputs from the canonical project model.

### 9.1 Duality View DDL — Dual Syntax

Every view can be emitted in either form; the UI toggle changes only the preview. The default for new views is GraphQL (modern, more compact); SQL/JSON is the fallback for users on older clients or in contexts where the GraphQL parser is restricted.

**GraphQL form (preferred):**

```sql
CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW orders_dv AS
orders @insert @update @delete {
  _id : order_id
  orderTime : order_datetime
  status : order_status
  customer : customers @unnest {
    customerId : customer_id
    customerName : full_name
    customerEmail : email_address @nocheck
  }
  items : order_items @insert @update [{
    itemId : line_item_id
    quantity : quantity
    product : products {
      productId : product_id
      name : name @nocheck
      price : unit_price @nocheck
    }
  }]
};
```

**SQL/JSON form (equivalent, emitted on toggle):**

```sql
CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW orders_dv AS
SELECT JSON {
  '_id'       : ord.order_id,
  'orderTime' : ord.order_datetime,
  'status'    : ord.order_status,
  UNNEST (
    SELECT JSON {
      'customerId'    : c.customer_id,
      'customerName'  : c.full_name,
      'customerEmail' : c.email_address WITH NOCHECK
    }
    FROM customers c
    WHERE c.customer_id = ord.customer_id
  ),
  'items' : (
    SELECT JSON_ARRAYAGG(
      JSON {
        'itemId'   : oi.line_item_id,
        'quantity' : oi.quantity,
        'product'  : (
          SELECT JSON {
            'productId' : p.product_id,
            'name'      : p.name WITH NOCHECK,
            'price'     : p.unit_price WITH NOCHECK
          }
          FROM products p
          WHERE p.product_id = oi.product_id
        )
      }
    )
    FROM order_items oi WITH INSERT UPDATE
    WHERE oi.order_id = ord.order_id
  )
}
FROM orders ord WITH INSERT UPDATE DELETE;
```

### 9.2 JSON Collection Table DDL

For models intended as native document storage (not views over relational), JRDM emits:

```sql
CREATE JSON COLLECTION TABLE customers_jct;
```

with optional `JSON_TRANSFORM` triggers or check constraints derived from the document schema (e.g., required fields → `IS NOT NULL`, type constraints → `IS JSON`-with-shape checks).

### 9.3 Liquibase / Flyway Migrations

Every save can optionally produce a versioned changeset:

- **Liquibase** — XML or YAML format, one `<changeSet>` per logical change (create/alter table, create/replace view, grants).
- **Flyway** — `V{n}__description.sql` files with up-only DDL; companion `R__{view}.sql` repeatable migrations for `CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW` (idempotent by design).

Migrations include preconditions (table exists, column types match) where the format supports them.

### 9.4 ORDS REST + OpenAPI

When a connection has ORDS enabled, JRDM emits:

- `BEGIN ORDS.ENABLE_OBJECT(...); END;` for the duality view → automatic CRUD + filter endpoints.
- A companion OpenAPI 3.1 spec describing the resource, query parameters (`q={"field":"value"}`), pagination (`limit`/`offset`), and the ETag round-trip (`If-Match` / 412 Precondition Failed semantics).
- TypeScript types generated from the document schema for client consumers (a quick win; under 200 LOC of generator code).

### 9.5 Generator Architecture

```text
project model (YAML / in-memory tree)
        │
        ▼
   canonical IR  ← single source of truth for all generators
        │
        ├─► duality view emitter (GraphQL form)
        ├─► duality view emitter (SQL/JSON form)
        ├─► JSON collection table emitter
        ├─► Liquibase emitter
        ├─► Flyway emitter
        ├─► ORDS DDL emitter
        ├─► OpenAPI emitter
        └─► TypeScript types emitter
```

A single canonical IR with N emitters; never IR-to-IR translation. New output formats are additive.

---

## 10. Live Oracle Preview

This is the "wow" of the demo. With a connection selected, the user can:

1. **Deploy to sandbox** — JRDM creates a per-project schema (e.g., `JRDM_PROJ_<id>`) and runs the generated DDL there. The schema is namespaced so multiple projects coexist on one instance.
2. **Run sample query** — `SELECT JSON_SERIALIZE(data PRETTY) FROM view_name FETCH FIRST 5 ROWS ONLY;` rendered as a tree in a results pane.
3. **Edit document** — pick a row, edit a field in the JSON tree, JRDM emits the `UPDATE view SET data = ... WHERE data."_id" = ...` and shows the round-trip with the ETag bump highlighted.
4. **Test conflict** — open the same document in two tabs, edit both, watch the second one fail with `ORA-42699` and JRDM's UI surface the ETag mismatch clearly.
5. **Tear down** — `DROP USER JRDM_PROJ_<id> CASCADE` is a single button (with confirmation) so demos can be repeated without polluting the instance.

The Live Preview feature is **opt-in per connection**. The DBA persona will keep it off in production; the demo persona turns it on.

---

## 11. Technical Architecture

### 11.1 Stack

| Layer            | Choice                                                          | Why                                                                           |
| ---------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Backend runtime  | Node.js 22 LTS                                                  | Best `node-oracledb` and `mongodb` driver story; single language across tiers |
| Web framework    | Fastify                                                         | Faster than Express, native schema validation, good Pino logging              |
| Frontend         | React 18 + TypeScript                                           | Required by the canvas component ecosystem                                    |
| Diagramming      | React Flow (xyflow)                                             | Mature, performant, custom node/edge support                                  |
| Code editor      | Monaco                                                          | Same editor as VS Code; Oracle SQL grammar; GraphQL grammar                   |
| State (frontend) | Zustand + Immer                                                 | Lighter than Redux, fits canvas-heavy state shape                             |
| Styling          | Tailwind + Redwood-derived token layer                          | Fast iteration with brand-correct output                                      |
| Driver (Oracle)  | `node-oracledb` (thin by default, thick when wallet/ACL needed) | Official Oracle driver                                                        |
| Driver (Mongo)   | `mongodb` Node driver                                           | Official MongoDB driver                                                       |
| Server tests     | Vitest + Testcontainers (Oracle XE, MongoDB)                    | Real DBs, no mocks                                                            |
| UI tests         | Playwright                                                      | Headless browser, video on failure                                            |

### 11.2 Module Layout (proposed)

```text
jrdm/
├── apps/
│   ├── web/                React SPA (UI)
│   └── server/             Fastify HTTP + WebSocket service
├── packages/
│   ├── model/              Canonical project IR + YAML serde + Zod schemas
│   ├── generator-duality/  Duality view emitters (GraphQL + SQL/JSON)
│   ├── generator-jct/      JSON Collection Table emitter
│   ├── generator-migrate/  Liquibase + Flyway emitters
│   ├── generator-ords/     ORDS DDL + OpenAPI emitter
│   ├── generator-ts/       TypeScript types emitter
│   ├── importer-oracle/    Live Oracle reverse-engineering
│   ├── importer-mongo/     $jsonSchema reader + sample-based inferrer
│   ├── importer-files/     DBML / Hackolade / SQL DDL parsers
│   ├── validator/          Lint rules over the IR
│   ├── exec/               Live deploy + sample query + ETag round-trip
│   └── theme/              Redwood-derived design tokens, shared CSS
└── tools/
    ├── launcher/           Single-binary packager (pkg / Bun compile)
    └── docker/             Compose + Dockerfiles
```

Monorepo managed with pnpm workspaces + Turborepo (caches builds and test runs).

### 11.3 Data Flow

```text
       UI (React)
          │  HTTP/WS
          ▼
   apps/server (Fastify)
          │
   ┌──────┼────────────┬─────────────┐
   ▼      ▼            ▼             ▼
 model  importers   generators     exec
   │       │            │             │
   ▼       ▼            ▼             ▼
  YAML  Oracle/      stdout/        Oracle
  files Mongo        files          (DDL,
                                    DML,
                                    sample
                                    queries)
```

- The server is stateless per-request; project state lives on disk (or in memory during a session).
- Long-running imports (a large Mongo sample) stream progress over a WebSocket.

### 11.4 Project File Format (canonical IR on disk)

A JRDM project is a directory:

```text
my-project/
├── jrdm.yaml              # project metadata, version, settings
├── connections/
│   ├── prod-oracle.yaml   # connection profile (no secrets; secrets in env or OS keychain)
│   └── analytics-mongo.yaml
├── entities/
│   ├── orders.yaml        # one table per file
│   ├── customers.yaml
│   └── ...
├── views/
│   ├── orders_dv.yaml     # one duality view per file
│   └── ...
├── collections/
│   └── audit_jct.yaml     # JSON Collection Tables
└── migrations/
    ├── 0001_init.sql      # generated migrations checked in
    └── ...
```

YAML is chosen over JSON for comments and diffability. Generated SQL is also committed so reviewers can diff DDL without running JRDM.

### 11.5 No-Auth Single-User Mode

Per the v1 decision, JRDM listens on `127.0.0.1` by default with no authentication. The Docker Compose deployment exposes a port behind a reverse proxy where the operator can layer their preferred auth (basic, mTLS, OAuth proxy). The auth layer is intentionally externalized in v1; an internal pluggable-auth abstraction is reserved for v1.1.

---

## 12. UI / UX & Oracle Redwood Theming

### 12.1 Visual System

- **Typography** — Oracle Sans (UI), Georgia (rare display moments), JetBrains Mono (code).
- **Palette** — Redwood-derived. Primary surfaces in neutral warm grays; accent in Oracle Red (`#C74634`) used sparingly for primary actions and active states; success/warning/danger in Redwood semantic tokens.
- **Density** — comfortable default; a "compact" toggle for power users with large schemas.
- **Motion** — short (150–200ms), curve `cubic-bezier(0.2, 0, 0, 1)`. Used for panel transitions, node drag-snap, and DDL-pane regeneration glow.
- **Iconography** — Phosphor or Lucide as a base, retouched where Redwood has a brand-specific glyph.

### 12.2 Layout Hierarchy

- Top bar: project name, connection picker, deploy button, save state, version selector.
- Left rail: navigator (connections / entities / views / migrations).
- Center: dual-pane workspace (diagram ↔ document) with a vertical splitter.
- Right rail: inspector (collapses when nothing is selected).
- Bottom dock: DDL pane / problems pane / output pane (tabbed).
- Status bar: connection state, validation summary, autosave indicator.

### 12.3 Accessibility

- WCAG 2.2 AA color contrast on all text and interactive states.
- Full keyboard navigability of the canvas (arrow keys move selection, Enter opens inspector, `/` opens command palette).
- Screen-reader announcements for canvas state changes via ARIA live regions.
- Reduced-motion variant honored.

### 12.4 Command Palette

`Cmd/Ctrl+K` opens a command palette: open project, switch connection, create view, deploy, diff to live, generate migration, switch syntax mode. Every menu action is reachable here so power users never touch the mouse.

---

## 13. Deployment & Packaging

### 13.1 Docker Compose

```yaml
services:
  jrdm:
    image: oracle/jrdm:latest
    ports: ["3737:3737"]
    volumes: ["./projects:/workspace"]
    environment:
      JRDM_WORKSPACE: /workspace
```

The container ships everything: server, static UI assets, embedded `node-oracledb` thin mode.

### 13.2 Single-Binary Launcher

`tools/launcher` packages the Node service and static assets into one executable per OS (Linux x64, macOS arm64, Windows x64) via `pkg` or Bun `compile`. Users run `./jrdm` and a browser opens to `http://127.0.0.1:3737`.

The same code path runs in both packaging modes; differences are limited to default workspace location and update-check behavior.

### 13.3 Configuration

Configuration is layered: CLI flags > env vars > `~/.jrdm/config.yaml` > defaults. No required config to start.

### 13.4 Wallet & Secrets

- Oracle wallets are stored under `~/.jrdm/wallets/<connection-id>/` with 0700 permissions.
- Database passwords are never persisted in YAML; they live in the OS keychain via `keytar` (or env vars for headless server deploys).
- Connection YAML files contain _references_ to credentials, not values, so projects can be committed safely.

---

## 14. Development Process

### 14.1 Strict TDD

- **Red-green-refactor enforced via pre-commit hook**: changed source files in `packages/*/src` must have a corresponding test file modified in the same commit, or the commit is blocked with a clear message.
- **No mocks for external systems**: importer and generator tests run against ephemeral containers (Oracle Database Free + MongoDB) via Testcontainers. Unit tests for the IR / validator are pure-function and don't touch I/O.
- **Coverage gate**: 90% line, 85% branch on `packages/*` (the libraries); 70% on `apps/*` (UI integration code).
- **Property-based testing**: the dual-syntax emitters round-trip via property tests — generate a random IR, emit GraphQL, emit SQL/JSON, parse both back, assert equivalence.

### 14.2 CI/CD Pipeline (GitHub Actions)

Pipeline stages, all required to pass before merge:

1. **Lint** — ESLint + Prettier + markdownlint.
2. **Typecheck** — `tsc --noEmit` on every package.
3. **Unit tests** — `vitest run` per package.
4. **Integration tests** — Testcontainers spin up Oracle Database Free 26ai + MongoDB; generator and live-exec packages exercise real DDL deployment.
5. **UI tests** — Playwright e2e suite covering the demo script (greenfield, Oracle import, Mongo inference, deploy).
6. **Build** — bundle UI, build server, build single-binary artifacts for all OS targets.
7. **Container** — Docker image built and scanned (Trivy).
8. **Sign + publish** (on tag) — image to GHCR, binaries to release artifacts, npm packages published if applicable.

PR previews: every PR builds and deploys a preview container to a shared dev instance with a fresh ephemeral Oracle Database Free schema.

### 14.3 Branching & Releases

- Trunk-based: `main` is always releasable.
- Short-lived feature branches; merge via PR with at least one review.
- Semantic versioning. `v0.x` for pre-demo iterations, `v1.0.0` on demo readiness.
- Changelogs generated from conventional-commit messages (Changesets).

### 14.4 Quality Gates

| Gate          | Threshold                                                         |
| ------------- | ----------------------------------------------------------------- |
| Test coverage | 90/85 on libraries                                                |
| Bundle size   | UI ≤ 1.2 MB gzip first paint                                      |
| Performance   | DDL regenerate on edit ≤ 50ms p99 for projects up to 200 entities |
| Security      | Trivy: no critical, no high CVEs                                  |
| Accessibility | axe-core: 0 violations on main flows                              |

---

## 15. Roadmap & Milestones

| Milestone                                    | Target    | Scope                                                                                                           |
| -------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| **v0.1 — Spike**                             | Week 2    | Empty-project bootstrap, hand-built ERD, SQL/JSON emitter for a single trivial view, file-based persistence     |
| **v0.2 — ERD Designer**                      | Week 4    | Full ERD with relationships, types, constraints; import from Oracle live connection                             |
| **v0.3 — Document Editor + GraphQL emitter** | Week 6    | Document tree editor, drag-drop binding, GraphQL emitter, inspector parity for table+column annotations         |
| **v0.4 — Live Preview**                      | Week 8    | Deploy to live Oracle, sample query, ETag round-trip demo                                                       |
| **v0.5 — Mongo Inference**                   | Week 10   | $jsonSchema + sample-based inference, suggested duality view from Mongo source                                  |
| **v0.6 — Migrations + ORDS + Polish**        | Week 12   | Liquibase/Flyway emit, ORDS+OpenAPI emit, Redwood-faithful theming pass                                         |
| **v1.0 — Demo-ready**                        | Week 13   | Demo script rehearsed end-to-end; documentation site; release binaries                                          |
| **v1.1**                                     | Post-demo | Schema diff & migrate from drifted Oracle, multi-user mode with OIDC, collaborative editing with presence/locks |

### Demo Script (v1.0)

1. **Greenfield (90 sec)** — draw two entities, draw a 1:N relationship, drag onto document canvas, set DML, deploy, read.
2. **Reverse from Oracle (90 sec)** — connect to ADB, pick `ORDERS` and `ORDER_ITEMS`, generate `orders_dv`, deploy.
3. **Mongo inference (3 min)** — connect to a Mongo cluster, scan `orders` collection, accept the suggested ERD, accept the candidate duality view, deploy to Oracle, run a sample query that returns Mongo-shaped JSON — backed by Oracle relational tables.
4. **Optimistic locking (45 sec)** — open the same order in two tabs, both edit, second one shows the ETag conflict surfaced in JRDM's UI.
5. **Code review (45 sec)** — show the generated YAML diff in git; show the Liquibase migration; show the OpenAPI spec.

Total: ~7 minutes for a single demo run.

---

## 16. Risks & Mitigations

| Risk                                                                                                     | Impact                                       | Mitigation                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Oracle 26ai duality view syntax changes between minor releases                                           | Generated DDL becomes stale                  | Pin to documented syntax version per project; integration tests run against the targeted DB version                                         |
| Mongo inference is wrong on edge cases (polymorphic collections)                                         | Demo lands poorly on real-world data         | Treat inference as _suggestion_; always allow override; provide a "rejected fields" view; test on a curated corpus of public Mongo datasets |
| Canvas performance degrades on large schemas (1000+ tables)                                              | Tool feels slow on enterprise schemas        | Virtualize the diagram; lazy-load entity columns; benchmark in CI                                                                           |
| Single-user, no-auth posture limits team adoption                                                        | Tool can't be used as a shared service in v1 | Documented externalized-auth pattern (reverse proxy + OIDC); v1.1 ships internal auth                                                       |
| ORDS auto-publish surfaces unintended endpoints                                                          | Security incident risk                       | Disable by default; require explicit per-view opt-in; surface a clear summary of what will be published before deploy                       |
| node-oracledb thick mode required for some features increases container size and platform support burden | Deploy friction                              | Default to thin; document precisely which features (e.g., wallet auth) require thick                                                        |
| Demo instance gets polluted by repeated deploys                                                          | Demo fails on the day                        | Per-project sandbox schemas + one-button teardown + nightly cleanup cron                                                                    |

---

## 17. Open Questions for Spec Review

These don't block the spec but warrant a decision before sprint 1:

1. **Project file format — YAML vs TOML?** YAML chosen for comments and ecosystem; revisit if anchors/aliases cause review friction.
2. **GraphQL parser ownership** — write our own (small subset, but invariant on Oracle's grammar evolution) or wrap an existing parser?
3. **License** — UPL 1.0 (Oracle's preferred OSS license) vs Apache 2.0. Defaulting to UPL 1.0 given Oracle authorship.
4. **Telemetry** — opt-in usage telemetry for product feedback? Off in v1; design the hook now.
5. **Plugin API** — should custom generators be third-party-extensible? Probably v2; design generators with a stable plugin contract anyway.

---

## 18. Appendices

### Appendix A — Complete Duality View Annotation Reference

| SQL form                                    | GraphQL form              | Level           | Effect                    |
| ------------------------------------------- | ------------------------- | --------------- | ------------------------- |
| `WITH INSERT`                               | `@insert`                 | Table           | Allow inserts             |
| `WITH UPDATE`                               | `@update`                 | Table or column | Allow updates             |
| `WITH DELETE`                               | `@delete`                 | Table           | Allow deletes             |
| `WITH CHECK` (implicit default)             | (implicit)                | Table or column | Include in ETag           |
| `WITH NOCHECK`                              | `@nocheck`                | Table or column | Exclude from ETag         |
| `WITH NOINSERT/NOUPDATE/NODELETE` (default) | (implicit)                | Table           | Read-only                 |
| `WITH NOUPDATE`                             | (column-level)            | Column          | Pin column read-only      |
| `UNNEST (...)`                              | `@unnest`                 | Subobject       | Flatten 1:1 into parent   |
| (FK in WHERE)                               | `@link(to: ["col"])`      | Relationship    | Override join columns     |
| (computed via JSON)                         | `@generated(path: "...")` | Field           | Computed read-only field  |
| `ENABLE/DISABLE LOGICAL REPLICATION`        | —                         | View            | Replication participation |
| `OR REPLACE` / `IF NOT EXISTS`              | —                         | View            | Create-time modifier      |

### Appendix B — Supported Column Types

`JSON, BLOB, CLOB, NCLOB, VARCHAR2, NVARCHAR2, CHAR, NCHAR, RAW, BOOLEAN, DATE, TIMESTAMP, TIMESTAMP WITH TIME ZONE, INTERVAL YEAR TO MONTH, INTERVAL DAY TO SECOND, NUMBER, BINARY_DOUBLE, BINARY_FLOAT, VECTOR`

### Appendix C — Example `views/orders_dv.yaml`

```yaml
name: orders_dv
schema: app
syntax: graphql # generator preference; both forms always available
createMode: orReplace
replication: disable
root:
  table: orders
  permissions: { insert: true, update: true, delete: true }
  etag: check
fields:
  - key: _id
    source: orders.order_id
  - key: orderTime
    source: orders.order_datetime
  - key: status
    source: orders.order_status
  - key: customer
    kind: unnest
    table: customers
    permissions: { update: true }
    etag: check
    fields:
      - { key: customerId, source: customers.customer_id }
      - { key: customerName, source: customers.full_name }
      - { key: customerEmail, source: customers.email_address, etag: nocheck }
  - key: items
    kind: array
    table: order_items
    permissions: { insert: true, update: true }
    link: [order_id]
    fields:
      - { key: itemId, source: order_items.line_item_id }
      - { key: quantity, source: order_items.quantity }
      - key: product
        kind: object
        table: products
        fields:
          - { key: productId, source: products.product_id }
          - { key: name, source: products.name, etag: nocheck }
          - { key: price, source: products.unit_price, etag: nocheck }
```

### Appendix D — Sources

- [CREATE JSON RELATIONAL DUALITY VIEW — Oracle 26 SQL Reference](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/create-json-relational-duality-view.html)
- [Creating Duality Views — JSON-Relational Duality Developer's Guide, 26ai](https://docs.oracle.com/en/database/oracle/oracle-database/26/jsnvu/creating-duality-views.html)
- [Creating JSON Relational Duality Views using GraphQL — 26](https://docs.oracle.com/en/database/oracle/oracle-database/26/gphql/creating-json-relational-duality-views-using-graphql.html)
- [JSON-Relational Duality Views in Oracle Database 23ai/26ai — ORACLE-BASE](https://oracle-base.com/articles/23/json-relational-duality-views-23)
- [DualityViewTutorial.sql — oracle-samples](https://github.com/oracle-samples/oracle-db-examples/blob/main/json-relational-duality/DualityViewTutorial.sql)
- [Query and View Designer Tools (Visual Database Tools) — Microsoft Learn](https://learn.microsoft.com/en-us/ssms/visual-db-tools/query-and-view-designer-tools-visual-database-tools)
- [Diagram pane (Visual Database Tools) — Microsoft Learn](https://learn.microsoft.com/en-us/ssms/visual-db-tools/diagram-pane-visual-database-tools)
- [MongoDB Schema Validation — MongoDB Docs](https://www.mongodb.com/docs/manual/core/schema-validation/specify-json-schema/)
- [Oracle Redwood Design System](https://redwood.oracle.com/)
