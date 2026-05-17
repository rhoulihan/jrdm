import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../app";

// Mock @jrdm/exec so unit tests never touch a real Oracle connection
vi.mock("@jrdm/exec", () => ({
  openQueryConnection: vi.fn(),
  sampleDocuments: vi.fn(),
}));

import { openQueryConnection, sampleDocuments } from "@jrdm/exec";

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

// A nested view with no link — triggers MissingLinkError from emitSqlJson
const NESTED_VIEW_NO_LINK = {
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
      // no link → MissingLinkError
    },
  ],
};

const VALID_CONNECTION = {
  user: "system",
  password: "secret",
  connectString: "localhost:1521/FREEPDB1",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/sample — unit (no DB)", () => {
  it("returns 400 on missing view", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sample",
      payload: { connection: VALID_CONNECTION },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_view" });
    await app.close();
  });

  it("returns 400 on invalid view shape", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sample",
      payload: { view: { name: "bad" }, connection: VALID_CONNECTION },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_view" });
    await app.close();
  });

  it("returns 422 on a nested view with missing link (MissingLinkError → unsupported_view)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sample",
      payload: { view: NESTED_VIEW_NO_LINK, connection: VALID_CONNECTION },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: "unsupported_view" });
    await app.close();
  });

  it("returns 400 on missing connection", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sample",
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
      url: "/api/sample",
      payload: {
        view: VALID_VIEW,
        connection: { user: "", password: "x", connectString: "x" },
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_connection" });
    await app.close();
  });

  it("returns { documents } on success and closes connection", async () => {
    const mockQc = {
      query: vi.fn(),
      execute: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(openQueryConnection).mockResolvedValue(mockQc);
    vi.mocked(sampleDocuments).mockResolvedValue([{ _id: 1, _metadata: { etag: "ABCD" } }]);

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sample",
      payload: { view: VALID_VIEW, connection: VALID_CONNECTION },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ documents: [{ _id: 1 }] });
    expect(mockQc.close).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("returns 502 sample_failed on Oracle error and closes connection", async () => {
    const mockQc = {
      query: vi.fn(),
      execute: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(openQueryConnection).mockResolvedValue(mockQc);
    vi.mocked(sampleDocuments).mockRejectedValue(new Error("ORA-00942: table not found"));

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sample",
      payload: { view: VALID_VIEW, connection: VALID_CONNECTION },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: "sample_failed" });
    expect(mockQc.close).toHaveBeenCalledTimes(1);
    await app.close();
  });
});
