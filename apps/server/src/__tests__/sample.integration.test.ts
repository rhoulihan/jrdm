/**
 * DoD proof: POST /api/sample → live Oracle → real document with _metadata.etag
 *
 * This test spins Oracle Free via Testcontainers, deploys a duality view via
 * POST /api/deploy, then POSTs to /api/sample and asserts the document shape.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
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

describe("POST /api/sample — server integration", () => {
  it("samples real documents from a deployed duality view with _metadata.etag", async () => {
    const app = await buildApp();

    const connection = {
      user: "system",
      password: "JrdmTest_2026",
      connectString,
    };

    const view = {
      name: "sample_orders_dv",
      schema: "system",
      createMode: "orReplace",
      root: {
        table: "sample_orders",
        permissions: { insert: true, update: true, delete: true },
        etag: "check",
      },
      fields: [
        { key: "_id", source: "sample_orders.order_id" },
        { key: "amount", source: "sample_orders.amount" },
      ],
    };

    // First deploy the table + view via /api/deploy
    const deployRes = await app.inject({
      method: "POST",
      url: "/api/deploy",
      payload: {
        view,
        connection,
        preDdl: [
          "CREATE TABLE sample_orders (order_id NUMBER PRIMARY KEY, amount NUMBER NOT NULL)",
          "INSERT INTO sample_orders VALUES (1, 99.99)",
          "INSERT INTO sample_orders VALUES (2, 49.50)",
          "INSERT INTO sample_orders VALUES (3, 199.00)",
        ],
      },
    });

    expect(deployRes.statusCode, `Deploy failed: ${deployRes.body}`).toBe(200);
    expect(deployRes.json()).toMatchObject({ deployed: true });

    // Now POST /api/sample with limit=2
    const sampleRes = await app.inject({
      method: "POST",
      url: "/api/sample",
      payload: { view, connection, limit: 2 },
    });

    expect(sampleRes.statusCode, `Sample failed: ${sampleRes.body}`).toBe(200);
    const body = sampleRes.json();
    expect(body.documents).toBeDefined();
    expect(Array.isArray(body.documents)).toBe(true);
    expect(body.documents.length).toBeGreaterThan(0);
    expect(body.documents.length).toBeLessThanOrEqual(2);

    const doc = body.documents[0]!;
    expect(doc._id).toBeDefined();
    expect(typeof (doc._metadata as Record<string, unknown>)?.etag).toBe("string");
    expect((doc._metadata as Record<string, unknown>).etag).toMatch(/^[0-9A-F]+$/);

    await app.close();
  });
});
