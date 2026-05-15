import { describe, it, expect } from "vitest";
import { ColumnSchema, EntitySchema, type Entity } from "../schemas";

describe("ColumnSchema", () => {
  it("accepts a minimal valid column", () => {
    const result = ColumnSchema.safeParse({
      name: "order_id",
      type: "NUMBER",
      nullable: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts every supported Oracle type", () => {
    const types = [
      "JSON",
      "BLOB",
      "CLOB",
      "NCLOB",
      "VARCHAR2",
      "NVARCHAR2",
      "CHAR",
      "NCHAR",
      "RAW",
      "BOOLEAN",
      "DATE",
      "TIMESTAMP",
      "TIMESTAMP WITH TIME ZONE",
      "INTERVAL YEAR TO MONTH",
      "INTERVAL DAY TO SECOND",
      "NUMBER",
      "BINARY_DOUBLE",
      "BINARY_FLOAT",
      "VECTOR",
    ];
    for (const type of types) {
      const result = ColumnSchema.safeParse({ name: "c", type, nullable: true });
      expect(result.success, `type ${type}`).toBe(true);
    }
  });

  it("rejects an unsupported type", () => {
    const result = ColumnSchema.safeParse({ name: "c", type: "XMLTYPE", nullable: true });
    expect(result.success).toBe(false);
  });

  it("requires a name", () => {
    const result = ColumnSchema.safeParse({ type: "NUMBER", nullable: true });
    expect(result.success).toBe(false);
  });
});

describe("EntitySchema", () => {
  const validEntity: Entity = {
    name: "orders",
    schema: "app",
    columns: [
      { name: "order_id", type: "NUMBER", nullable: false },
      { name: "order_datetime", type: "TIMESTAMP", nullable: false },
    ],
    primaryKey: ["order_id"],
  };

  it("accepts a valid entity", () => {
    expect(EntitySchema.safeParse(validEntity).success).toBe(true);
  });

  it("requires at least one column", () => {
    const result = EntitySchema.safeParse({ ...validEntity, columns: [] });
    expect(result.success).toBe(false);
  });

  it("requires the primary-key columns to exist on the entity", () => {
    const result = EntitySchema.safeParse({ ...validEntity, primaryKey: ["nonexistent"] });
    expect(result.success).toBe(false);
  });

  it("allows composite primary keys", () => {
    const composite = {
      ...validEntity,
      primaryKey: ["order_id", "order_datetime"],
    };
    expect(EntitySchema.safeParse(composite).success).toBe(true);
  });
});
