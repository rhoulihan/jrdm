import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { emitSqlJson, UnsupportedFieldError } from "../emit-sql-json";
import type { DualityView } from "@jrdm/model";

const here = dirname(fileURLToPath(import.meta.url));
const golden = (name: string) => readFileSync(resolve(here, "__golden__", name), "utf8").trim();

const readOnly: DualityView = {
  name: "orders_dv",
  schema: "app",
  createMode: "create",
  root: {
    table: "orders",
    permissions: { insert: false, update: false, delete: false },
    etag: "check",
  },
  fields: [
    { key: "_id", source: "orders.order_id" },
    { key: "orderTime", source: "orders.order_datetime" },
  ],
};

describe("emitSqlJson — minimal read-only view", () => {
  it("emits CREATE without OR REPLACE", () => {
    const sql = emitSqlJson(readOnly);
    expect(sql).toContain("CREATE JSON RELATIONAL DUALITY VIEW app.orders_dv");
    expect(sql).not.toContain("OR REPLACE");
  });

  it("emits the _id field first", () => {
    const sql = emitSqlJson(readOnly);
    const idIdx = sql.indexOf("'_id'");
    const otherIdx = sql.indexOf("'orderTime'");
    expect(idIdx).toBeGreaterThan(-1);
    expect(idIdx).toBeLessThan(otherIdx);
  });

  it("does not include any WITH INSERT/UPDATE/DELETE clauses for a read-only view", () => {
    const sql = emitSqlJson(readOnly);
    expect(sql).not.toMatch(/WITH\s+(INSERT|UPDATE|DELETE)/);
  });

  it("ends with the FROM clause referring to the root table", () => {
    const sql = emitSqlJson(readOnly);
    expect(sql.trim().endsWith("FROM orders o;")).toBe(true);
  });
});

describe("emitSqlJson — DML annotations", () => {
  it("emits WITH INSERT UPDATE DELETE on full-write root", () => {
    const v: DualityView = {
      ...readOnly,
      root: { ...readOnly.root, permissions: { insert: true, update: true, delete: true } },
    };
    const sql = emitSqlJson(v);
    expect(sql.trim().endsWith("FROM orders o WITH INSERT UPDATE DELETE;")).toBe(true);
  });

  it("emits WITH INSERT only when only insert is true", () => {
    const v: DualityView = {
      ...readOnly,
      root: { ...readOnly.root, permissions: { insert: true, update: false, delete: false } },
    };
    expect(emitSqlJson(v)).toContain("WITH INSERT;");
  });

  it("emits OR REPLACE when createMode is orReplace", () => {
    const v: DualityView = { ...readOnly, createMode: "orReplace" };
    expect(emitSqlJson(v)).toContain("CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW");
  });

  it("I3: createMode type no longer includes ifNotExists; create emits bare CREATE", () => {
    const v: DualityView = {
      name: "orders_dv",
      schema: "app",
      createMode: "create",
      root: {
        table: "orders",
        permissions: { insert: false, update: false, delete: false },
        etag: "check",
      },
      fields: [{ key: "_id", source: "orders.order_id" }],
    };
    const sql = emitSqlJson(v);
    expect(sql).toContain("CREATE JSON RELATIONAL DUALITY VIEW app.orders_dv");
    expect(sql).not.toContain("OR REPLACE");
    expect(sql).not.toContain("IF NOT EXISTS");
  });

  it("uses initials alias for underscore-delimited table names", () => {
    const v: DualityView = {
      ...readOnly,
      root: { ...readOnly.root, table: "order_items" },
      fields: [{ key: "_id", source: "order_items.id" }],
    };
    const sql = emitSqlJson(v);
    expect(sql).toContain("FROM order_items oi");
  });
});

describe("C1: nested fields are a loud error, never silently dropped", () => {
  const withArray: DualityView = {
    name: "orders_dv",
    schema: "app",
    createMode: "orReplace",
    root: {
      table: "orders",
      permissions: { insert: true, update: true, delete: true },
      etag: "check",
    },
    fields: [
      { key: "_id", source: "orders.order_id" },
      {
        key: "items",
        kind: "array",
        table: "order_items",
        permissions: { insert: true, update: true, delete: false },
        etag: "check",
        link: ["order_id"],
        fields: [{ key: "itemId", source: "order_items.line_item_id" }],
      },
    ],
  };

  it("throws UnsupportedFieldError naming the field and kind", () => {
    expect(() => emitSqlJson(withArray)).toThrow(UnsupportedFieldError);
    try {
      emitSqlJson(withArray);
    } catch (e) {
      expect((e as Error).message).toContain("items");
      expect((e as Error).message).toContain("array");
    }
  });

  it("does NOT emit a degenerate view that omits the nested field", () => {
    let out = "";
    try {
      out = emitSqlJson(withArray);
    } catch {
      /* expected */
    }
    expect(out).toBe(""); // never produced a silently-wrong view
  });

  it("unnest and object kinds also throw", () => {
    for (const kind of ["unnest", "object"] as const) {
      const v: DualityView = {
        ...withArray,
        fields: [
          { key: "_id", source: "orders.order_id" },
          { key: "c", kind, table: "customers", fields: [{ key: "cid", source: "customers.id" }] },
        ],
      };
      expect(() => emitSqlJson(v)).toThrow(UnsupportedFieldError);
    }
  });

  it("still emits a pure-scalar view correctly (regression)", () => {
    const scalarOnly: DualityView = {
      name: "orders_dv",
      schema: "app",
      createMode: "orReplace",
      root: {
        table: "orders",
        permissions: { insert: true, update: true, delete: true },
        etag: "check",
      },
      fields: [
        { key: "_id", source: "orders.order_id" },
        { key: "orderTime", source: "orders.order_datetime" },
        { key: "orderStatus", source: "orders.order_status" },
      ],
    };
    expect(emitSqlJson(scalarOnly)).toContain("CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW");
  });
});

describe("emitSqlJson — golden file", () => {
  it("matches orders_dv.sql byte-for-byte", () => {
    const view: DualityView = {
      name: "orders_dv",
      schema: "app",
      createMode: "orReplace",
      root: {
        table: "orders",
        permissions: { insert: true, update: true, delete: true },
        etag: "check",
      },
      fields: [
        { key: "_id", source: "orders.order_id" },
        { key: "orderTime", source: "orders.order_datetime" },
        { key: "orderStatus", source: "orders.order_status" },
      ],
    };
    expect(emitSqlJson(view).trim()).toBe(golden("orders_dv.sql"));
  });
});

describe("emitSqlJson — alias context (M1 regression)", () => {
  it("still emits the scalar golden unchanged (single root table)", () => {
    const view: DualityView = {
      name: "orders_dv",
      schema: "app",
      createMode: "orReplace",
      root: {
        table: "orders",
        permissions: { insert: true, update: true, delete: true },
        etag: "check",
      },
      fields: [
        { key: "_id", source: "orders.order_id" },
        { key: "orderTime", source: "orders.order_datetime" },
        { key: "orderStatus", source: "orders.order_status" },
      ],
    };
    const sql = emitSqlJson(view);
    expect(sql).toContain("FROM orders o WITH INSERT UPDATE DELETE;");
    expect(sql).toContain("'_id' : o.order_id");
  });

  it("emits WITH NOUPDATE for a noupdate scalar field", () => {
    const view: DualityView = {
      name: "orders_dv",
      schema: "app",
      createMode: "orReplace",
      root: {
        table: "orders",
        permissions: { insert: true, update: true, delete: true },
        etag: "check",
      },
      fields: [{ key: "_id", source: "orders.order_id", noupdate: true }],
    };
    expect(emitSqlJson(view)).toContain("WITH NOUPDATE");
  });

  it("emits WITH NOCHECK for a field with etag nocheck", () => {
    const view: DualityView = {
      name: "orders_dv",
      schema: "app",
      createMode: "orReplace",
      root: {
        table: "orders",
        permissions: { insert: true, update: true, delete: true },
        etag: "check",
      },
      fields: [{ key: "_id", source: "orders.order_id", etag: "nocheck" }],
    };
    expect(emitSqlJson(view)).toContain("WITH NOCHECK");
  });

  it("handles a source with no dot (bare column name)", () => {
    const view: DualityView = {
      name: "orders_dv",
      schema: "app",
      createMode: "orReplace",
      root: {
        table: "orders",
        permissions: { insert: true, update: true, delete: true },
        etag: "check",
      },
      fields: [{ key: "_id", source: "order_id" }],
    };
    expect(emitSqlJson(view)).toContain("'_id' : o.order_id");
  });
});
