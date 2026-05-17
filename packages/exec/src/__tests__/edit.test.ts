import { describe, it, expect, vi } from "vitest";
import {
  readDocSql,
  writeDocSql,
  etagOf,
  stripMetadata,
  EtagMissingError,
  readDocument,
  writeDocument,
} from "../edit";
import type { QueryConnection } from "../query";

describe("readDocSql", () => {
  it("builds exact SELECT with JSON_VALUE predicate", () => {
    expect(readDocSql("app", "orders_dv")).toBe(
      "SELECT JSON_SERIALIZE(data PRETTY) AS DOC FROM app.orders_dv WHERE JSON_VALUE(data,'$._id') = :id",
    );
  });

  it("uses the given schema and view name", () => {
    const sql = readDocSql("myschema", "my_view_dv");
    expect(sql).toContain("FROM myschema.my_view_dv");
    expect(sql).toContain("JSON_VALUE(data,'$._id') = :id");
  });
});

describe("writeDocSql", () => {
  it("builds exact UPDATE with aliased table and named binds", () => {
    expect(writeDocSql("app", "orders_dv")).toBe(
      "UPDATE app.orders_dv v SET data = :doc WHERE JSON_VALUE(v.data,'$._id') = :id",
    );
  });

  it("uses the given schema and view name", () => {
    const sql = writeDocSql("myschema", "my_view_dv");
    expect(sql).toContain("UPDATE myschema.my_view_dv v");
    expect(sql).toContain("SET data = :doc");
    expect(sql).toContain("JSON_VALUE(v.data,'$._id') = :id");
  });
});

describe("etagOf", () => {
  it("reads _metadata.etag from a doc", () => {
    expect(etagOf({ _metadata: { etag: "AB" } })).toBe("AB");
  });

  it("throws EtagMissingError when _metadata is absent", () => {
    expect(() => etagOf({})).toThrow(EtagMissingError);
  });

  it("throws EtagMissingError when _metadata.etag is undefined", () => {
    expect(() => etagOf({ _metadata: {} })).toThrow(EtagMissingError);
  });

  it("EtagMissingError has the correct name", () => {
    let err: unknown;
    try {
      etagOf({});
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(EtagMissingError);
    expect((err as EtagMissingError).name).toBe("EtagMissingError");
  });

  it("EtagMissingError message includes EtagMissingError prefix", () => {
    let err: unknown;
    try {
      etagOf({});
    } catch (e) {
      err = e;
    }
    expect((err as EtagMissingError).message).toMatch(/EtagMissingError/);
  });
});

describe("stripMetadata", () => {
  it("removes _metadata from the clone", () => {
    const doc = { _id: 1, name: "foo", _metadata: { etag: "AB" } };
    const stripped = stripMetadata(doc);
    expect(stripped).toEqual({ _id: 1, name: "foo" });
    expect(stripped).not.toHaveProperty("_metadata");
  });

  it("does not mutate the original doc", () => {
    const doc = { _id: 1, _metadata: { etag: "AB" } };
    stripMetadata(doc);
    expect(doc._metadata).toBeDefined();
  });

  it("works on a doc with no _metadata (noop)", () => {
    const doc = { _id: 2, name: "bar" };
    expect(stripMetadata(doc)).toEqual({ _id: 2, name: "bar" });
  });
});

function makeQc(overrides: Partial<QueryConnection> = {}): QueryConnection {
  return {
    query: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue(0),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("readDocument (mocked QueryConnection)", () => {
  it("returns parsed document from first row", async () => {
    const doc = { _id: 1, status: "ok", _metadata: { etag: "AA" } };
    const qc = makeQc({
      query: vi.fn().mockResolvedValue([{ DOC: JSON.stringify(doc) }]),
    });
    const result = await readDocument(qc, "app", "orders_dv", 1);
    expect(result).toEqual(doc);
    expect(qc.query).toHaveBeenCalledWith(readDocSql("app", "orders_dv"), { id: "1" });
  });

  it("throws when no rows returned", async () => {
    const qc = makeQc({ query: vi.fn().mockResolvedValue([]) });
    await expect(readDocument(qc, "app", "orders_dv", 42)).rejects.toThrow("not found");
  });
});

describe("writeDocument (mocked QueryConnection)", () => {
  it("calls execute with serialized doc and id binds, then reads back for new etag", async () => {
    const oldDoc = { _id: 1, status: "pending", _metadata: { etag: "OLD" } };
    const freshDoc = { _id: 1, status: "shipped", _metadata: { etag: "NEW" } };

    const queryMock = vi.fn().mockResolvedValueOnce([{ DOC: JSON.stringify(freshDoc) }]); // re-read after write
    const executeMock = vi.fn().mockResolvedValue(1);

    const qc = makeQc({ query: queryMock, execute: executeMock });

    const result = await writeDocument(qc, "app", "orders_dv", 1, oldDoc);
    expect(result.etag).toBe("NEW");
    expect(executeMock).toHaveBeenCalledWith(writeDocSql("app", "orders_dv"), {
      doc: JSON.stringify(oldDoc),
      id: "1",
    });
  });

  it("throws when rowsAffected is 0 (doc not found)", async () => {
    const qc = makeQc({ execute: vi.fn().mockResolvedValue(0) });
    await expect(
      writeDocument(qc, "app", "orders_dv", 99, { _id: 99, _metadata: { etag: "X" } }),
    ).rejects.toThrow("not updated");
  });
});
