import { describe, it, expect } from "vitest";
import { buildApp } from "../app";

const view = {
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
    { key: "status", source: "orders.order_status" },
  ],
};

describe("POST /api/ddl/preview", () => {
  it("defaults to SQL/JSON when no syntax given", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/api/ddl/preview", payload: { view } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("sql");
    expect(res.json().sql).toContain("JSON RELATIONAL DUALITY VIEW");
    await app.close();
  });

  it("returns graphql when syntax=graphql", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ddl/preview",
      payload: { view, syntax: "graphql" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().graphql).toContain("orders @insert @update @delete {");
    await app.close();
  });

  it("400 on invalid view", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ddl/preview",
      payload: { view: { bad: true } },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("422 when a nested field is missing its link", async () => {
    const app = await buildApp();
    const bad = {
      ...view,
      fields: [
        { key: "_id", source: "orders.order_id" },
        {
          key: "items",
          kind: "array",
          table: "order_items",
          etag: "check",
          fields: [{ key: "n", source: "order_items.name" }],
        },
      ],
    };
    const res = await app.inject({
      method: "POST",
      url: "/api/ddl/preview",
      payload: { view: bad },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: "unsupported_view" });
    await app.close();
  });
});
