import { describe, it, expect } from "vitest";
import type { DualityView } from "@jrdm/model";
import {
  seedWorkingCopy,
  addNode,
  deleteNode,
  mapColumns,
  setEmbed,
  toDualityView,
  isLocked,
} from "./workingCopy";

const preexisting: DualityView = {
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
    {
      key: "shipping",
      kind: "object",
      table: "addresses",
      link: { from: ["addr_id"], to: ["id"] },
      fields: [{ key: "city", source: "addresses.city" }],
    },
  ],
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

describe("seedWorkingCopy", () => {
  it("captures the doc and locks every pre-existing node path", () => {
    const wc = seedWorkingCopy(preexisting);
    expect(isLocked(wc, [0])).toBe(true); // _id
    expect(isLocked(wc, [1])).toBe(true); // status
    expect(isLocked(wc, [2])).toBe(true); // shipping (nested)
    expect(isLocked(wc, [2, 0])).toBe(true); // shipping.city
  });

  it("does not mutate the input view", () => {
    const snap = clone(preexisting);
    seedWorkingCopy(preexisting);
    expect(preexisting).toEqual(snap);
  });

  it("seeds an empty root view when editingView is null", () => {
    const wc = seedWorkingCopy(null);
    const v = toDualityView(wc);
    expect(v.fields[0]?.key).toBe("_id");
    expect(v.fields).toHaveLength(1);
  });
});

describe("addNode", () => {
  it("adds a new root node when no parent path is given", () => {
    const wc = seedWorkingCopy(preexisting);
    const next = addNode(wc, null, { key: "items", kind: "array", table: "order_items" });
    const v = toDualityView(next);
    const added = v.fields[v.fields.length - 1];
    expect(added).toMatchObject({ key: "items", kind: "array", table: "order_items" });
  });

  it("adds a subnode under a selected node path", () => {
    const wc = seedWorkingCopy(preexisting);
    const wc2 = addNode(wc, null, { key: "items", kind: "array", table: "order_items" });
    const itemsIdx = toDualityView(wc2).fields.length - 1;
    const wc3 = addNode(wc2, [itemsIdx], { key: "sub", kind: "object", table: "sub_t" });
    const v = toDualityView(wc3);
    const items = v.fields[itemsIdx];
    expect(items && "fields" in items && items.fields.at(-1)).toMatchObject({
      key: "sub",
      table: "sub_t",
    });
  });

  it("a session-created node is NOT locked", () => {
    const wc = seedWorkingCopy(preexisting);
    const next = addNode(wc, null, { key: "items", kind: "array", table: "order_items" });
    const newPath = [toDualityView(next).fields.length - 1];
    expect(isLocked(next, newPath)).toBe(false);
  });

  it("is immutable (does not mutate prior working copy)", () => {
    const wc = seedWorkingCopy(preexisting);
    const before = toDualityView(wc);
    addNode(wc, null, { key: "items", kind: "array", table: "order_items" });
    expect(toDualityView(wc)).toEqual(before);
  });
});

describe("deleteNode — locked-node boundary", () => {
  it("rejects deletion of a pre-existing (locked) node: returns working copy unchanged", () => {
    const wc = seedWorkingCopy(preexisting);
    const before = toDualityView(wc);
    const after = deleteNode(wc, [1]); // status — locked
    expect(toDualityView(after)).toEqual(before);
  });

  it("rejects deletion of a locked nested node and its locked child", () => {
    const wc = seedWorkingCopy(preexisting);
    const before = toDualityView(wc);
    expect(toDualityView(deleteNode(wc, [2]))).toEqual(before);
    expect(toDualityView(deleteNode(wc, [2, 0]))).toEqual(before);
  });

  it("deletes a session-created node", () => {
    const wc = seedWorkingCopy(preexisting);
    const wc2 = addNode(wc, null, { key: "items", kind: "array", table: "order_items" });
    const newIdx = toDualityView(wc2).fields.length - 1;
    const wc3 = deleteNode(wc2, [newIdx]);
    const v = toDualityView(wc3);
    expect(v.fields.find((f) => f.key === "items")).toBeUndefined();
    // pre-existing subtree intact
    expect(v.fields.map((f) => f.key)).toEqual(["_id", "status", "shipping"]);
  });

  it("deletes a session-created subnode under a session node", () => {
    const wc = seedWorkingCopy(preexisting);
    const wc2 = addNode(wc, null, { key: "items", kind: "array", table: "order_items" });
    const idx = toDualityView(wc2).fields.length - 1;
    const wc3 = addNode(wc2, [idx], { key: "sub", kind: "object", table: "s" });
    const wc4 = deleteNode(wc3, [idx, 0]);
    const items = toDualityView(wc4).fields[idx];
    expect(items && "fields" in items && items.fields).toEqual([]);
  });

  it("is immutable on rejected delete (input unchanged)", () => {
    const wc = seedWorkingCopy(preexisting);
    const snap = toDualityView(wc);
    deleteNode(wc, [1]);
    expect(toDualityView(wc)).toEqual(snap);
  });
});

describe("mapColumns", () => {
  it("rejects mapColumns onto a locked node — returns working copy unchanged", () => {
    // Path [2] = the pre-existing "shipping" nested node (locked).
    const wc = seedWorkingCopy(preexisting);
    const before = toDualityView(wc);
    const after = mapColumns(wc, [2], "addresses", ["zip", "country"]);
    // The returned WorkingCopy must deep-equal the input — the locked node
    // must NOT have gained any children. This assertion FAILS if the guard is
    // removed because addField would append scalars under shipping.
    expect(toDualityView(after)).toEqual(before);
    // Belt-and-suspenders: the locked node's fields list is unchanged.
    const shipping = toDualityView(after).fields[2];
    expect(shipping && "fields" in shipping && shipping.fields).toEqual([
      { key: "city", source: "addresses.city" },
    ]);
  });

  it("maps checked columns as scalarField children under a target node", () => {
    const wc = seedWorkingCopy(preexisting);
    const wc2 = addNode(wc, null, { key: "items", kind: "array", table: "order_items" });
    const idx = toDualityView(wc2).fields.length - 1;
    const wc3 = mapColumns(wc2, [idx], "order_items", ["id", "qty"]);
    const items = toDualityView(wc3).fields[idx];
    expect(items && "fields" in items && items.fields).toEqual([
      { key: "id", source: "order_items.id" },
      { key: "qty", source: "order_items.qty" },
    ]);
  });

  it("maps columns at root (empty target path)", () => {
    const wc = seedWorkingCopy(null);
    const wc2 = mapColumns(wc, [], "orders", ["name"]);
    const v = toDualityView(wc2);
    expect(v.fields.at(-1)).toEqual({ key: "name", source: "orders.name" });
  });

  it("is immutable", () => {
    const wc = seedWorkingCopy(preexisting);
    const before = toDualityView(wc);
    mapColumns(wc, [], "orders", ["x"]);
    expect(toDualityView(wc)).toEqual(before);
  });
});

describe("setEmbed", () => {
  it("sets a session node's kind and link", () => {
    const wc = seedWorkingCopy(preexisting);
    const wc2 = addNode(wc, null, { key: "items", kind: "object", table: "order_items" });
    const idx = toDualityView(wc2).fields.length - 1;
    const wc3 = setEmbed(wc2, [idx], "array", { from: ["id"], to: ["order_id"] });
    const items = toDualityView(wc3).fields[idx];
    expect(items).toMatchObject({
      kind: "array",
      link: { from: ["id"], to: ["order_id"] },
    });
  });

  it("rejects setEmbed on a locked node (unchanged)", () => {
    const wc = seedWorkingCopy(preexisting);
    const before = toDualityView(wc);
    const after = setEmbed(wc, [2], "array", { from: ["a"], to: ["b"] });
    expect(toDualityView(after)).toEqual(before);
  });
});

describe("toDualityView", () => {
  it("preserves the pre-existing subtree byte-identically", () => {
    const wc = seedWorkingCopy(preexisting);
    const wc2 = addNode(wc, null, { key: "items", kind: "array", table: "order_items" });
    const v = toDualityView(wc2);
    expect(v.fields.slice(0, 3)).toEqual(preexisting.fields);
    expect(v.root).toEqual(preexisting.root);
    expect(v.name).toBe(preexisting.name);
  });

  it("preserves the _id-first invariant", () => {
    const wc = seedWorkingCopy(preexisting);
    expect(toDualityView(wc).fields[0]?.key).toBe("_id");
    const wc2 = addNode(wc, null, { key: "items", kind: "array", table: "t" });
    expect(toDualityView(wc2).fields[0]?.key).toBe("_id");
  });

  it("round-trips: seed then emit equals the original view", () => {
    const wc = seedWorkingCopy(preexisting);
    expect(toDualityView(wc)).toEqual(preexisting);
  });
});
