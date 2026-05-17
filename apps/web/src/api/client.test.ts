import { describe, it, expect, vi, afterEach } from "vitest";
import { importOracle, fetchDdlPreview } from "./client";
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
