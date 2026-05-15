import { describe, it, expect } from "vitest";
import { buildApp } from "../app";

describe("POST /api/deploy", () => {
  it("returns dry-run SQL for a valid view payload", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/deploy",
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
          fields: [{ key: "_id", source: "orders.order_id" }],
        },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      dryRun: true,
      sql: expect.stringContaining("CREATE OR REPLACE"),
    });
    await app.close();
  });

  it("returns 400 on invalid view", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/deploy",
      payload: { view: { name: "bad" } },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
