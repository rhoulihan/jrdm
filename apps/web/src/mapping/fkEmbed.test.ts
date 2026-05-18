import { describe, it, expect } from "vitest";
import type { Relationship } from "@jrdm/model";
import { decideEmbed } from "./fkEmbed";

// from = PK/parent side, to = FK/child side (per @jrdm/model Relationship + §4).
const relPtoT_1N: Relationship = {
  name: "fk_items_order",
  from: { schema: "app", table: "ORDERS", columns: ["ID"] },
  to: { schema: "app", table: "ORDER_ITEMS", columns: ["ORDER_ID"] },
  cardinality: "1:N",
};

const relPtoT_11: Relationship = {
  name: "fk_profile_user",
  from: { schema: "app", table: "USERS", columns: ["ID"] },
  to: { schema: "app", table: "PROFILES", columns: ["USER_ID"] },
  cardinality: "1:1",
};

// Reversed: T is the PK/parent side of P (the rel's `from` is the child table T).
const relReversed: Relationship = {
  name: "fk_order_customer",
  from: { schema: "app", table: "CUSTOMERS", columns: ["ID"] },
  to: { schema: "app", table: "ORDERS", columns: ["CUSTOMER_ID"] },
  cardinality: "1:N",
};

describe("decideEmbed — §4 FK-aware embed rule", () => {
  it("row 1: from=P,to=T,1:N → array, link.from=P cols, link.to=T cols, fkDriven", () => {
    const r = decideEmbed([relPtoT_1N], "ORDERS", "ORDER_ITEMS");
    expect(r.kind).toBe("array");
    expect(r.link).toEqual({ from: ["ID"], to: ["ORDER_ID"] });
    expect(r.fkDriven).toBe(true);
    expect(r.rel).toBe(relPtoT_1N);
  });

  it("row 2: from=P,to=T,1:1 → object, same join columns, fkDriven", () => {
    const r = decideEmbed([relPtoT_11], "USERS", "PROFILES");
    expect(r.kind).toBe("object");
    expect(r.link).toEqual({ from: ["ID"], to: ["USER_ID"] });
    expect(r.fkDriven).toBe(true);
    expect(r.rel).toBe(relPtoT_11);
  });

  it("row 3: reversed (T is PK/parent of P) → object, link columns from the reversed rel, fkDriven", () => {
    // parent node table = ORDERS (P), child being placed = CUSTOMERS (T).
    // The rel says CUSTOMERS(from) → ORDERS(to): so relative to parent=ORDERS,
    // the join is object, link.from must be parent(ORDERS) columns, link.to child(CUSTOMERS).
    const r = decideEmbed([relReversed], "ORDERS", "CUSTOMERS");
    expect(r.kind).toBe("object");
    expect(r.link).toEqual({ from: ["CUSTOMER_ID"], to: ["ID"] });
    expect(r.fkDriven).toBe(true);
    expect(r.rel).toBe(relReversed);
  });

  it("row 4: no relationship P↔T → object, blank link, not fkDriven, no rel", () => {
    const r = decideEmbed([relPtoT_1N], "ORDERS", "UNRELATED");
    expect(r.kind).toBe("object");
    expect(r.link).toEqual({ from: [], to: [] });
    expect(r.fkDriven).toBe(false);
    expect(r.rel).toBeUndefined();
  });

  it("row 4b: empty relationships → object, not fkDriven", () => {
    const r = decideEmbed([], "ORDERS", "ORDER_ITEMS");
    expect(r).toEqual({ kind: "object", link: { from: [], to: [] }, fkDriven: false });
  });

  it("composite join columns preserved positionally (P→T 1:N)", () => {
    const composite: Relationship = {
      name: "fk_comp",
      from: { schema: "app", table: "P", columns: ["A", "B"] },
      to: { schema: "app", table: "C", columns: ["X", "Y"] },
      cardinality: "1:N",
    };
    const r = decideEmbed([composite], "P", "C");
    expect(r.kind).toBe("array");
    expect(r.link).toEqual({ from: ["A", "B"], to: ["X", "Y"] });
  });

  it("prefers a direct P→T relationship over a reversed one if both exist", () => {
    const r = decideEmbed([relReversed, relPtoT_1N], "ORDERS", "ORDER_ITEMS");
    expect(r.kind).toBe("array");
    expect(r.rel).toBe(relPtoT_1N);
  });

  it("does not mutate the input relationships", () => {
    const input = [relPtoT_1N];
    const snapshot: unknown = JSON.parse(JSON.stringify(input));
    decideEmbed(input, "ORDERS", "ORDER_ITEMS");
    expect(input).toEqual(snapshot);
  });
});
