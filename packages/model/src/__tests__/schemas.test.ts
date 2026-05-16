// covers: packages/model/src/types.ts (via ColumnSchema which uses SUPPORTED_TYPES)
import { describe, it, expect } from "vitest";
import { ColumnSchema, EntitySchema, ForeignKeySchema, type Entity } from "../schemas";

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

describe("ForeignKeySchema", () => {
  it("accepts a valid single-column FK", () => {
    const fk = {
      name: "fk_orders_customer",
      columns: ["customer_id"],
      references: { schema: "app", table: "customers", columns: ["customer_id"] },
    };
    expect(ForeignKeySchema.safeParse(fk).success).toBe(true);
  });

  it("requires equal local and referenced column counts", () => {
    const fk = {
      name: "fk_bad",
      columns: ["a", "b"],
      references: { schema: "app", table: "t", columns: ["a"] },
    };
    expect(ForeignKeySchema.safeParse(fk).success).toBe(false);
  });

  it("requires at least one column", () => {
    const fk = {
      name: "fk_empty",
      columns: [],
      references: { schema: "app", table: "t", columns: [] },
    };
    expect(ForeignKeySchema.safeParse(fk).success).toBe(false);
  });
});

describe("EntitySchema with foreignKeys", () => {
  const base = {
    name: "orders",
    schema: "app",
    columns: [
      { name: "order_id", type: "NUMBER", nullable: false },
      { name: "customer_id", type: "NUMBER", nullable: false },
    ],
    primaryKey: ["order_id"],
  };

  it("accepts an entity whose FK columns exist", () => {
    const e = {
      ...base,
      foreignKeys: [
        {
          name: "fk_orders_customer",
          columns: ["customer_id"],
          references: { schema: "app", table: "customers", columns: ["customer_id"] },
        },
      ],
    };
    expect(EntitySchema.safeParse(e).success).toBe(true);
  });

  it("rejects an entity whose FK references a non-existent local column", () => {
    const e = {
      ...base,
      foreignKeys: [
        {
          name: "fk_bad",
          columns: ["does_not_exist"],
          references: { schema: "app", table: "customers", columns: ["customer_id"] },
        },
      ],
    };
    expect(EntitySchema.safeParse(e).success).toBe(false);
  });
});
