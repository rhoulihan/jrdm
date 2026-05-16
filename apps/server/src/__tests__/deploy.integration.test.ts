/**
 * DoD #3 proof: POST /api/deploy → live Oracle → JSON_SERIALIZE round-trip with _metadata.etag
 *
 * This test spins Oracle Free 26ai via Testcontainers, POSTs to /api/deploy through the real
 * Fastify app, and then queries the deployed duality view to assert the document shape.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import oracledb from "oracledb";
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

describe("POST /api/deploy — server integration (DoD #3)", () => {
  it("deploys a duality view through the server and round-trips a document with _metadata.etag", async () => {
    const app = await buildApp();

    const payload = {
      view: {
        name: "orders_dv",
        schema: "system",
        createMode: "orReplace",
        root: {
          table: "orders",
          permissions: { insert: true, update: true, delete: true },
          etag: "check",
        },
        fields: [
          { key: "_id", source: "orders.order_id" },
          { key: "orderTime", source: "orders.order_datetime" },
        ],
      },
      connection: {
        user: "system",
        password: "JrdmTest_2026",
        connectString,
      },
      preDdl: [
        "CREATE TABLE orders (order_id NUMBER PRIMARY KEY, order_datetime TIMESTAMP NOT NULL)",
        "INSERT INTO orders VALUES (1, SYSTIMESTAMP)",
      ],
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/deploy",
      payload,
    });

    expect(res.statusCode, `Deploy failed: ${res.body}`).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ deployed: true, view: "orders_dv" });

    // Now verify the deployed view via a direct oracledb query
    const conn = await oracledb.getConnection({
      user: "system",
      password: "JrdmTest_2026",
      connectString,
    });

    try {
      const result = await conn.execute<{ DATA: string }>(
        "SELECT JSON_SERIALIZE(data) AS data FROM system.orders_dv FETCH FIRST 1 ROWS ONLY",
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const doc = JSON.parse(result.rows![0]!.DATA);
      expect(doc._id).toBe(1);
      expect(doc._metadata.etag).toMatch(/^[0-9A-F]+$/);
    } finally {
      await conn.close();
      await app.close();
    }
  });
});
