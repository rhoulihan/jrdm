# Contributing to JRDM

## Setup

```sh
nvm use            # Node 22
pnpm install
pnpm build
pnpm test
```

## Test Discipline

JRDM enforces strict TDD via a pre-commit gate. Every staged source file under `packages/*/src` or `apps/*/src` must be paired with a modified test file in the same commit. Bypassing with `--no-verify` requires an entry in `tasks/lessons.md`.

Coverage gates: 90% line / 85% branch on `packages/*`; 70% on `apps/*`.

## Integration Tests

The integration suite runs against Oracle Database Free 26ai via Testcontainers:

```sh
pnpm --filter @jrdm/exec test:int
```

First run pulls ~2GB; expect a few minutes for container startup. The image `container-registry.oracle.com/database/free:latest-lite` is publicly pullable (no registry login needed).

## CI

Every PR runs lint, typecheck, unit, integration (Oracle), e2e (Playwright), and a container build with Trivy scan. The container/Trivy job is currently non-blocking pending a dependency-hygiene pass (tracked in `tasks/lessons.md`).

## Branching

Trunk-based on `main`. Short-lived feature branches; squash-merge PRs. Conventional commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`, `ci:`, `build:`).
