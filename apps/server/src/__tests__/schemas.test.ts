// @tested-by: apps/server/src/__tests__/schemas.test.ts
// exec closure now accepts optional binds (required by QueryExec<T>(sql, binds?) signature)
import { describe, it, expect } from "vitest";
import { buildApp } from "../app";

describe("POST /api/schemas — validation", () => {
  it("400 when body is empty", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/schemas",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_request" });
    await app.close();
  });

  it("400 when connection object is missing", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/schemas",
      payload: { other: "field" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_request" });
    await app.close();
  });

  it("400 when connection fields are empty strings", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/schemas",
      payload: {
        connection: { user: "", password: "", connectString: "" },
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_request" });
    await app.close();
  });

  it("400 when connection.user is missing", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/schemas",
      payload: {
        connection: { password: "pass", connectString: "host:1521/FREEPDB1" },
      },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
