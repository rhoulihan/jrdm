import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import oracledb from "oracledb";
import { openQueryConnection } from "../query";
import { openOracleConnection } from "../connect";
import { sandboxSchemaName, createSandbox, dropSandbox } from "../sandbox";

let container: StartedTestContainer;
let pool: oracledb.Pool;
let connectString: string;

beforeAll(async () => {
  container = await new GenericContainer("container-registry.oracle.com/database/free:latest-lite")
    .withExposedPorts(1521)
    .withEnvironment({ ORACLE_PWD: "JrdmTest_2026" })
    .withWaitStrategy(Wait.forLogMessage("DATABASE IS READY TO USE!", 1))
    .withStartupTimeout(240_000)
    .start();
  connectString = `${container.getHost()}:${container.getMappedPort(1521)}/FREEPDB1`;
  pool = await oracledb.createPool({
    user: "system",
    password: "JrdmTest_2026",
    connectString,
    poolMin: 1,
    poolMax: 4,
  });
}, 300_000);

afterAll(async () => {
  if (pool) await pool.close(0);
  if (container) await container.stop({ timeout: 30_000 });
});

describe("sandbox schema lifecycle against live Oracle", () => {
  const projectId = "sandbox_integration_test";
  const sandboxName = sandboxSchemaName(projectId);
  const sandboxPwd = "SandboxTest_2026";

  it("creates a sandbox schema and connects as the new user", async () => {
    // Create sandbox via admin Connection (write path)
    const adminConn = await openOracleConnection({
      user: "system",
      password: "JrdmTest_2026",
      connectString,
    });

    try {
      await createSandbox(adminConn, sandboxName, sandboxPwd);
    } finally {
      await adminConn.close();
    }

    // Connect AS the new sandbox user and run a basic query
    const sandboxQc = await openQueryConnection({
      user: sandboxName,
      password: sandboxPwd,
      connectString,
    });

    try {
      const rows = await sandboxQc.query<{ N: number }>("SELECT 1 AS n FROM dual");
      expect(rows).toEqual([{ N: 1 }]);
    } finally {
      await sandboxQc.close();
    }
  });

  it("drops the sandbox schema so re-connect fails", async () => {
    // Drop via QueryConnection (admin)
    const adminQc = await openQueryConnection({
      user: "system",
      password: "JrdmTest_2026",
      connectString,
    });

    try {
      await dropSandbox(adminQc, sandboxName);
    } finally {
      await adminQc.close();
    }

    // Re-connect as the dropped user should fail
    await expect(
      openQueryConnection({
        user: sandboxName,
        password: sandboxPwd,
        connectString,
      }),
    ).rejects.toThrow();
  });

  it("dropSandbox is idempotent (swallows ORA-01918 on second call)", async () => {
    const adminQc = await openQueryConnection({
      user: "system",
      password: "JrdmTest_2026",
      connectString,
    });

    try {
      // Second drop on already-dropped schema — must not throw
      await expect(dropSandbox(adminQc, sandboxName)).resolves.toBeUndefined();
    } finally {
      await adminQc.close();
    }
  });

  it("all_users has no leftover JRDM_PROJ_* rows after teardown", async () => {
    const adminQc = await openQueryConnection({
      user: "system",
      password: "JrdmTest_2026",
      connectString,
    });

    try {
      const rows = await adminQc.query<{ USERNAME: string }>(
        "SELECT username FROM all_users WHERE username = :n",
        { n: sandboxName },
      );
      expect(rows).toEqual([]);
    } finally {
      await adminQc.close();
    }
  });
});
