import { describe, it, expect } from "vitest";
import { mapRowsToEntities, normalizeType, type ColumnRow, type KeyRow, type FkRow } from "../map";

const columnRows: ColumnRow[] = [
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
    TABLE_NAME: "ORDERS",
    COLUMN_NAME: "STATUS",
    DATA_TYPE: "VARCHAR2",
    DATA_PRECISION: null,
    DATA_SCALE: null,
    CHAR_LENGTH: 32,
    NULLABLE: "Y",
    DATA_DEFAULT: null,
    COLUMN_ID: 3,
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
];

const keyRows: KeyRow[] = [
  {
    CONSTRAINT_NAME: "PK_ORDERS",
    CONSTRAINT_TYPE: "P",
    TABLE_NAME: "ORDERS",
    COLUMN_NAME: "ORDER_ID",
    POSITION: 1,
  },
  {
    CONSTRAINT_NAME: "PK_CUSTOMERS",
    CONSTRAINT_TYPE: "P",
    TABLE_NAME: "CUSTOMERS",
    COLUMN_NAME: "CUSTOMER_ID",
    POSITION: 1,
  },
];

const fkRows: FkRow[] = [
  {
    CONSTRAINT_NAME: "FK_ORDERS_CUST",
    TABLE_NAME: "ORDERS",
    COLUMN_NAME: "CUSTOMER_ID",
    POSITION: 1,
    REF_TABLE: "CUSTOMERS",
    REF_COLUMN: "CUSTOMER_ID",
    REF_POSITION: 1,
    REF_OWNER: "APP",
  },
];

describe("mapRowsToEntities", () => {
  it("maps tables, columns (types, nullability, length/precision), PK, and FK", () => {
    const { entities } = mapRowsToEntities(
      "APP",
      ["ORDERS", "CUSTOMERS"],
      columnRows,
      keyRows,
      fkRows,
    );
    const orders = entities.find((e) => e.name === "orders")!;
    expect(orders.schema).toBe("app");
    expect(orders.columns.map((c) => c.name)).toEqual(["order_id", "customer_id", "status"]);
    const status = orders.columns.find((c) => c.name === "status")!;
    expect(status).toMatchObject({ type: "VARCHAR2", nullable: true, length: 32 });
    const oid = orders.columns.find((c) => c.name === "order_id")!;
    expect(oid).toMatchObject({ type: "NUMBER", nullable: false, precision: 10, scale: 0 });
    expect(orders.primaryKey).toEqual(["order_id"]);
    expect(orders.foreignKeys).toEqual([
      {
        name: "fk_orders_cust",
        columns: ["customer_id"],
        references: { schema: "app", table: "customers", columns: ["customer_id"] },
      },
    ]);
  });

  it("emits unique keys (constraint type U) as uniqueKeys", () => {
    const uk: KeyRow[] = [
      ...keyRows,
      {
        CONSTRAINT_NAME: "UK_CUST_EMAIL",
        CONSTRAINT_TYPE: "U",
        TABLE_NAME: "CUSTOMERS",
        COLUMN_NAME: "CUSTOMER_ID",
        POSITION: 1,
      },
    ];
    const { entities } = mapRowsToEntities("APP", ["CUSTOMERS"], columnRows, uk, []);
    expect(entities[0]!.uniqueKeys).toEqual([["customer_id"]]);
  });

  it("lower-cases identifiers and orders columns by COLUMN_ID", () => {
    const { entities } = mapRowsToEntities("APP", ["ORDERS"], columnRows, keyRows, []);
    expect(entities[0]!.columns.map((c) => c.name)).toEqual(["order_id", "customer_id", "status"]);
  });

  it("falls back to a synthetic primaryKey-less entity when no PK exists (validator will flag it)", () => {
    const { entities } = mapRowsToEntities("APP", ["ORDERS"], columnRows, [], []);
    expect(entities[0]!.primaryKey).toEqual([]);
  });
});

describe("normalizeType — loud fallback", () => {
  it("returns the mapped type and unmapped:false for a known type", () => {
    expect(normalizeType("NUMBER")).toEqual({ type: "NUMBER", unmapped: false });
  });

  it("strips precision and maps TIMESTAMP(6) without flagging unmapped", () => {
    expect(normalizeType("TIMESTAMP(6)")).toEqual({ type: "TIMESTAMP", unmapped: false });
  });

  it("flags an unknown type as unmapped while still defaulting to VARCHAR2", () => {
    expect(normalizeType("SDO_GEOMETRY")).toEqual({
      type: "VARCHAR2",
      unmapped: true,
      original: "SDO_GEOMETRY",
    });
  });
});

describe("mapRowsToEntities — records unmapped columns", () => {
  it("returns an unmapped list with table+column+original type", () => {
    const cols = [
      {
        TABLE_NAME: "GEO",
        COLUMN_NAME: "SHAPE",
        DATA_TYPE: "SDO_GEOMETRY",
        DATA_PRECISION: null,
        DATA_SCALE: null,
        CHAR_LENGTH: null,
        NULLABLE: "Y",
        DATA_DEFAULT: null,
        COLUMN_ID: 1,
      },
    ];
    const result = mapRowsToEntities("APP", ["GEO"], cols, [], []);
    expect(result.unmapped).toEqual([{ table: "geo", column: "shape", original: "SDO_GEOMETRY" }]);
    expect(result.entities[0]!.columns[0]!.type).toBe("VARCHAR2");
  });
});
