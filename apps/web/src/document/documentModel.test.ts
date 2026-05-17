import { describe, it, expect } from "vitest";
import {
  scalarField,
  nestedField,
  addField,
  removeField,
  patchField,
  getField,
} from "./documentModel";
import type { DualityView } from "@jrdm/model";

const base: DualityView = {
  name: "v_dv",
  schema: "app",
  createMode: "orReplace",
  root: {
    table: "orders",
    permissions: { insert: false, update: false, delete: false },
    etag: "check",
  },
  fields: [{ key: "_id", source: "orders.id" }],
};

describe("documentModel factories", () => {
  it("scalarField builds a scalar from table+column", () => {
    expect(scalarField("status", "orders", "order_status")).toEqual({
      key: "status",
      source: "orders.order_status",
    });
  });
  it("nestedField builds an array node with empty fields and link", () => {
    expect(nestedField("items", "array", "order_items")).toEqual({
      key: "items",
      kind: "array",
      table: "order_items",
      fields: [],
    });
  });
});

describe("documentModel tree ops (immutable)", () => {
  it("addField appends at the top level without mutating input", () => {
    const next = addField(base, [], scalarField("status", "orders", "order_status"));
    expect(next.fields).toHaveLength(2);
    expect(base.fields).toHaveLength(1); // unchanged
    expect(next.fields[1]).toEqual({ key: "status", source: "orders.order_status" });
  });

  it("addField appends into a nested field by path", () => {
    const withNested = addField(base, [], nestedField("items", "array", "order_items"));
    const next = addField(withNested, [1], scalarField("qty", "order_items", "quantity"));
    const items = next.fields[1];
    expect(items && "fields" in items && items.fields).toEqual([
      { key: "qty", source: "order_items.quantity" },
    ]);
  });

  it("getField resolves a field by path", () => {
    const withNested = addField(base, [], nestedField("items", "array", "order_items"));
    expect(getField(withNested, [1])?.key).toBe("items");
    expect(getField(withNested, [0])?.key).toBe("_id");
    expect(getField(withNested, [9])).toBeUndefined();
  });

  it("patchField shallow-merges a patch at path, immutably", () => {
    const next = patchField(base, [0], { source: "orders.order_id" });
    expect(next.fields[0]).toEqual({ key: "_id", source: "orders.order_id" });
    expect(base.fields[0]).toEqual({ key: "_id", source: "orders.id" });
  });

  it("removeField deletes by path immutably", () => {
    const withTwo = addField(base, [], scalarField("status", "orders", "s"));
    const next = removeField(withTwo, [1]);
    expect(next.fields).toHaveLength(1);
    expect(withTwo.fields).toHaveLength(2);
  });

  it("removeField removes a nested child by deep path", () => {
    let v = addField(base, [], nestedField("items", "array", "order_items"));
    v = addField(v, [1], scalarField("qty", "order_items", "quantity"));
    const next = removeField(v, [1, 0]);
    const items = next.fields[1];
    expect(items && "fields" in items && items.fields).toEqual([]);
  });
});
