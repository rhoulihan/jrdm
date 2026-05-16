/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import oracledb from "oracledb";
import { openOracleConnection } from "@jrdm/exec";
import { importSchema, type QueryExec } from "../import-schema";

let container: StartedTestContainer;
let connectString: string;

beforeAll(async () => {
  container = await new GenericContainer("container-registry.oracle.com/database/free:latest-lite")
    .withExposedPorts(1521)
    .withEnvironment({ ORACLE_PWD: "JrdmTest_2026" })
    .withWaitStrategy(Wait.forLogMessage("DATABASE IS READY TO USE!", 1))
    .withStartupTimeout(240_000)
    .start();
  const host = container.getHost();
  const port = container.getMappedPort(1521);
  connectString = `${host}:${port}/FREEPDB1`;

  const sys = await oracledb.getConnection({
    user: "system",
    password: "JrdmTest_2026",
    connectString,
  });
  await sys.execute(`CREATE USER impuser IDENTIFIED BY Imp_2026`);
  await sys.execute(`GRANT CONNECT, RESOURCE, UNLIMITED TABLESPACE TO impuser`);
  await sys.execute(
    `CREATE TABLE impuser.customers (customer_id NUMBER PRIMARY KEY, full_name VARCHAR2(200) NOT NULL)`,
  );
  await sys.execute(
    `CREATE TABLE impuser.orders (
       order_id NUMBER PRIMARY KEY,
       customer_id NUMBER NOT NULL,
       status VARCHAR2(32),
       CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES impuser.customers(customer_id)
     )`,
  );
  await sys.commit();
  await sys.close();
}, 300_000);

afterAll(async () => {
  if (container) await container.stop({ timeout: 30_000 });
});

describe("importSchema against live Oracle 26ai", () => {
  it("reverse-engineers a 2-table schema with a 1:N FK relationship", async () => {
    const conn = await openOracleConnection({
      user: "impuser",
      password: "Imp_2026",
      connectString,
    });
    const c = (conn as unknown as { _raw?: oracledb.Connection })._raw;
    // openOracleConnection wraps execute(sql) -> { rowsAffected }. We need rows.
    // Use a thin QueryExec via a fresh oracledb connection for SELECTs:
    const direct = await oracledb.getConnection({
      user: "impuser",
      password: "Imp_2026",
      connectString,
    });
    const exec: QueryExec = async <T>(sql: string): Promise<T[]> => {
      const r = await direct.execute<T>(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows ?? [];
    };

    const { project, relationships, issues } = await importSchema(exec, {
      schemaOwner: "IMPUSER",
      projectName: "imported",
    });

    expect(project.entities.map((e) => e.name).sort()).toEqual(["customers", "orders"]);
    const orders = project.entities.find((e) => e.name === "orders")!;
    expect(orders.primaryKey).toEqual(["order_id"]);
    expect(orders.foreignKeys?.[0]).toMatchObject({
      columns: ["customer_id"],
      references: { table: "customers", columns: ["customer_id"] },
    });
    expect(relationships).toContainEqual(
      expect.objectContaining({
        cardinality: "1:N",
        to: expect.objectContaining({ table: "customers" }),
      }),
    );
    expect(issues).toEqual([]);

    await direct.close();
    await conn.close();
    void c;
  });
});
