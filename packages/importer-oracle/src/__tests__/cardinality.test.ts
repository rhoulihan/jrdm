import { describe, it, expect } from "vitest";
import { classifyCardinality } from "../cardinality";
import type { Entity } from "@jrdm/model";

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
      name: "fk_o_c",
      columns: ["customer_id"],
      references: { schema: "app", table: "customers", columns: ["customer_id"] },
    },
  ],
};

describe("classifyCardinality", () => {
  it("returns 1:N for an ordinary child FK", () => {
    const result = classifyCardinality([customers, orders]);
    expect(result.relationships).toContainEqual(
      expect.objectContaining({ name: "fk_o_c", cardinality: "1:N" }),
    );
    expect(result.junctions).toEqual([]);
  });

  it("detects a pure junction table as an N:M between its two referenced tables", () => {
    const products: Entity = {
      name: "products",
      schema: "app",
      columns: [{ name: "product_id", type: "NUMBER", nullable: false }],
      primaryKey: ["product_id"],
    };
    const orderItems: Entity = {
      name: "order_items",
      schema: "app",
      columns: [
        { name: "order_id", type: "NUMBER", nullable: false },
        { name: "product_id", type: "NUMBER", nullable: false },
      ],
      primaryKey: ["order_id", "product_id"],
      foreignKeys: [
        {
          name: "fk_oi_o",
          columns: ["order_id"],
          references: { schema: "app", table: "orders", columns: ["order_id"] },
        },
        {
          name: "fk_oi_p",
          columns: ["product_id"],
          references: { schema: "app", table: "products", columns: ["product_id"] },
        },
      ],
    };
    const result = classifyCardinality([customers, orders, products, orderItems]);
    expect(result.junctions).toContainEqual(
      expect.objectContaining({
        table: "order_items",
        between: ["orders", "products"],
      }),
    );
  });

  it("does NOT classify a table with extra non-key columns as a junction", () => {
    const orderItems: Entity = {
      name: "order_items",
      schema: "app",
      columns: [
        { name: "order_id", type: "NUMBER", nullable: false },
        { name: "product_id", type: "NUMBER", nullable: false },
        { name: "qty", type: "NUMBER", nullable: false },
      ],
      primaryKey: ["order_id", "product_id"],
      foreignKeys: [
        {
          name: "fk_oi_o",
          columns: ["order_id"],
          references: { schema: "app", table: "orders", columns: ["order_id"] },
        },
        {
          name: "fk_oi_p",
          columns: ["product_id"],
          references: { schema: "app", table: "products", columns: ["product_id"] },
        },
      ],
    };
    const result = classifyCardinality([orders, orderItems]);
    expect(result.junctions).toEqual([]);
  });
});
