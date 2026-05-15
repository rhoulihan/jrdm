# JRDM — JSON Relational Duality Mapper

Visual designer for Oracle JSON Relational Duality Views. Drag entities and document fields; deploy the result.

## Quick Start

```sh
docker compose -f tools/docker/docker-compose.yml up
```

Open <http://localhost:3737/api/health> to verify the service is running. (The visual UI ships in v0.2; v0.1 is the API + generator foundation.)

## What works in v0.1

- Canonical IR (`@jrdm/model`) — entity + duality-view schemas with Zod validation and YAML serde
- Duality view DDL generator (`@jrdm/generator-duality`) — SQL/JSON form with DML annotations
- Validator (`@jrdm/validator`) — PK and duplicate-column rules
- Deploy engine (`@jrdm/exec`) — transactional DDL deploy, verified against live Oracle 26ai via Testcontainers
- HTTP API (`@jrdm/server`) — `/api/health`, `/api/ddl/preview`, `/api/deploy`
- Web shell (`@jrdm/web`) — minimal React UI that generates DDL from a sample view

## Status

v0.1 — foundation complete. See [docs/spec.md](docs/spec.md) and [docs/plans/2026-05-15-jrdm-roadmap.md](docs/plans/2026-05-15-jrdm-roadmap.md) for the full product spec and milestone roadmap.

## License

MIT — see [LICENSE](LICENSE).
