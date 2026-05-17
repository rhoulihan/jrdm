import { describe, it, expect, vi, afterEach } from "vitest";
import {
  importOracle,
  fetchDdlPreview,
  deployView,
  sampleDocuments,
  readDocument,
  writeDocument,
  createSandbox,
  dropSandbox,
  ApiError,
} from "./client";
import type { DualityView } from "@jrdm/model";

afterEach(() => vi.restoreAllMocks());

const body = {
  connection: { user: "u", password: "p", connectString: "h:1521/FREEPDB1" },
  schemaOwner: "APP",
  projectName: "imported",
};

describe("importOracle", () => {
  it("POSTs to /api/import/oracle and returns the payload on 200", async () => {
    const payload = {
      project: { name: "imported", version: "0.1.0", entities: [], views: [] },
      relationships: [],
      issues: [],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }))),
    );
    const result = await importOracle(body);
    expect(result.project.name).toBe("imported");
    const call = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
    expect(call[0]).toBe("/api/import/oracle");
  });

  it("throws ApiError with status + message on 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: "invalid_request" }), { status: 400 }),
        ),
      ),
    );
    await expect(importOracle(body)).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });

  it("throws ApiError on 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: "import_failed", message: "ORA-12541" }), {
            status: 502,
          }),
        ),
      ),
    );
    await expect(importOracle(body)).rejects.toMatchObject({ status: 502 });
  });
});

const view: DualityView = {
  name: "orders_dv",
  schema: "app",
  createMode: "orReplace",
  root: {
    table: "orders",
    permissions: { insert: true, update: true, delete: true },
    etag: "check",
  },
  fields: [{ key: "_id", source: "orders.id" }],
};

const conn = { user: "u", password: "p", connectString: "h:1521/FREEPDB1" };

describe("fetchDdlPreview", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns sql for syntax=sql (default)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ sql: "CREATE ..." }), { status: 200 })),
      ),
    );
    const r = await fetchDdlPreview(view, "sql");
    expect(r).toEqual({ kind: "sql", ddl: "CREATE ..." });
  });

  it("returns graphql for syntax=graphql", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ graphql: "orders { }" }), { status: 200 })),
      ),
    );
    const r = await fetchDdlPreview(view, "graphql");
    expect(r).toEqual({ kind: "graphql", ddl: "orders { }" });
  });

  it("throws ApiError(422) with message on unsupported_view", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ error: "unsupported_view", message: "MissingLinkError: ..." }),
            {
              status: 422,
            },
          ),
        ),
      ),
    );
    await expect(fetchDdlPreview(view, "sql")).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
    });
  });

  it("throws ApiError(400) on invalid view", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ error: "invalid view" }), { status: 400 })),
      ),
    );
    await expect(fetchDdlPreview(view, "sql")).rejects.toMatchObject({ status: 400 });
  });

  it("fetchDdlPreview sends {view,syntax} body", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ sql: "X" }), { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await fetchDdlPreview(view, "sql");
    const calls = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const sent = JSON.parse((calls[0]![1] as { body: string }).body) as { syntax: string };
    expect(sent.syntax).toBe("sql");
  });
});

describe("deployView", () => {
  it("POSTs to /api/deploy and returns success payload", async () => {
    const payload = { deployed: true, statements: 3, view: "orders_dv" };
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }))),
    );
    const r = await deployView(view, conn);
    expect(r).toEqual(payload);
    const call = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
    expect(call[0]).toBe("/api/deploy");
    expect((call[1] as RequestInit).method).toBe("POST");
  });

  it("includes preDdl in the request body when provided", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ deployed: true, statements: 2 }), { status: 200 }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await deployView(view, conn, ["CREATE TABLE t (id NUMBER)"]);
    const calls = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const sent = JSON.parse((calls[0]![1] as { body: string }).body) as { preDdl: string[] };
    expect(sent.preDdl).toEqual(["CREATE TABLE t (id NUMBER)"]);
  });

  it("throws ApiError(400) on invalid request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ error: "invalid_view" }), { status: 400 })),
      ),
    );
    await expect(deployView(view, conn)).rejects.toMatchObject({ name: "ApiError", status: 400 });
  });

  it("throws ApiError(502) on Oracle error and preserves message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ error: "deploy_failed", message: "ORA-00955: name already exists" }),
            { status: 502 },
          ),
        ),
      ),
    );
    const err = await deployView(view, conn).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(502);
    expect((err as ApiError).message).toBe("ORA-00955: name already exists");
  });
});

describe("sampleDocuments", () => {
  it("POSTs to /api/sample and returns documents", async () => {
    const docs = [
      { _id: 1, name: "order1" },
      { _id: 2, name: "order2" },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ documents: docs }), { status: 200 })),
      ),
    );
    const r = await sampleDocuments(view, conn);
    expect(r).toEqual({ documents: docs });
    const call = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
    expect(call[0]).toBe("/api/sample");
    expect((call[1] as RequestInit).method).toBe("POST");
  });

  it("sends limit=5 by default", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ documents: [] }), { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await sampleDocuments(view, conn);
    const calls = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const sent = JSON.parse((calls[0]![1] as { body: string }).body) as { limit: number };
    expect(sent.limit).toBe(5);
  });

  it("throws ApiError on non-ok response using message field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: "sample_failed", message: "View not found" }), {
            status: 502,
          }),
        ),
      ),
    );
    const err = await sampleDocuments(view, conn).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(502);
    expect((err as ApiError).message).toBe("View not found");
  });
});

describe("readDocument", () => {
  it("POSTs to /api/document/read and returns document", async () => {
    const doc = { _id: 1, name: "order1", _metadata: { etag: "ABCDEF" } };
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ document: doc }), { status: 200 })),
      ),
    );
    const r = await readDocument(view, conn, 1);
    expect(r).toEqual({ document: doc });
    const call = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
    expect(call[0]).toBe("/api/document/read");
    expect((call[1] as RequestInit).method).toBe("POST");
  });

  it("throws ApiError on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ error: "not_found" }), { status: 404 })),
      ),
    );
    await expect(readDocument(view, conn, 999)).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
    });
  });
});

describe("writeDocument", () => {
  const doc = { _id: 1, name: "updated", _metadata: { etag: "ABCDEF" } };

  it("POSTs to /api/document/write and returns updated document", async () => {
    const updatedDoc = { _id: 1, name: "updated", _metadata: { etag: "NEW123" } };
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ document: updatedDoc }), { status: 200 })),
      ),
    );
    const r = await writeDocument(view, conn, 1, doc);
    expect(r).toEqual({ document: updatedDoc });
    const call = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
    expect(call[0]).toBe("/api/document/write");
    expect((call[1] as RequestInit).method).toBe("POST");
  });

  it("throws ApiError(409) on conflict — CRITICAL: status===409 for conflict UX", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ error: "etag_conflict", message: "ORA-42699: etag mismatch" }),
            { status: 409 },
          ),
        ),
      ),
    );
    const err = await writeDocument(view, conn, 1, doc).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    expect((err as ApiError).message).toBe("ORA-42699: etag mismatch");
  });

  it("throws ApiError(502) on Oracle error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ error: "document_write_failed", message: "DB connection lost" }),
            { status: 502 },
          ),
        ),
      ),
    );
    await expect(writeDocument(view, conn, 1, doc)).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
    });
  });
});

describe("createSandbox", () => {
  it("POSTs to /api/sandbox and returns created schema info", async () => {
    const payload = { created: true, schema: "JRDM_PROJ_MYPROJECT" };
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }))),
    );
    const r = await createSandbox(conn, "myproject", "s3cr3t");
    expect(r).toEqual(payload);
    const call = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
    expect(call[0]).toBe("/api/sandbox");
    expect((call[1] as RequestInit).method).toBe("POST");
  });

  it("throws ApiError on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: "sandbox_create_failed" }), { status: 502 }),
        ),
      ),
    );
    await expect(createSandbox(conn, "proj", "pwd")).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
    });
  });
});

describe("dropSandbox", () => {
  it("sends DELETE to /api/sandbox and returns dropped schema info", async () => {
    const payload = { dropped: true, schema: "JRDM_PROJ_MYPROJECT" };
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }))),
    );
    const r = await dropSandbox(conn, "myproject");
    expect(r).toEqual(payload);
    const call = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
    expect(call[0]).toBe("/api/sandbox");
    expect((call[1] as RequestInit).method).toBe("DELETE");
  });

  it("throws ApiError on non-ok response using error field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: "sandbox_drop_failed" }), { status: 502 }),
        ),
      ),
    );
    const err = await dropSandbox(conn, "proj").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(502);
    expect((err as ApiError).message).toBe("sandbox_drop_failed");
  });
});
