import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import oracledb from "oracledb";
import { deployDdl, type Connection } from "../deploy";
import { openQueryConnection } from "../query";
import { sampleDocuments } from "../sample";

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

function wrap(c: oracledb.Connection): Connection {
  return {
    execute: async (sql) => {
      const r = await c.execute(sql, [], { autoCommit: false });
      return { rowsAffected: r.rowsAffected ?? 0 };
    },
    commit: () => c.commit(),
    close: () => c.close(),
  };
}

describe("sampleDocuments against live Oracle", () => {
  it("returns docs with _id and _metadata.etag from a deployed duality view", async () => {
    // Deploy a table + row + duality view
    const c = await pool.getConnection();
    const conn = wrap(c);

    const ddl = [
      "CREATE TABLE sample_orders (order_id NUMBER PRIMARY KEY, order_datetime TIMESTAMP NOT NULL)",
      "INSERT INTO sample_orders VALUES (1, SYSTIMESTAMP)",
      "CREATE JSON RELATIONAL DUALITY VIEW sample_orders_dv AS SELECT JSON { '_id' : o.order_id, 'orderTime' : o.order_datetime } FROM sample_orders o",
    ];

    const result = await deployDdl(conn, ddl);
    expect(result.errors).toEqual([]);

    // Open a QueryConnection and sample documents
    const qc = await openQueryConnection({
      user: "system",
      password: "JrdmTest_2026",
      connectString: `${container.getHost()}:${container.getMappedPort(1521)}/FREEPDB1`,
    });

    try {
      const docs = await sampleDocuments(qc, "system", "sample_orders_dv", 5);

      expect(docs).toHaveLength(1);
      const doc = docs[0] as Record<string, unknown>;
      expect(doc._id).toBe(1);
      expect(doc._metadata).toBeDefined();
      const metadata = doc._metadata as { etag: string };
      expect(metadata.etag).toMatch(/^[0-9A-F]+$/);
    } finally {
      await qc.close();
    }
  });

  it("respects the limit parameter", async () => {
    // Insert additional rows and verify limit is respected
    const c = await pool.getConnection();
    await c.execute("INSERT INTO sample_orders VALUES (2, SYSTIMESTAMP)", [], { autoCommit: true });
    await c.execute("INSERT INTO sample_orders VALUES (3, SYSTIMESTAMP)", [], { autoCommit: true });
    await c.close();

    const qc = await openQueryConnection({
      user: "system",
      password: "JrdmTest_2026",
      connectString: `${container.getHost()}:${container.getMappedPort(1521)}/FREEPDB1`,
    });

    try {
      const docs = await sampleDocuments(qc, "system", "sample_orders_dv", 2);
      expect(docs.length).toBeLessThanOrEqual(2);
      expect(docs.length).toBeGreaterThan(0);
    } finally {
      await qc.close();
    }
  });
});
