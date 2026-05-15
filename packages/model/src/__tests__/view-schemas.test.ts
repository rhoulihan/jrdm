import { describe, it, expect } from "vitest";
import { DualityViewSchema, type DualityView } from "../schemas";

const minimalView: DualityView = {
  name: "orders_dv",
  schema: "app",
  createMode: "orReplace",
  root: {
    table: "orders",
    permissions: { insert: true, update: true, delete: true },
    etag: "check",
  },
  fields: [
    { key: "_id", source: "orders.order_id" },
    { key: "orderTime", source: "orders.order_datetime" },
  ],
};

describe("DualityViewSchema", () => {
  it("accepts a minimal valid duality view", () => {
    expect(DualityViewSchema.safeParse(minimalView).success).toBe(true);
  });

  it("requires the first field to be _id", () => {
    const view = { ...minimalView, fields: minimalView.fields.slice(1) };
    expect(DualityViewSchema.safeParse(view).success).toBe(false);
  });

  it("accepts permissions defaulting to all false (read-only)", () => {
    const ro = {
      ...minimalView,
      root: { ...minimalView.root, permissions: { insert: false, update: false, delete: false } },
    };
    expect(DualityViewSchema.safeParse(ro).success).toBe(true);
  });

  it("accepts nested array fields", () => {
    const nested = {
      ...minimalView,
      fields: [
        ...minimalView.fields,
        {
          key: "items",
          kind: "array" as const,
          table: "order_items",
          permissions: { insert: true, update: true, delete: false },
          etag: "check" as const,
          link: ["order_id"],
          fields: [{ key: "itemId", source: "order_items.line_item_id" }],
        },
      ],
    };
    expect(DualityViewSchema.safeParse(nested).success).toBe(true);
  });

  it("rejects fields with missing source on scalar nodes", () => {
    const broken = {
      ...minimalView,
      fields: [{ key: "_id", source: "orders.order_id" }, { key: "broken" }],
    };
    expect(DualityViewSchema.safeParse(broken).success).toBe(false);
  });
});
