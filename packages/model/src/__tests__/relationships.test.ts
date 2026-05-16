import { describe, it, expect } from "vitest";
import { deriveRelationships } from "../relationships";
import type { Entity } from "../schemas";

const customers: Entity = {
  name: "customers",
  schema: "app",
  columns: [{ name: "customer_id", type: "NUMBER", nullable: false }],
  primaryKey: ["customer_id"],
};

const orders: Entity = {
  name: "orders",
  schema: "app",
  columns: [
    { name: "order_id", type: "NUMBER", nullable: false },
    { name: "customer_id", type: "NUMBER", nullable: false },
  ],
  primaryKey: ["order_id"],
  foreignKeys: [
    {
      name: "fk_orders_customer",
      columns: ["customer_id"],
      references: { schema: "app", table: "customers", columns: ["customer_id"] },
    },
  ],
};

describe("deriveRelationships", () => {
  it("derives a 1:N relationship from a non-unique FK", () => {
    const rels = deriveRelationships([customers, orders]);
    expect(rels).toEqual([
      {
        name: "fk_orders_customer",
        from: { schema: "app", table: "orders", columns: ["customer_id"] },
        to: { schema: "app", table: "customers", columns: ["customer_id"] },
        cardinality: "1:N",
      },
    ]);
  });

  it("derives 1:1 when the FK columns are a unique key on the child", () => {
    const profile: Entity = {
      name: "customer_profile",
      schema: "app",
      columns: [
        { name: "profile_id", type: "NUMBER", nullable: false },
        { name: "customer_id", type: "NUMBER", nullable: false },
      ],
      primaryKey: ["profile_id"],
      uniqueKeys: [["customer_id"]],
      foreignKeys: [
        {
          name: "fk_profile_customer",
          columns: ["customer_id"],
          references: { schema: "app", table: "customers", columns: ["customer_id"] },
        },
      ],
    };
    const rels = deriveRelationships([customers, profile]);
    expect(rels[0]?.cardinality).toBe("1:1");
  });

  it("returns [] when there are no foreign keys", () => {
    expect(deriveRelationships([customers])).toEqual([]);
  });

  it("ignores FKs whose referenced table is not in the entity set (dangling)", () => {
    const rels = deriveRelationships([orders]); // customers absent
    expect(rels).toEqual([]);
  });
});
