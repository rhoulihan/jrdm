import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../app";

// Mock @jrdm/exec so unit tests never touch a real Oracle connection
vi.mock("@jrdm/exec", () => ({
  openQueryConnection: vi.fn(),
  readDocument: vi.fn(),
  writeDocument: vi.fn(),
  isEtagConflict: vi.fn(),
}));

import { openQueryConnection, readDocument, writeDocument, isEtagConflict } from "@jrdm/exec";

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

const VALID_DOC = {
  _id: 42,
  amount: 100,
  _metadata: { etag: "AABBCCDD" },
};

beforeEach(() => {
  vi.resetAllMocks();
});

// ── POST /api/document/read ────────────────────────────────────────────────

describe("POST /api/document/read — unit (no DB)", () => {
  it("returns 400 on missing view", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/document/read",
      payload: { connection: VALID_CONNECTION, id: "1" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_view" });
    await app.close();
  });

  it("returns 400 on invalid view shape", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/document/read",
      payload: { view: { name: "bad" }, connection: VALID_CONNECTION, id: "1" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_view" });
    await app.close();
  });

  it("returns 422 on a nested view with missing link (MissingLinkError → unsupported_view)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/document/read",
      payload: { view: NESTED_VIEW_NO_LINK, connection: VALID_CONNECTION, id: "1" },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: "unsupported_view" });
    await app.close();
  });

  it("returns 400 on missing connection", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/document/read",
      payload: { view: VALID_VIEW, id: "1" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_connection" });
    await app.close();
  });

  it("returns 400 on missing id", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/document/read",
      payload: { view: VALID_VIEW, connection: VALID_CONNECTION },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_body" });
    await app.close();
  });

  it("returns { document } on success and closes connection", async () => {
    const mockQc = {
      query: vi.fn(),
      execute: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(openQueryConnection).mockResolvedValue(mockQc);
    vi.mocked(readDocument).mockResolvedValue(VALID_DOC);

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/document/read",
      payload: { view: VALID_VIEW, connection: VALID_CONNECTION, id: "42" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ document: { _id: 42 } });
    expect(mockQc.close).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("returns 502 document_read_failed on Oracle error and closes connection", async () => {
    const mockQc = {
      query: vi.fn(),
      execute: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(openQueryConnection).mockResolvedValue(mockQc);
    vi.mocked(readDocument).mockRejectedValue(new Error("ORA-00942: table not found"));

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/document/read",
      payload: { view: VALID_VIEW, connection: VALID_CONNECTION, id: "42" },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: "document_read_failed" });
    expect(mockQc.close).toHaveBeenCalledTimes(1);
    await app.close();
  });
});

// ── POST /api/document/write ───────────────────────────────────────────────

describe("POST /api/document/write — unit (no DB)", () => {
  it("returns 400 on missing view", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/document/write",
      payload: { connection: VALID_CONNECTION, id: "42", doc: VALID_DOC },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_view" });
    await app.close();
  });

  it("returns 422 on a nested view with missing link", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/document/write",
      payload: {
        view: NESTED_VIEW_NO_LINK,
        connection: VALID_CONNECTION,
        id: "42",
        doc: VALID_DOC,
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: "unsupported_view" });
    await app.close();
  });

  it("returns 400 on missing connection", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/document/write",
      payload: { view: VALID_VIEW, id: "42", doc: VALID_DOC },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_connection" });
    await app.close();
  });

  it("returns 400 on missing id", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/document/write",
      payload: { view: VALID_VIEW, connection: VALID_CONNECTION, doc: VALID_DOC },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_body" });
    await app.close();
  });

  it("returns 400 on missing doc", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/document/write",
      payload: { view: VALID_VIEW, connection: VALID_CONNECTION, id: "42" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_body" });
    await app.close();
  });

  it("returns 200 with document on success and closes connection", async () => {
    const mockQc = {
      query: vi.fn(),
      execute: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(openQueryConnection).mockResolvedValue(mockQc);
    vi.mocked(writeDocument).mockResolvedValue({ etag: "NEWETAG1" });
    vi.mocked(readDocument).mockResolvedValue({
      ...VALID_DOC,
      amount: 200,
      _metadata: { etag: "NEWETAG1" },
    });
    vi.mocked(isEtagConflict).mockReturnValue(false);

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/document/write",
      payload: {
        view: VALID_VIEW,
        connection: VALID_CONNECTION,
        id: "42",
        doc: { ...VALID_DOC, amount: 200 },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ document: { _metadata: { etag: "NEWETAG1" } } });
    expect(mockQc.close).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("returns 409 etag_conflict when isEtagConflict(e) is true and closes connection", async () => {
    const mockQc = {
      query: vi.fn(),
      execute: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(openQueryConnection).mockResolvedValue(mockQc);
    const conflictErr = new Error("ORA-42699: ETag mismatch");
    vi.mocked(writeDocument).mockRejectedValue(conflictErr);
    vi.mocked(isEtagConflict).mockReturnValue(true);

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/document/write",
      payload: {
        view: VALID_VIEW,
        connection: VALID_CONNECTION,
        id: "42",
        doc: VALID_DOC,
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: "etag_conflict" });
    expect(mockQc.close).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("returns 502 document_write_failed on non-conflict Oracle error and closes connection", async () => {
    const mockQc = {
      query: vi.fn(),
      execute: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(openQueryConnection).mockResolvedValue(mockQc);
    vi.mocked(writeDocument).mockRejectedValue(new Error("ORA-00942: table not found"));
    vi.mocked(isEtagConflict).mockReturnValue(false);

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/document/write",
      payload: {
        view: VALID_VIEW,
        connection: VALID_CONNECTION,
        id: "42",
        doc: VALID_DOC,
      },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: "document_write_failed" });
    expect(mockQc.close).toHaveBeenCalledTimes(1);
    await app.close();
  });
});
