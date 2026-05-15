import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import oracledb from "oracledb";
import { deployDdl, type Connection } from "../deploy";

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

describe("deployDdl against live Oracle 26ai", () => {
  it("deploys a duality view and serves a sample document", async () => {
    const c = await pool.getConnection();
    const conn = wrap(c);

    const ddl = [
      "CREATE TABLE orders (order_id NUMBER PRIMARY KEY, order_datetime TIMESTAMP NOT NULL)",
      "INSERT INTO orders VALUES (1, SYSTIMESTAMP)",
      "CREATE JSON RELATIONAL DUALITY VIEW orders_dv AS SELECT JSON { '_id' : o.order_id, 'orderTime' : o.order_datetime } FROM orders o",
    ];

    const result = await deployDdl(conn, ddl);
    expect(result.errors).toEqual([]);
    expect(result.statements).toBe(3);

    const sample = await c.execute<{ DATA: string }>(
      "SELECT JSON_SERIALIZE(data) AS data FROM orders_dv FETCH FIRST 1 ROWS ONLY",
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const doc = JSON.parse(sample.rows![0]!.DATA);
    expect(doc._id).toBe(1);
    expect(doc._metadata.etag).toMatch(/^[0-9A-F]+$/);

    await conn.close();
  });
});
