import { describe, it, expect } from "vitest";
import { mapRowsToEntities, type ColumnRow, type KeyRow, type FkRow } from "../map";

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
    const entities = mapRowsToEntities("APP", ["ORDERS", "CUSTOMERS"], columnRows, keyRows, fkRows);
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
    const entities = mapRowsToEntities("APP", ["CUSTOMERS"], columnRows, uk, []);
    expect(entities[0]!.uniqueKeys).toEqual([["customer_id"]]);
  });

  it("lower-cases identifiers and orders columns by COLUMN_ID", () => {
    const entities = mapRowsToEntities("APP", ["ORDERS"], columnRows, keyRows, []);
    expect(entities[0]!.columns.map((c) => c.name)).toEqual(["order_id", "customer_id", "status"]);
  });

  it("falls back to a synthetic primaryKey-less entity when no PK exists (validator will flag it)", () => {
    const entities = mapRowsToEntities("APP", ["ORDERS"], columnRows, [], []);
    expect(entities[0]!.primaryKey).toEqual([]);
  });
});
