import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../app";

// Mock @jrdm/exec so unit tests never touch a real Oracle connection
vi.mock("@jrdm/exec", () => ({
  openOracleConnection: vi.fn(),
  deployDdl: vi.fn(),
}));

import { openOracleConnection, deployDdl } from "@jrdm/exec";

const VALID_VIEW = {
  name: "orders_dv",
  schema: "app",
  createMode: "orReplace",
  root: {
    table: "orders",
    permissions: { insert: true, update: true, delete: true },
    etag: "check",
  },
  fields: [{ key: "_id", source: "orders.order_id" }],
};

const VALID_CONNECTION = {
  user: "system",
  password: "secret",
  connectString: "localhost:1521/FREEPDB1",
};

const NESTED_VIEW = {
  name: "orders_dv",
  schema: "app",
  createMode: "orReplace",
  root: {
    table: "orders",
    permissions: { insert: false, update: false, delete: false },
    etag: "check",
  },
  fields: [
    { key: "_id", source: "orders.order_id" },
    {
      key: "items",
      kind: "array",
      table: "order_items",
      permissions: { insert: false, update: false, delete: false },
      fields: [{ key: "sku", source: "order_items.sku" }],
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/deploy — unit (no DB)", () => {
  it("returns 400 on invalid view", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/deploy",
      payload: { view: { name: "bad" } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_view" });
    await app.close();
  });

  it("returns 400 on missing connection when not dryRun", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/deploy",
      payload: { view: VALID_VIEW },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_connection" });
    await app.close();
  });

  it("returns 400 on malformed connection (empty user)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/deploy",
      payload: { view: VALID_VIEW, connection: { user: "", password: "x", connectString: "x" } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_connection" });
    await app.close();
  });

  it("dryRun:true returns SQL without touching DB", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/deploy",
      payload: { view: VALID_VIEW, dryRun: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      dryRun: true,
      sql: expect.stringContaining("CREATE OR REPLACE"),
    });
    expect(openOracleConnection).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 422 on a nested view (UnsupportedFieldError)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/deploy",
      payload: { view: NESTED_VIEW, dryRun: true },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: "unsupported_view" });
    await app.close();
  });

  it("deploys successfully and returns deployed:true", async () => {
    const mockConn = { execute: vi.fn(), commit: vi.fn(), close: vi.fn() };

    vi.mocked(openOracleConnection).mockResolvedValue(mockConn);
    vi.mocked(deployDdl).mockResolvedValue({ statements: 1, errors: [] });

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/deploy",
      payload: { view: VALID_VIEW, connection: VALID_CONNECTION },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ deployed: true, view: "orders_dv" });
    expect(mockConn.close).toHaveBeenCalledTimes(1); // conn.close() in finally
    await app.close();
  });

  it("returns 502 when deployDdl reports errors", async () => {
    const mockConn = { execute: vi.fn(), commit: vi.fn(), close: vi.fn() };

    vi.mocked(openOracleConnection).mockResolvedValue(mockConn);
    vi.mocked(deployDdl).mockResolvedValue({
      statements: 0,
      errors: [{ statementIndex: 0, message: "ORA-00942: table or view does not exist" }],
    });

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/deploy",
      payload: { view: VALID_VIEW, connection: VALID_CONNECTION },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ deployed: false });
    expect(mockConn.close).toHaveBeenCalledTimes(1); // conn.close() in finally even on error
    await app.close();
  });
});
