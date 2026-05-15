import { describe, it, expect } from "vitest";
import { buildApp } from "../app";

describe("POST /api/ddl/preview", () => {
  it("returns generated DDL for a valid duality view payload", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ddl/preview",
      payload: {
        view: {
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
        },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      sql: expect.stringContaining("CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW"),
    });
    await app.close();
  });

  it("returns 400 on a schema-invalid payload", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ddl/preview",
      payload: { view: { name: "bad" } },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
