import { describe, it, expect } from "vitest";
import { emitGraphql } from "../emit-graphql";
import type { DualityView } from "@jrdm/model";
import { MissingLinkError } from "../emit-sql-json";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __d = dirname(fileURLToPath(import.meta.url));
const gold = (f: string) => readFileSync(join(__d, "__golden__", f), "utf8");

const scalarView: DualityView = {
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
    { key: "status", source: "orders.order_status", etag: "nocheck" },
    { key: "total", source: "orders.total", noupdate: true },
  ],
};

describe("emitGraphql — root + scalars", () => {
  it("emits CREATE OR REPLACE ... AS <table> <root-anns> { fields }", () => {
    const g = emitGraphql(scalarView);
    expect(g).toContain("CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW app.orders_dv AS");
    expect(g).toContain("orders @insert @update @delete {");
    expect(g).toContain("_id : order_id");
    expect(g).toContain("orderTime : order_datetime");
  });

  it("emits @nocheck for nocheck-etag scalars and @noupdate for noupdate", () => {
    const g = emitGraphql(scalarView);
    expect(g).toContain("status : order_status @nocheck");
    expect(g).toContain("total : total @noupdate");
  });

  it("read-only root emits no @insert/@update/@delete", () => {
    const ro: DualityView = {
      ...scalarView,
      root: {
        table: "orders",
        permissions: { insert: false, update: false, delete: false },
        etag: "check",
      },
    };
    const g = emitGraphql(ro);
    expect(g).toContain("orders {");
    expect(g).not.toContain("@insert");
  });

  it("emits plain CREATE (no OR REPLACE) for createMode create", () => {
    const g = emitGraphql({ ...scalarView, createMode: "create" });
    expect(g).toContain("CREATE JSON RELATIONAL DUALITY VIEW app.orders_dv AS");
    expect(g).not.toContain("OR REPLACE");
  });
});

describe("emitGraphql — nested fields", () => {
  it("emits object nested field with @link", () => {
    const view: DualityView = {
      ...scalarView,
      fields: [
        { key: "_id", source: "orders.order_id" },
        {
          key: "customer",
          kind: "object",
          table: "customers",
          permissions: { insert: false, update: true, delete: false },
          link: ["customer_id"],
          fields: [{ key: "name", source: "customers.cust_name" }],
        },
      ],
    };
    const g = emitGraphql(view);
    expect(g).toContain('customer : customers @update @link(to : ["customer_id"])');
    expect(g).toContain("name : cust_name");
  });

  it("emits array nested field with @link", () => {
    const view: DualityView = {
      ...scalarView,
      fields: [
        { key: "_id", source: "orders.order_id" },
        {
          key: "items",
          kind: "array",
          table: "order_items",
          permissions: { insert: true, update: true, delete: true },
          link: ["order_id"],
          fields: [{ key: "sku", source: "order_items.sku" }],
        },
      ],
    };
    const g = emitGraphql(view);
    expect(g).toContain('items : order_items @insert @update @delete @link(to : ["order_id"]) [ {');
    expect(g).toContain("sku : sku");
  });

  it("emits unnest nested field with @unnest", () => {
    const view: DualityView = {
      ...scalarView,
      fields: [
        { key: "_id", source: "orders.order_id" },
        {
          key: "addr",
          kind: "unnest",
          table: "addresses",
          link: ["address_id"],
          fields: [{ key: "city", source: "addresses.city" }],
        },
      ],
    };
    const g = emitGraphql(view);
    expect(g).toContain('addr : addresses @unnest @link(to : ["address_id"])');
    expect(g).toContain("city : city");
  });

  it("throws MissingLinkError when link is missing on nested field", () => {
    const view: DualityView = {
      ...scalarView,
      fields: [
        {
          key: "items",
          kind: "array",
          table: "order_items",
          link: [],
          fields: [{ key: "sku", source: "order_items.sku" }],
        },
      ],
    };
    expect(() => emitGraphql(view)).toThrow("items");
  });
});

describe("emitGraphql — nested", () => {
  it("array: key : table <anns> @link(to : [...]) [ { children } ] with nested @nocheck", () => {
    const v: DualityView = {
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
    };
    const g = emitGraphql(v);
    expect(g).toContain('driver : driver @insert @update @link(to : ["team_id"]) [ {');
    expect(g).toContain("driverId : driver_id");
    expect(g).toContain("name : name @nocheck");
    expect(g.trimEnd().endsWith("} ]\n};")).toBe(true);
  });

  it("unnest: key : table @unnest <anns> @link(...) { children }", () => {
    const v: DualityView = {
      name: "employee_dv",
      schema: "hr",
      createMode: "orReplace",
      root: {
        table: "emp",
        permissions: { insert: true, update: true, delete: true },
        etag: "check",
      },
      fields: [
        { key: "_id", source: "emp.empno" },
        {
          key: "dept",
          kind: "unnest",
          table: "dept",
          permissions: { insert: false, update: true, delete: false },
          etag: "check",
          link: ["deptno"],
          fields: [{ key: "departmentName", source: "dept.dname" }],
        },
      ],
    };
    const g = emitGraphql(v);
    expect(g).toContain('dept : dept @unnest @update @link(to : ["deptno"]) {');
    expect(g).toContain("departmentName : dname");
  });

  it("object: key : table <anns> @link(...) { children }", () => {
    const v: DualityView = {
      name: "emp_dv",
      schema: "hr",
      createMode: "create",
      root: {
        table: "emp",
        permissions: { insert: false, update: false, delete: false },
        etag: "check",
      },
      fields: [
        { key: "_id", source: "emp.empno" },
        {
          key: "dept",
          kind: "object",
          table: "dept",
          etag: "check",
          link: ["deptno"],
          fields: [{ key: "name", source: "dept.dname" }],
        },
      ],
    };
    const g = emitGraphql(v);
    expect(g).toContain('dept : dept @link(to : ["deptno"]) {');
  });

  it("throws MissingLinkError for a nested field without link", () => {
    const v: DualityView = {
      name: "x_dv",
      schema: "app",
      createMode: "create",
      root: {
        table: "emp",
        permissions: { insert: false, update: false, delete: false },
        etag: "check",
      },
      fields: [
        { key: "_id", source: "emp.empno" },
        {
          key: "dept",
          kind: "object",
          table: "dept",
          etag: "check",
          fields: [{ key: "n", source: "dept.dname" }],
        },
      ],
    };
    expect(() => emitGraphql(v)).toThrow(MissingLinkError);
  });
});

const departmentsView: DualityView = {
  name: "departments_dv",
  schema: "hr",
  createMode: "orReplace",
  root: { table: "dept", permissions: { insert: true, update: true, delete: true }, etag: "check" },
  fields: [
    { key: "_id", source: "dept.deptno" },
    { key: "departmentName", source: "dept.dname" },
    { key: "location", source: "dept.loc" },
    {
      key: "employees",
      kind: "array",
      table: "emp",
      permissions: { insert: true, update: true, delete: true },
      etag: "check",
      link: ["deptno"],
      fields: [
        { key: "employeeNumber", source: "emp.empno" },
        { key: "employeeName", source: "emp.ename" },
        { key: "job", source: "emp.job" },
        { key: "salary", source: "emp.sal" },
      ],
    },
  ],
};

const employeeView: DualityView = {
  name: "employee_dv",
  schema: "hr",
  createMode: "orReplace",
  root: { table: "emp", permissions: { insert: true, update: true, delete: true }, etag: "check" },
  fields: [
    { key: "_id", source: "emp.empno" },
    { key: "employeeName", source: "emp.ename" },
    {
      key: "dept",
      kind: "unnest",
      table: "dept",
      permissions: { insert: false, update: true, delete: false },
      etag: "check",
      link: ["deptno"],
      fields: [
        { key: "departmentNumber", source: "dept.deptno" },
        { key: "departmentName", source: "dept.dname" },
      ],
    },
  ],
};

describe("emitGraphql — golden fixtures", () => {
  it("departments_dv.graphql matches byte-for-byte", () => {
    expect(emitGraphql(departmentsView)).toBe(gold("departments_dv.graphql"));
  });
  it("employee_dv.graphql matches byte-for-byte", () => {
    expect(emitGraphql(employeeView)).toBe(gold("employee_dv.graphql"));
  });
});
