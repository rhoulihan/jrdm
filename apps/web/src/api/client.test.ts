import { describe, it, expect, vi, afterEach } from "vitest";
import { importOracle } from "./client";

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
