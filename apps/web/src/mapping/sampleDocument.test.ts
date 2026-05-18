import { describe, it, expect } from "vitest";
import type { DualityView, Entity } from "@jrdm/model";
import { sampleDocument } from "./sampleDocument";

const entities: Entity[] = [
  {
    name: "orders",
    schema: "app",
    primaryKey: ["id"],
    columns: [
      { name: "id", type: "NUMBER", nullable: false },
      { name: "order_status", type: "VARCHAR2", nullable: true },
      { name: "created_at", type: "DATE", nullable: true },
      { name: "ts", type: "TIMESTAMP WITH TIME ZONE", nullable: true },
      { name: "is_paid", type: "BOOLEAN", nullable: true },
      { name: "blob_col", type: "RAW", nullable: true },
    ],
  },
  {
    name: "order_items",
    schema: "app",
    primaryKey: ["id"],
    columns: [
      { name: "id", type: "NUMBER", nullable: false },
      { name: "sku", type: "CHAR", nullable: true },
    ],
  },
];

const view: DualityView = {
  name: "v_dv",
  schema: "app",
  createMode: "orReplace",
  root: {
    table: "orders",
    permissions: { insert: false, update: false, delete: false },
    etag: "check",
  },
  fields: [
    { key: "_id", source: "orders.id" },
    { key: "status", source: "orders.order_status" },
    { key: "createdAt", source: "orders.created_at" },
    { key: "ts", source: "orders.ts" },
    { key: "paid", source: "orders.is_paid" },
    {
      key: "items",
      kind: "array",
      table: "order_items",
      link: { from: ["id"], to: ["order_id"] },
      fields: [
        { key: "id", source: "order_items.id" },
        { key: "sku", source: "order_items.sku" },
      ],
    },
    {
      key: "shipping",
      kind: "object",
      table: "order_items",
      link: { from: ["id"], to: ["order_id"] },
      fields: [{ key: "sku", source: "order_items.sku" }],
    },
  ],
};

describe("sampleDocument — §5 synthetic sample", () => {
  it("maps scalar column types to synthetic values", () => {
    const doc = sampleDocument(view, entities) as Record<string, unknown>;
    expect(doc._id).toBe(123); // NUMBER
    expect(doc.status).toBe("sample"); // VARCHAR2
    expect(typeof doc.createdAt).toBe("string"); // DATE → ISO string
    expect(() => new Date(doc.createdAt as string).toISOString()).not.toThrow();
    expect(typeof doc.ts).toBe("string"); // TIMESTAMP WITH TIME ZONE → ISO string
    expect(doc.paid).toBe(true); // BOOLEAN
  });

  it("unknown / missing column type falls back to 'sample'", () => {
    const v: DualityView = {
      ...view,
      fields: [
        { key: "_id", source: "orders.id" },
        { key: "ghost", source: "orders.does_not_exist" },
      ],
    };
    const doc = sampleDocument(v, entities) as Record<string, unknown>;
    expect(doc.ghost).toBe("sample");
  });

  it("object node → nested object of the child shape", () => {
    const doc = sampleDocument(view, entities) as Record<string, unknown>;
    expect(doc.shipping).toEqual({ sku: "sample" });
  });

  it("array node → 2-element array of the child shape", () => {
    const doc = sampleDocument(view, entities) as Record<string, unknown>;
    expect(Array.isArray(doc.items)).toBe(true);
    expect((doc.items as unknown[]).length).toBe(2);
    expect(doc.items).toEqual([
      { id: 123, sku: "sample" },
      { id: 123, sku: "sample" },
    ]);
  });

  it("includes a synthetic _metadata.etag at root", () => {
    const doc = sampleDocument(view, entities) as Record<string, unknown>;
    expect(doc._metadata).toEqual({ etag: "SAMPLE0000" });
  });

  it("is deterministic (stable output across calls)", () => {
    expect(sampleDocument(view, entities)).toEqual(sampleDocument(view, entities));
  });

  it("does not add _metadata to nested objects/arrays (root only)", () => {
    const doc = sampleDocument(view, entities) as Record<string, unknown>;
    expect((doc.shipping as Record<string, unknown>)._metadata).toBeUndefined();
    const firstItem = (doc.items as Record<string, unknown>[]).at(0);
    expect(firstItem?._metadata).toBeUndefined();
  });

  it("does not mutate inputs", () => {
    const vSnap: unknown = JSON.parse(JSON.stringify(view));
    const eSnap: unknown = JSON.parse(JSON.stringify(entities));
    sampleDocument(view, entities);
    expect(view).toEqual(vSnap);
    expect(entities).toEqual(eSnap);
  });
});
