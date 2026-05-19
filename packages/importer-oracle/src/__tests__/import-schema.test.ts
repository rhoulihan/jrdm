/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect } from "vitest";
import { importSchema, type QueryExec } from "../import-schema";
import { TABLES_SQL, COLUMNS_SQL, PK_UK_SQL, FK_SQL } from "../dictionary-sql";

const fakeExec: QueryExec = async <T>(
  sql: string,
  _binds?: Record<string, unknown>,
): Promise<T[]> => {
  if (sql === TABLES_SQL) return [{ TABLE_NAME: "ORDERS" }, { TABLE_NAME: "CUSTOMERS" }] as T[];
  if (sql === COLUMNS_SQL)
    return [
      {
        TABLE_NAME: "ORDERS",
        COLUMN_NAME: "ORDER_ID",
        DATA_TYPE: "NUMBER",
        DATA_PRECISION: 10,
        DATA_SCALE: 0,
        CHAR_LENGTH: 0,
        NULLABLE: "N",
        DATA_DEFAULT: null,
        COLUMN_ID: 1,
      },
      {
        TABLE_NAME: "ORDERS",
        COLUMN_NAME: "CUSTOMER_ID",
        DATA_TYPE: "NUMBER",
        DATA_PRECISION: 10,
        DATA_SCALE: 0,
        CHAR_LENGTH: 0,
        NULLABLE: "N",
        DATA_DEFAULT: null,
        COLUMN_ID: 2,
      },
      {
        TABLE_NAME: "CUSTOMERS",
        COLUMN_NAME: "CUSTOMER_ID",
        DATA_TYPE: "NUMBER",
        DATA_PRECISION: 10,
        DATA_SCALE: 0,
        CHAR_LENGTH: 0,
        NULLABLE: "N",
        DATA_DEFAULT: null,
        COLUMN_ID: 1,
      },
    ] as T[];
  if (sql === PK_UK_SQL)
    return [
      {
        CONSTRAINT_NAME: "PK_ORDERS",
        CONSTRAINT_TYPE: "P",
        TABLE_NAME: "ORDERS",
        COLUMN_NAME: "ORDER_ID",
        POSITION: 1,
      },
      {
        CONSTRAINT_NAME: "PK_CUST",
        CONSTRAINT_TYPE: "P",
        TABLE_NAME: "CUSTOMERS",
        COLUMN_NAME: "CUSTOMER_ID",
        POSITION: 1,
      },
    ] as T[];
  if (sql === FK_SQL)
    return [
      {
        CONSTRAINT_NAME: "FK_O_C",
        TABLE_NAME: "ORDERS",
        COLUMN_NAME: "CUSTOMER_ID",
        POSITION: 1,
        REF_TABLE: "CUSTOMERS",
        REF_COLUMN: "CUSTOMER_ID",
        REF_POSITION: 1,
        REF_OWNER: "APP",
      } as T,
    ] as T[];
  return [] as T[];
};

describe("importSchema", () => {
  it("produces a validated Project with entities and a derived 1:N relationship", async () => {
    const result = await importSchema(fakeExec, { schemaOwner: "APP", projectName: "imported" });
    expect(result.project.name).toBe("imported");
    expect(result.project.entities.map((e) => e.name).sort()).toEqual(["customers", "orders"]);
    expect(result.relationships).toContainEqual(
      expect.objectContaining({ name: "fk_o_c", cardinality: "1:N" }),
    );
    expect(result.project.views).toEqual([]);
  });

  it("the returned project passes ProjectSchema validation (round-trips through serde)", async () => {
    const { stringifyProject, parseProject } = await import("@jrdm/model");
    const { project } = await importSchema(fakeExec, {
      schemaOwner: "APP",
      projectName: "imported",
    });
    expect(parseProject(stringifyProject(project))).toEqual(project);
  });

  it("passes { owner: schemaOwner } binds to every dictionary exec call", async () => {
    const calls: Array<{ sql: string; binds: Record<string, unknown> | undefined }> = [];
    const spyExec: QueryExec = async <T>(
      sql: string,
      binds?: Record<string, unknown>,
    ): Promise<T[]> => {
      calls.push({ sql, binds });
      return await fakeExec<T>(sql, binds);
    };
    await importSchema(spyExec, { schemaOwner: "ORDERS_DEMO", projectName: "test" });

    // All four dictionary queries must have been called
    expect(calls).toHaveLength(4);

    // Every call must carry { owner: "ORDERS_DEMO" }
    for (const call of calls) {
      expect(call.binds).toEqual({ owner: "ORDERS_DEMO" });
    }

    // Verify the actual SQL constants are used (ALL_* views, not USER_*)
    const sqls = calls.map((c) => c.sql);
    expect(sqls).toContain(TABLES_SQL);
    expect(sqls).toContain(COLUMNS_SQL);
    expect(sqls).toContain(PK_UK_SQL);
    expect(sqls).toContain(FK_SQL);
    expect(TABLES_SQL).toContain("ALL_TABLES");
    expect(COLUMNS_SQL).toContain("ALL_TAB_COLUMNS");
    expect(PK_UK_SQL).toContain("ALL_CONSTRAINTS");
    expect(FK_SQL).toContain("ALL_CONSTRAINTS");
  });

  it("surfaces validator issues without throwing and returns a valid DraftProject", async () => {
    const { DraftProjectSchema } = await import("@jrdm/model");
    const noPkExec: QueryExec = async <T>(
      sql: string,
      _binds?: Record<string, unknown>,
    ): Promise<T[]> => {
      if (sql === TABLES_SQL) return [{ TABLE_NAME: "ORDERS" }] as T[];
      if (sql === COLUMNS_SQL)
        return [
          {
            TABLE_NAME: "ORDERS",
            COLUMN_NAME: "ORDER_ID",
            DATA_TYPE: "NUMBER",
            DATA_PRECISION: 10,
            DATA_SCALE: 0,
            CHAR_LENGTH: 0,
            NULLABLE: "N",
            DATA_DEFAULT: null,
            COLUMN_ID: 1,
          },
        ] as T[];
      return [] as T[];
    };
    const { project, issues } = await importSchema(noPkExec, {
      schemaOwner: "APP",
      projectName: "p",
    });
    expect(issues.some((i) => i.code === "PK_REQUIRED")).toBe(true);
    expect(DraftProjectSchema.safeParse(project).success).toBe(true);
  });

  it("emits an UNMAPPED_TYPE warning issue for unknown Oracle column types", async () => {
    const exec: QueryExec = async <T>(
      sql: string,
      _binds?: Record<string, unknown>,
    ): Promise<T[]> => {
      if (sql === TABLES_SQL) return [{ TABLE_NAME: "GEO" }] as T[];
      if (sql === COLUMNS_SQL)
        return [
          {
            TABLE_NAME: "GEO",
            COLUMN_NAME: "ID",
            DATA_TYPE: "NUMBER",
            DATA_PRECISION: 10,
            DATA_SCALE: 0,
            CHAR_LENGTH: 0,
            NULLABLE: "N",
            DATA_DEFAULT: null,
            COLUMN_ID: 1,
          },
          {
            TABLE_NAME: "GEO",
            COLUMN_NAME: "SHAPE",
            DATA_TYPE: "SDO_GEOMETRY",
            DATA_PRECISION: null,
            DATA_SCALE: null,
            CHAR_LENGTH: null,
            NULLABLE: "Y",
            DATA_DEFAULT: null,
            COLUMN_ID: 2,
          },
        ] as T[];
      if (sql === PK_UK_SQL)
        return [
          {
            CONSTRAINT_NAME: "PK_GEO",
            CONSTRAINT_TYPE: "P",
            TABLE_NAME: "GEO",
            COLUMN_NAME: "ID",
            POSITION: 1,
          },
        ] as T[];
      return [] as T[];
    };
    const { issues } = await importSchema(exec, { schemaOwner: "APP", projectName: "p" });
    const u = issues.find((i) => i.code === "UNMAPPED_TYPE");
    expect(u).toBeDefined();
    expect(u!.severity).toBe("warning");
    expect(u!.message).toContain("SDO_GEOMETRY");
    expect(u!.message).toContain("shape");
  });
});
