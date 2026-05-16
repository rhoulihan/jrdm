import { describe, it, expect } from "vitest";
import { emitGraphql } from "../emit-graphql";
import type { DualityView } from "@jrdm/model";

const scalarView: DualityView = {
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
    { key: "status", source: "orders.order_status", etag: "nocheck" },
    { key: "total", source: "orders.total", noupdate: true },
  ],
};

describe("emitGraphql — root + scalars", () => {
  it("emits CREATE OR REPLACE ... AS <table> <root-anns> { fields }", () => {
    const g = emitGraphql(scalarView);
    expect(g).toContain("CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW app.orders_dv AS");
    expect(g).toContain("orders @insert @update @delete {");
    expect(g).toContain("_id : order_id");
    expect(g).toContain("orderTime : order_datetime");
  });

  it("emits @nocheck for nocheck-etag scalars and @noupdate for noupdate", () => {
    const g = emitGraphql(scalarView);
    expect(g).toContain("status : order_status @nocheck");
    expect(g).toContain("total : total @noupdate");
  });

  it("read-only root emits no @insert/@update/@delete", () => {
    const ro: DualityView = {
      ...scalarView,
      root: {
        table: "orders",
        permissions: { insert: false, update: false, delete: false },
        etag: "check",
      },
    };
    const g = emitGraphql(ro);
    expect(g).toContain("orders {");
    expect(g).not.toContain("@insert");
  });

  it("emits plain CREATE (no OR REPLACE) for createMode create", () => {
    const g = emitGraphql({ ...scalarView, createMode: "create" });
    expect(g).toContain("CREATE JSON RELATIONAL DUALITY VIEW app.orders_dv AS");
    expect(g).not.toContain("OR REPLACE");
  });
});

describe("emitGraphql — nested fields", () => {
  it("emits object nested field with @link", () => {
    const view: DualityView = {
      ...scalarView,
      fields: [
        { key: "_id", source: "orders.order_id" },
        {
          key: "customer",
          kind: "object",
          table: "customers",
          permissions: { insert: false, update: true, delete: false },
          link: ["customer_id"],
          fields: [{ key: "name", source: "customers.cust_name" }],
        },
      ],
    };
    const g = emitGraphql(view);
    expect(g).toContain('customer : customers @update @link(to : ["customer_id"])');
    expect(g).toContain("name : cust_name");
  });

  it("emits array nested field with @link", () => {
    const view: DualityView = {
      ...scalarView,
      fields: [
        { key: "_id", source: "orders.order_id" },
        {
          key: "items",
          kind: "array",
          table: "order_items",
          permissions: { insert: true, update: true, delete: true },
          link: ["order_id"],
          fields: [{ key: "sku", source: "order_items.sku" }],
        },
      ],
    };
    const g = emitGraphql(view);
    expect(g).toContain('items : order_items @insert @update @delete @link(to : ["order_id"]) [ {');
    expect(g).toContain("sku : sku");
  });

  it("emits unnest nested field with @unnest", () => {
    const view: DualityView = {
      ...scalarView,
      fields: [
        { key: "_id", source: "orders.order_id" },
        {
          key: "addr",
          kind: "unnest",
          table: "addresses",
          link: ["address_id"],
          fields: [{ key: "city", source: "addresses.city" }],
        },
      ],
    };
    const g = emitGraphql(view);
    expect(g).toContain('addr : addresses @unnest @link(to : ["address_id"])');
    expect(g).toContain("city : city");
  });

  it("throws MissingLinkError when link is missing on nested field", () => {
    const view: DualityView = {
      ...scalarView,
      fields: [
        {
          key: "items",
          kind: "array",
          table: "order_items",
          link: [],
          fields: [{ key: "sku", source: "order_items.sku" }],
        },
      ],
    };
    expect(() => emitGraphql(view)).toThrow("items");
  });
});
