import { describe, it, expect } from "vitest";
import { importSchema, type QueryExec } from "../import-schema";
import { TABLES_SQL, COLUMNS_SQL, PK_UK_SQL, FK_SQL } from "../dictionary-sql";

// eslint-disable-next-line @typescript-eslint/require-await
const fakeExec: QueryExec = async <T>(sql: string): Promise<T[]> => {
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

  it("surfaces validator issues without throwing and returns a valid DraftProject", async () => {
    const { DraftProjectSchema } = await import("@jrdm/model");
    // eslint-disable-next-line @typescript-eslint/require-await
    const noPkExec: QueryExec = async <T>(sql: string): Promise<T[]> => {
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
});
