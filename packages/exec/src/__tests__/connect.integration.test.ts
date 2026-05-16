import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { openOracleConnection } from "../connect";

let container: StartedTestContainer;

beforeAll(async () => {
  container = await new GenericContainer("container-registry.oracle.com/database/free:latest-lite")
    .withExposedPorts(1521)
    .withEnvironment({ ORACLE_PWD: "JrdmTest_2026" })
    .withWaitStrategy(Wait.forLogMessage("DATABASE IS READY TO USE!", 1))
    .withStartupTimeout(240_000)
    .start();
}, 300_000);

afterAll(async () => {
  if (container) await container.stop({ timeout: 30_000 });
});

describe("openOracleConnection against live Oracle 26ai", () => {
  it("wraps a live connection and executes a query", async () => {
    const host = container.getHost();
    const port = container.getMappedPort(1521);
    const conn = await openOracleConnection({
      user: "system",
      password: "JrdmTest_2026",
      connectString: `${host}:${port}/FREEPDB1`,
    });

    try {
      // SELECT 1 FROM dual — rowsAffected is undefined for queries, defaults to 0
      const result = await conn.execute("SELECT 1 FROM dual");
      expect(result).toMatchObject({ rowsAffected: 0 });
    } finally {
      await conn.close();
    }
  });
});
