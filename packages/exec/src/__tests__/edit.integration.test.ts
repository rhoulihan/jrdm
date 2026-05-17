import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import oracledb from "oracledb";
import { deployDdl, type Connection } from "../deploy";
import { openQueryConnection } from "../query";
import { readDocument, writeDocument, etagOf } from "../edit";

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

describe("readDocument / writeDocument against live Oracle", () => {
  it("reads, mutates a scalar, writes back, gets a new etag, and re-read shows the new value", async () => {
    // Deploy table + row + WITH UPDATE duality view
    const c = await pool.getConnection();
    const conn = wrap(c);

    const ddl = [
      "CREATE TABLE edit_orders (order_id NUMBER PRIMARY KEY, status VARCHAR2(50) NOT NULL)",
      "INSERT INTO edit_orders VALUES (1, 'pending')",
      `CREATE JSON RELATIONAL DUALITY VIEW edit_orders_dv AS
        SELECT JSON {
          '_id' : o.order_id,
          'status' : o.status WITH UPDATE
        }
        FROM edit_orders o WITH UPDATE`,
    ];

    const result = await deployDdl(conn, ddl);
    expect(result.errors).toEqual([]);

    const qc = await openQueryConnection({
      user: "system",
      password: "JrdmTest_2026",
      connectString: `${container.getHost()}:${container.getMappedPort(1521)}/FREEPDB1`,
    });

    try {
      // Read the document
      const doc = await readDocument(qc, "system", "edit_orders_dv", "1");
      expect(doc._id).toBe(1);
      expect(doc.status).toBe("pending");
      const oldEtag = etagOf(doc);
      expect(oldEtag).toMatch(/^[0-9A-F]+$/);

      // Mutate a scalar field, keeping _metadata intact for ETag enforcement
      const mutated = { ...doc, status: "shipped" };

      // Write back — Oracle uses the embedded _metadata.etag for optimistic concurrency
      const { etag: newEtag } = await writeDocument(qc, "system", "edit_orders_dv", "1", mutated);

      // New etag must differ (Oracle advances it on every successful update)
      expect(newEtag).toMatch(/^[0-9A-F]+$/);
      expect(newEtag).not.toBe(oldEtag);

      // Re-read shows the new value persisted
      const fresh = await readDocument(qc, "system", "edit_orders_dv", "1");
      expect(fresh.status).toBe("shipped");
      expect(etagOf(fresh)).toBe(newEtag);
    } finally {
      await qc.close();
    }
  });
});
