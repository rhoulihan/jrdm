import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import oracledb from "oracledb";
import { deployDdl, type Connection } from "../deploy";
import { openQueryConnection } from "../query";
import { readDocument, writeDocument } from "../edit";
import { isEtagConflict, simulateConflict } from "../conflict";

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

describe("simulateConflict against live Oracle", () => {
  it("second stale-etag write raises ORA-42699, and DB is recoverable afterward", async () => {
    // Deploy table + row + WITH UPDATE duality view
    const c = await pool.getConnection();
    const conn = wrap(c);

    const ddl = [
      "CREATE TABLE conflict_orders (order_id NUMBER PRIMARY KEY, status VARCHAR2(50) NOT NULL)",
      "INSERT INTO conflict_orders VALUES (1, 'pending')",
      `CREATE JSON RELATIONAL DUALITY VIEW conflict_orders_dv AS
        SELECT JSON {
          '_id' : o.order_id,
          'status' : o.status WITH UPDATE
        }
        FROM conflict_orders o WITH UPDATE`,
    ];

    const result = await deployDdl(conn, ddl);
    expect(result.errors).toEqual([]);

    const qc = await openQueryConnection({
      user: "system",
      password: "JrdmTest_2026",
      connectString: `${container.getHost()}:${container.getMappedPort(1521)}/FREEPDB1`,
    });

    try {
      // simulateConflict: tab A and tab B both read with the same stale etag;
      // tab A writes first (succeeds, etag advances); tab B writes with stale etag → ORA-42699
      const outcome = await simulateConflict(qc, "system", "conflict_orders_dv", "1", (doc) => ({
        ...doc,
        status: "shipped",
      }));

      // Assert second write genuinely raised ORA-42699 (not a no-op or stub)
      expect(outcome.secondWriteConflicted).toBe(true);
      expect(outcome.firstWriteEtag).toMatch(/^[0-9A-F]+$/);
      expect(outcome.error).toMatch(/ORA-42699/);
      expect(isEtagConflict(new Error(outcome.error ?? ""))).toBe(true);

      // Assert DB is not wedged: a fresh read + write succeeds
      const fresh = await readDocument(qc, "system", "conflict_orders_dv", "1");
      expect(fresh.status).toBe("shipped"); // tab A's write persisted

      const writeResult = await writeDocument(qc, "system", "conflict_orders_dv", "1", {
        ...fresh,
        status: "delivered",
      });
      expect(writeResult.etag).toMatch(/^[0-9A-F]+$/);
      expect(writeResult.etag).not.toBe(outcome.firstWriteEtag);

      // Final re-read confirms new value persisted
      const final = await readDocument(qc, "system", "conflict_orders_dv", "1");
      expect(final.status).toBe("delivered");
    } finally {
      await qc.close();
    }
  });
});
