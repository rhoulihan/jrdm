/**
 * DoD proof: POST /api/document/read + /api/document/write → live Oracle → ETag round-trip + 409 conflict
 *
 * This test spins Oracle Free via Testcontainers, deploys a duality view WITH UPDATE,
 * then exercises:
 *   1. read → mutate → write → 200 with new etag
 *   2. write with the STALE original doc → 409 etag_conflict (genuine ORA-42699 round-trip)
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

describe("POST /api/document/read + /api/document/write — server integration", () => {
  it("read → mutate → write → new etag, then stale write → 409 etag_conflict", async () => {
    const app = await buildApp();

    const connection = {
      user: "system",
      password: "JrdmTest_2026",
      connectString,
    };

    const view = {
      name: "doc_orders_dv",
      schema: "system",
      createMode: "orReplace",
      root: {
        table: "doc_orders",
        permissions: { insert: true, update: true, delete: true },
        etag: "check",
      },
      fields: [
        { key: "_id", source: "doc_orders.order_id" },
        { key: "amount", source: "doc_orders.amount" },
      ],
    };

    // Deploy the table + view WITH UPDATE via /api/deploy
    const deployRes = await app.inject({
      method: "POST",
      url: "/api/deploy",
      payload: {
        view,
        connection,
        preDdl: [
          "CREATE TABLE doc_orders (order_id NUMBER PRIMARY KEY, amount NUMBER NOT NULL)",
          "INSERT INTO doc_orders VALUES (1, 99.99)",
        ],
      },
    });

    expect(deployRes.statusCode, `Deploy failed: ${deployRes.body}`).toBe(200);
    expect(deployRes.json()).toMatchObject({ deployed: true });

    // Step 1: Read the document
    const readRes = await app.inject({
      method: "POST",
      url: "/api/document/read",
      payload: { view, connection, id: "1" },
    });

    expect(readRes.statusCode, `Read failed: ${readRes.body}`).toBe(200);
    const readBody = readRes.json();
    expect(readBody.document).toBeDefined();
    expect(readBody.document._id).toBe(1);
    const originalDoc = readBody.document as Record<string, unknown>;
    const originalEtag = (originalDoc._metadata as Record<string, unknown>)?.etag as string;
    expect(typeof originalEtag).toBe("string");
    expect(originalEtag).toMatch(/^[0-9A-F]+$/);

    // Step 2: Mutate and write — amount 99.99 → 149.99
    const mutatedDoc = { ...originalDoc, amount: 149.99 };
    const writeRes = await app.inject({
      method: "POST",
      url: "/api/document/write",
      payload: { view, connection, id: "1", doc: mutatedDoc },
    });

    expect(writeRes.statusCode, `Write failed: ${writeRes.body}`).toBe(200);
    const writeBody = writeRes.json();
    expect(writeBody.document).toBeDefined();
    const newDoc = writeBody.document as Record<string, unknown>;
    const newEtag = (newDoc._metadata as Record<string, unknown>)?.etag as string;
    expect(typeof newEtag).toBe("string");
    expect(newEtag).toMatch(/^[0-9A-F]+$/);
    // ETag must have advanced
    expect(newEtag).not.toBe(originalEtag);

    // Confirm the new value was persisted
    const verifyRes = await app.inject({
      method: "POST",
      url: "/api/document/read",
      payload: { view, connection, id: "1" },
    });
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json().document.amount).toBe(149.99);

    // Step 3: Write with the STALE original doc (original _metadata.etag) → must be 409
    const staleWriteRes = await app.inject({
      method: "POST",
      url: "/api/document/write",
      payload: { view, connection, id: "1", doc: originalDoc },
    });

    expect(
      staleWriteRes.statusCode,
      `Expected 409 but got ${staleWriteRes.statusCode}: ${staleWriteRes.body}`,
    ).toBe(409);
    const conflictBody = staleWriteRes.json();
    expect(conflictBody.error).toBe("etag_conflict");
    expect(typeof conflictBody.message).toBe("string");
    // Confirm the Oracle error code is surfaced
    expect(conflictBody.message).toMatch(/ORA-42699/);

    await app.close();
  });
});
