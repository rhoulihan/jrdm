import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { emitSqlJson, MissingLinkError } from "../emit-sql-json";
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

  it("now emits array subquery (kind:array is supported as of Task 4)", () => {
    // arrays are now implemented — emitSqlJson must NOT throw for kind:array
    const sql = emitSqlJson(withArray);
    expect(sql).toContain("'items' : [ SELECT JSON {");
    expect(sql).toContain("FROM order_items oi");
  });

  it("emits the nested array field (no silent omission)", () => {
    const sql = emitSqlJson(withArray);
    expect(sql).toContain("'items'");
    expect(sql).toContain("itemId");
  });

  it("unnest and object kinds (with no link) throw MissingLinkError", () => {
    for (const kind of ["unnest", "object"] as const) {
      const v: DualityView = {
        ...withArray,
        fields: [
          { key: "_id", source: "orders.order_id" },
          { key: "c", kind, table: "customers", fields: [{ key: "cid", source: "customers.id" }] },
        ],
      };
      expect(() => emitSqlJson(v)).toThrow(MissingLinkError);
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

describe("emitSqlJson — nested object & unnest (1:1)", () => {
  const base = (extra: object) => ({
    name: "employee_dv",
    schema: "app",
    createMode: "orReplace" as const,
    root: {
      table: "emp",
      permissions: { insert: true, update: true, delete: true },
      etag: "check" as const,
    },
    fields: [
      { key: "_id", source: "emp.empno" },
      { key: "employeeName", source: "emp.ename" },
      extra,
    ],
  });

  it("emits a nested object subquery with join + dml", () => {
    const view = base({
      key: "dept",
      kind: "object",
      table: "department",
      permissions: { insert: false, update: true, delete: false },
      etag: "check",
      link: ["deptno"],
      fields: [{ key: "deptName", source: "department.dname" }],
    }) as DualityView;
    const sql = emitSqlJson(view);
    expect(sql).toContain("'dept' : ( SELECT JSON {");
    expect(sql).toContain("'deptName' : d.dname");
    expect(sql).toContain("FROM department d WITH UPDATE");
    expect(sql).toContain("WHERE d.deptno = e.deptno )");
  });

  it("emits UNNEST (no key prefix) for kind:unnest", () => {
    const view = base({
      key: "deptFlat",
      kind: "unnest",
      table: "department",
      etag: "check",
      link: ["deptno"],
      fields: [{ key: "deptName", source: "department.dname" }],
    }) as DualityView;
    const sql = emitSqlJson(view);
    expect(sql).toContain("UNNEST ( SELECT JSON {");
    expect(sql).not.toContain("'deptFlat' :");
    expect(sql).toContain("FROM department d");
    expect(sql).toContain("WHERE d.deptno = e.deptno )");
  });

  it("throws MissingLinkError when a nested field has no link", () => {
    const view = base({
      key: "dept",
      kind: "object",
      table: "department",
      etag: "check",
      fields: [{ key: "deptName", source: "department.dname" }],
    }) as DualityView;
    expect(() => emitSqlJson(view)).toThrow(MissingLinkError);
  });
});

describe("emitSqlJson — nested array (1:N) and array-of-array (N:M)", () => {
  it("emits a JSON array subquery for kind:array", () => {
    const view = {
      name: "team_dv",
      schema: "app",
      createMode: "orReplace",
      root: {
        table: "team",
        permissions: { insert: true, update: true, delete: true },
        etag: "check",
      },
      fields: [
        { key: "_id", source: "team.team_id" },
        { key: "name", source: "team.name" },
        {
          key: "driver",
          kind: "array",
          table: "driver",
          permissions: { insert: true, update: true, delete: false },
          etag: "check",
          link: ["team_id"],
          fields: [
            { key: "driverId", source: "driver.driver_id" },
            { key: "name", source: "driver.name", etag: "nocheck" },
          ],
        },
      ],
    } as DualityView;
    const sql = emitSqlJson(view);
    expect(sql).toContain("'driver' : [ SELECT JSON {");
    expect(sql).toContain("'driverId' : d.driver_id");
    expect(sql).toContain("'name' : d.name WITH NOCHECK");
    expect(sql).toContain("FROM driver d WITH INSERT UPDATE");
    expect(sql).toContain("WHERE d.team_id = t.team_id ]");
  });

  it("supports an array nested inside an array (N:M via junction modeled as array-of-array)", () => {
    const view = {
      name: "race_dv",
      schema: "app",
      createMode: "orReplace",
      root: {
        table: "race",
        permissions: { insert: true, update: true, delete: true },
        etag: "check",
      },
      fields: [
        { key: "_id", source: "race.race_id" },
        {
          key: "results",
          kind: "array",
          table: "driver_race_map",
          permissions: { insert: true, update: true, delete: true },
          etag: "check",
          link: ["race_id"],
          fields: [
            { key: "pos", source: "driver_race_map.position" },
            {
              key: "driver",
              kind: "object",
              table: "driver",
              etag: "check",
              link: ["driver_id"],
              fields: [{ key: "name", source: "driver.name" }],
            },
          ],
        },
      ],
    } as DualityView;
    const sql = emitSqlJson(view);
    expect(sql).toContain("'results' : [ SELECT JSON {");
    expect(sql).toContain("'driver' : ( SELECT JSON {");
    // distinct aliases (M1): driver_race_map -> drm, driver -> d, race -> r
    expect(sql).toContain("FROM driver_race_map drm");
    expect(sql).toContain("FROM driver d");
    expect(sql).toContain("FROM race r");
  });
});

describe("emitSqlJson — root etag + replication clause", () => {
  it("emits WITH NOCHECK on the root FROM line when root etag is nocheck", () => {
    const view: DualityView = {
      name: "v_dv",
      schema: "app",
      createMode: "create",
      root: {
        table: "orders",
        permissions: { insert: false, update: false, delete: false },
        etag: "nocheck",
      },
      fields: [{ key: "_id", source: "orders.order_id" }],
    };
    const sql = emitSqlJson(view);
    expect(sql).toContain("FROM orders o WITH NOCHECK;");
  });

  it("appends ENABLE/DISABLE LOGICAL REPLICATION when replication is set", () => {
    const v = (rep: "enable" | "disable"): DualityView => ({
      name: "v_dv",
      schema: "app",
      createMode: "create",
      replication: rep,
      root: {
        table: "orders",
        permissions: { insert: false, update: false, delete: false },
        etag: "check",
      },
      fields: [{ key: "_id", source: "orders.order_id" }],
    });
    expect(emitSqlJson(v("enable"))).toContain("ENABLE LOGICAL REPLICATION");
    expect(emitSqlJson(v("disable"))).toContain("DISABLE LOGICAL REPLICATION");
  });
});
