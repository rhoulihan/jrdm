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

  const sys = await oracledb.getConnection({
    user: "system",
    password: "JrdmTest_2026",
    connectString,
  });
  await sys.execute(`CREATE USER impsrv IDENTIFIED BY Imp_2026`);
  await sys.execute(`GRANT CONNECT, RESOURCE, UNLIMITED TABLESPACE TO impsrv`);
  await sys.execute(
    `CREATE TABLE impsrv.customers (customer_id NUMBER PRIMARY KEY, full_name VARCHAR2(200) NOT NULL)`,
  );
  await sys.execute(
    `CREATE TABLE impsrv.orders (
       order_id NUMBER PRIMARY KEY,
       customer_id NUMBER NOT NULL,
       CONSTRAINT fk_o_c FOREIGN KEY (customer_id) REFERENCES impsrv.customers(customer_id)
     )`,
  );
  await sys.commit();
  await sys.close();
}, 300_000);

afterAll(async () => {
  if (container) await container.stop({ timeout: 30_000 });
});

describe("POST /api/import/oracle — server integration (live Oracle)", () => {
  it("reverse-engineers the schema through the server and returns a valid Project", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/import/oracle",
      payload: {
        connection: { user: "impsrv", password: "Imp_2026", connectString },
        schemaOwner: "IMPSRV",
        projectName: "imported",
      },
    });
    expect(res.statusCode).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = res.json() as {
      project: { entities: { name: string; foreignKeys?: unknown[] }[] };
      relationships: { cardinality: string }[];
      issues: unknown[];
    };
    expect(body.project.entities.map((e) => e.name).sort()).toEqual(["customers", "orders"]);
    expect(body.relationships.some((r) => r.cardinality === "1:N")).toBe(true);
    expect(body.issues).toEqual([]);
    await app.close();
  });
});
