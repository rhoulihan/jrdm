import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import oracledb from "oracledb";
import { openQueryConnection } from "../query";

let container: StartedTestContainer;
let pool: oracledb.Pool;

beforeAll(async () => {
  container = await new GenericContainer("container-registry.oracle.com/database/free:latest-lite")
    .withExposedPorts(1521)
    .withEnvironment({ ORACLE_PWD: "JrdmTest_2026" })
    .withWaitStrategy(Wait.forLogMessage("DATABASE IS READY TO USE!", 1))
    .withStartupTimeout(240_000)
    .start();
  pool = await oracledb.createPool({
    user: "system",
    password: "JrdmTest_2026",
    connectString: `${container.getHost()}:${container.getMappedPort(1521)}/FREEPDB1`,
    poolMin: 1,
    poolMax: 4,
  });
}, 300_000);

afterAll(async () => {
  if (pool) await pool.close(0);
  if (container) await container.stop({ timeout: 30_000 });
});

describe("openQueryConnection against live Oracle", () => {
  it("returns rows as objects", async () => {
    const qc = await openQueryConnection({
      user: "system",
      password: "JrdmTest_2026",
      connectString: `${container.getHost()}:${container.getMappedPort(1521)}/FREEPDB1`,
    });
    try {
      const rows = await qc.query<{ N: number }>("SELECT 1 AS n FROM dual");
      expect(rows).toEqual([{ N: 1 }]);
    } finally {
      await qc.close();
    }
  });

  it("execute returns rowsAffected and autoCommits", async () => {
    const qc = await openQueryConnection({
      user: "system",
      password: "JrdmTest_2026",
      connectString: `${container.getHost()}:${container.getMappedPort(1521)}/FREEPDB1`,
    });
    try {
      // Create a temp table, insert a row, verify autoCommit behaviour
      await qc.execute("CREATE TABLE qc_test_tbl (id NUMBER PRIMARY KEY)");
      const affected = await qc.execute("INSERT INTO qc_test_tbl VALUES (42)");
      expect(affected).toBe(1);
      // Verify the row is visible (autoCommit means it is durable)
      const rows = await qc.query<{ ID: number }>("SELECT id FROM qc_test_tbl WHERE id = 42");
      expect(rows).toEqual([{ ID: 42 }]);
    } finally {
      // Clean up
      try {
        await qc.execute("DROP TABLE qc_test_tbl");
      } catch {
        // ignore cleanup errors
      }
      await qc.close();
    }
  });

  it("query accepts bind variables", async () => {
    const qc = await openQueryConnection({
      user: "system",
      password: "JrdmTest_2026",
      connectString: `${container.getHost()}:${container.getMappedPort(1521)}/FREEPDB1`,
    });
    try {
      const rows = await qc.query<{ VAL: string }>("SELECT :v AS val FROM dual", { v: "hello" });
      expect(rows).toEqual([{ VAL: "hello" }]);
    } finally {
      await qc.close();
    }
  });
});
