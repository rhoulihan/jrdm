/**
 * DoD proof: POST /api/schemas → live Oracle → returns non-system schemas.
 *
 * Spins Oracle Free via Testcontainers, creates a non-system user with a table,
 * then POSTs to /api/schemas and asserts:
 *   - the created user's schema appears in the response
 *   - Oracle-maintained schemas (e.g. SYS) do NOT appear
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

  // Create a non-system user with at least one table so it appears in the schema list
  const sys = await oracledb.getConnection({
    user: "system",
    password: "JrdmTest_2026",
    connectString,
  });
  await sys.execute(`CREATE USER schemalist_test IDENTIFIED BY Sl_2026`);
  await sys.execute(`GRANT CONNECT, RESOURCE, UNLIMITED TABLESPACE TO schemalist_test`);
  await sys.execute(
    `CREATE TABLE schemalist_test.items (item_id NUMBER PRIMARY KEY, label VARCHAR2(100) NOT NULL)`,
  );
  await sys.commit();
  await sys.close();
}, 300_000);

afterAll(async () => {
  if (container) await container.stop({ timeout: 30_000 });
});

describe("POST /api/schemas — server integration (live Oracle)", () => {
  it("returns the created non-system schema and excludes Oracle-maintained schemas", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/schemas",
      payload: {
        connection: {
          user: "system",
          password: "JrdmTest_2026",
          connectString,
        },
      },
    });

    expect(res.statusCode, `POST /api/schemas failed: ${res.body}`).toBe(200);

    const body = res.json();
    expect(Array.isArray(body.schemas)).toBe(true);

    // The user we created (with a table) must appear
    expect(body.schemas).toContain("SCHEMALIST_TEST");

    // Oracle-maintained schemas must NOT appear
    expect(body.schemas).not.toContain("SYS");
    expect(body.schemas).not.toContain("SYSTEM");
    expect(body.schemas).not.toContain("ORACLE_OCM");

    // Results must be sorted
    const sorted = [...body.schemas].sort();
    expect(body.schemas).toEqual(sorted);

    await app.close();
  });
});
