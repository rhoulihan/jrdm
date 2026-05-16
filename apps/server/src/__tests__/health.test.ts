// covers: apps/server/src/app.ts (imports and invokes buildApp)
import { describe, it, expect } from "vitest";
import { buildApp } from "../app";

describe("GET /api/health", () => {
  it("returns 200 and a status payload", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", version: expect.any(String) });
    await app.close();
  });
});
