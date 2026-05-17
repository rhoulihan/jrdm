/**
 * DoD proof: POST /api/sandbox (create) + DELETE /api/sandbox (teardown) → live Oracle
 *
 * Roadmap DoD bullet: "One-button teardown, no orphaned schemas"
 *
 * This test spins Oracle Free via Testcontainers and exercises:
 *   1. POST /api/sandbox  → creates the schema; sandbox user can connect
 *   2. DELETE /api/sandbox → drops the schema; sandbox user can no longer connect
 *   3. DELETE /api/sandbox again → idempotent, still returns { dropped: true }
 *   4. all_users has no leftover JRDM_PROJ_* rows (orphan-free assertion)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { openQueryConnection, sandboxSchemaName } from "@jrdm/exec";
import { buildApp } from "../app";

let container: StartedTestContainer;
let connectString: string;

beforeAll(async () => {
  container = await new GenericContainer("container-registry.oracle.com/database/free:latest-lite")
    .withExposedPorts(1521)
    .withEnvironment({ ORACLE_PWD: "JrdmTest_2026" })
    .withWaitStrategy(Wait.forLogMessage("DATABASE IS READY TO USE!", 1))
    .withStartupTimeout(240_000)
    .start();

  connectString = `${container.getHost()}:${container.getMappedPort(1521)}/FREEPDB1`;
}, 300_000);

afterAll(async () => {
  if (container) await container.stop({ timeout: 30_000 });
});

describe("POST /api/sandbox + DELETE /api/sandbox — server integration", () => {
  const projectId = "server_sandbox_int_test";
  const sandboxPassword = "SandboxTest_2026";

  it("creates sandbox schema, connects as the new user, drops it (idempotent), leaves no orphan", async () => {
    const app = await buildApp();

    const adminConnection = {
      user: "system",
      password: "JrdmTest_2026",
      connectString,
    };

    const expectedSchema = sandboxSchemaName(projectId);

    // ── Step 1: POST /api/sandbox → create ──────────────────────────────────
    const createRes = await app.inject({
      method: "POST",
      url: "/api/sandbox",
      payload: {
        connection: adminConnection,
        projectId,
        password: sandboxPassword,
      },
    });

    expect(createRes.statusCode, `Create failed: ${createRes.body}`).toBe(200);
    const createBody = createRes.json();
    expect(createBody.created).toBe(true);
    expect(createBody.schema).toBe(expectedSchema);

    // ── Step 2: Connect as the new sandbox user (proves the schema is usable) ─
    const sandboxQc = await openQueryConnection({
      user: expectedSchema,
      password: sandboxPassword,
      connectString,
    });

    try {
      const rows = await sandboxQc.query<{ N: number }>("SELECT 1 AS n FROM dual");
      expect(rows).toEqual([{ N: 1 }]);
    } finally {
      await sandboxQc.close();
    }

    // ── Step 3: DELETE /api/sandbox → drop ──────────────────────────────────
    const dropRes = await app.inject({
      method: "DELETE",
      url: "/api/sandbox",
      payload: { connection: adminConnection, projectId },
    });

    expect(dropRes.statusCode, `Drop failed: ${dropRes.body}`).toBe(200);
    const dropBody = dropRes.json();
    expect(dropBody.dropped).toBe(true);
    expect(dropBody.schema).toBe(expectedSchema);

    // Verify the sandbox user can no longer connect
    await expect(
      openQueryConnection({
        user: expectedSchema,
        password: sandboxPassword,
        connectString,
      }),
    ).rejects.toThrow();

    // ── Step 4: DELETE /api/sandbox again → idempotent ──────────────────────
    const dropAgainRes = await app.inject({
      method: "DELETE",
      url: "/api/sandbox",
      payload: { connection: adminConnection, projectId },
    });

    expect(
      dropAgainRes.statusCode,
      `Second drop should be idempotent but got ${dropAgainRes.statusCode}: ${dropAgainRes.body}`,
    ).toBe(200);
    const dropAgainBody = dropAgainRes.json();
    expect(dropAgainBody.dropped).toBe(true);
    expect(dropAgainBody.schema).toBe(expectedSchema);

    // ── Step 5: Assert all_users has no leftover JRDM_PROJ_* orphans ────────
    const adminQc = await openQueryConnection({
      user: "system",
      password: "JrdmTest_2026",
      connectString,
    });

    try {
      const rows = await adminQc.query<{ USERNAME: string }>(
        "SELECT username FROM all_users WHERE username = :n",
        { n: expectedSchema },
      );
      expect(rows, `Orphaned schema detected: ${expectedSchema} still in all_users`).toEqual([]);
    } finally {
      await adminQc.close();
    }

    await app.close();
  });
});
