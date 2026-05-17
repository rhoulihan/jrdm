import { describe, it, expect } from "vitest";
import {
  DualityViewSchema,
  type DualityView,
  RelationshipSchema,
  ProjectSchema as _ProjectSchema,
  DraftProjectSchema,
  type DraftProject,
} from "../schemas";

const minimalView: DualityView = {
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
  ],
};

describe("DualityViewSchema", () => {
  it("accepts a minimal valid duality view", () => {
    expect(DualityViewSchema.safeParse(minimalView).success).toBe(true);
  });

  it("requires the first field to be _id", () => {
    const view = { ...minimalView, fields: minimalView.fields.slice(1) };
    expect(DualityViewSchema.safeParse(view).success).toBe(false);
  });

  it("accepts permissions defaulting to all false (read-only)", () => {
    const ro = {
      ...minimalView,
      root: { ...minimalView.root, permissions: { insert: false, update: false, delete: false } },
    };
    expect(DualityViewSchema.safeParse(ro).success).toBe(true);
  });

  it("accepts nested array fields", () => {
    const nested = {
      ...minimalView,
      fields: [
        ...minimalView.fields,
        {
          key: "items",
          kind: "array" as const,
          table: "order_items",
          permissions: { insert: true, update: true, delete: false },
          etag: "check" as const,
          link: { from: ["order_id"], to: ["order_id"] },
          fields: [{ key: "itemId", source: "order_items.line_item_id" }],
        },
      ],
    };
    expect(DualityViewSchema.safeParse(nested).success).toBe(true);
  });

  it("rejects fields with missing source on scalar nodes", () => {
    const broken = {
      ...minimalView,
      fields: [{ key: "_id", source: "orders.order_id" }, { key: "broken" }],
    };
    expect(DualityViewSchema.safeParse(broken).success).toBe(false);
  });

  // I1: nested fields must carry permissions/etag/link/noupdate through parse
  it("I1: nested array fields preserve permissions/etag/link through parse", () => {
    const v = {
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
          etag: "nocheck",
          link: { from: ["order_id"], to: ["fk_order_id"] },
          fields: [{ key: "itemId", source: "order_items.line_item_id", noupdate: true }],
        },
      ],
    };
    const parsed = DualityViewSchema.parse(v);
    // Use non-null assertion: we control the data above, field[1] is always present.
    // noUncheckedIndexedAccess requires explicit assertion; "kind" in item narrows AnyField.
    const item = parsed.fields[1]!;
    // These property accesses must TYPECHECK — the inferred type must expose them:
    if ("kind" in item && item.kind === "array") {
      expect(item.permissions).toEqual({ insert: true, update: true, delete: false });
      expect(item.etag).toBe("nocheck");
      expect(item.link).toEqual({ from: ["order_id"], to: ["fk_order_id"] });
      const inner = item.fields[0]!;
      expect("noupdate" in inner && inner.noupdate).toBe(true);
    } else {
      throw new Error("expected array kind");
    }
  });

  it("I3: rejects createMode 'ifNotExists' (no such Oracle DDL form)", () => {
    const v = {
      name: "v",
      schema: "s",
      createMode: "ifNotExists",
      root: {
        table: "t",
        permissions: { insert: false, update: false, delete: false },
        etag: "check",
      },
      fields: [{ key: "_id", source: "t.id" }],
    };
    expect(DualityViewSchema.safeParse(v).success).toBe(false);
  });

  it("still accepts create and orReplace", () => {
    for (const createMode of ["create", "orReplace"] as const) {
      const v = {
        name: "v",
        schema: "s",
        createMode,
        root: {
          table: "t",
          permissions: { insert: false, update: false, delete: false },
          etag: "check",
        },
        fields: [{ key: "_id", source: "t.id" }],
      };
      expect(DualityViewSchema.safeParse(v).success).toBe(true);
    }
  });

  it("RelationshipSchema accepts a derived 1:N relationship", () => {
    expect(
      RelationshipSchema.safeParse({
        name: "fk",
        from: { schema: "app", table: "orders", columns: ["customer_id"] },
        to: { schema: "app", table: "customers", columns: ["customer_id"] },
        cardinality: "1:N",
      }).success,
    ).toBe(true);
  });

  it("I1: a static type-level assertion that DualityView nested fields carry permissions", () => {
    // This is a compile-time guarantee; if the inferred type lacks `permissions`
    // on the array variant, `pnpm typecheck` fails.
    const sample: DualityView = {
      name: "v",
      schema: "s",
      createMode: "create",
      root: {
        table: "t",
        permissions: { insert: false, update: false, delete: false },
        etag: "check",
      },
      fields: [
        { key: "_id", source: "t.id" },
        {
          key: "kids",
          kind: "array",
          table: "k",
          permissions: { insert: true, update: false, delete: false },
          etag: "check",
          link: { from: ["id"], to: ["t_id"] },
          fields: [{ key: "x", source: "k.x" }],
        },
      ],
    };
    expect(sample.fields.length).toBe(2);
  });

  it("ProjectSchema is exported", () => {
    expect(typeof _ProjectSchema.safeParse).toBe("function");
  });
});

describe("I3: NestedField.link is asymmetric { from, to }", () => {
  const base = {
    name: "orders_dv",
    schema: "app",
    createMode: "orReplace" as const,
    root: {
      table: "orders",
      permissions: { insert: false, update: false, delete: false },
      etag: "check" as const,
    },
  };

  it("accepts equal-length from/to", () => {
    const v = DualityViewSchema.safeParse({
      ...base,
      fields: [
        { key: "_id", source: "orders.id" },
        {
          key: "items",
          kind: "array",
          table: "order_items",
          link: { from: ["id"], to: ["order_id"] },
          fields: [{ key: "sku", source: "order_items.sku" }],
        },
      ],
    });
    expect(v.success).toBe(true);
  });

  it("rejects mismatched from/to lengths", () => {
    const v = DualityViewSchema.safeParse({
      ...base,
      fields: [
        { key: "_id", source: "orders.id" },
        {
          key: "items",
          kind: "array",
          table: "order_items",
          link: { from: ["id", "tenant"], to: ["order_id"] },
          fields: [{ key: "sku", source: "order_items.sku" }],
        },
      ],
    });
    expect(v.success).toBe(false);
  });

  it("rejects the OLD string[] link shape", () => {
    const v = DualityViewSchema.safeParse({
      ...base,
      fields: [
        { key: "_id", source: "orders.id" },
        {
          key: "items",
          kind: "array",
          table: "order_items",
          link: ["order_id"],
          fields: [{ key: "sku", source: "order_items.sku" }],
        },
      ],
    });
    expect(v.success).toBe(false);
  });
});

describe("DraftProjectSchema (import draft — entities may lack a PK)", () => {
  it("accepts a project whose entity has an empty primaryKey", () => {
    const draft: DraftProject = {
      name: "imported",
      version: "0.1.0",
      entities: [
        {
          name: "logs",
          schema: "app",
          columns: [{ name: "msg", type: "VARCHAR2", nullable: true }],
          primaryKey: [],
        },
      ],
      views: [],
    };
    expect(DraftProjectSchema.safeParse(draft).success).toBe(true);
  });

  it("still rejects an entity with zero columns", () => {
    const bad = {
      name: "p",
      version: "0.1.0",
      entities: [{ name: "x", schema: "app", columns: [], primaryKey: [] }],
      views: [],
    };
    expect(DraftProjectSchema.safeParse(bad).success).toBe(false);
  });

  it("a DraftProject with PK-ful entities also satisfies ProjectSchema", async () => {
    const { ProjectSchema } = await import("../schemas");
    const ok: DraftProject = {
      name: "p",
      version: "0.1.0",
      entities: [
        {
          name: "orders",
          schema: "app",
          columns: [{ name: "order_id", type: "NUMBER", nullable: false }],
          primaryKey: ["order_id"],
        },
      ],
      views: [],
    };
    expect(DraftProjectSchema.safeParse(ok).success).toBe(true);
    expect(ProjectSchema.safeParse(ok).success).toBe(true);
  });
});
