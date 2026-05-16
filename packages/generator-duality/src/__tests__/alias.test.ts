import { describe, it, expect } from "vitest";
import { AliasContext } from "../alias";

describe("AliasContext", () => {
  it("returns a stable alias for the same table", () => {
    const ctx = new AliasContext();
    const a = ctx.aliasFor("orders");
    expect(ctx.aliasFor("orders")).toBe(a);
  });

  it("uses the initials scheme for the first claimant", () => {
    const ctx = new AliasContext();
    expect(ctx.aliasFor("order_items")).toBe("oi");
    expect(ctx.aliasFor("orders")).toBe("o");
  });

  it("disambiguates colliding initials deterministically with a numeric suffix", () => {
    const ctx = new AliasContext();
    expect(ctx.aliasFor("order_items")).toBe("oi");
    expect(ctx.aliasFor("order_invoices")).toBe("oi2");
    expect(ctx.aliasFor("order_inventory")).toBe("oi3");
    // stable on repeat
    expect(ctx.aliasFor("order_invoices")).toBe("oi2");
  });

  it("single-word tables alias to first letter, colliding ones get suffixes", () => {
    const ctx = new AliasContext();
    expect(ctx.aliasFor("orders")).toBe("o");
    expect(ctx.aliasFor("offers")).toBe("o2");
  });

  it("never returns the same alias for two different tables", () => {
    const ctx = new AliasContext();
    const seen = new Set<string>();
    for (const t of ["a_b", "a_b_c", "ab", "a", "alpha_beta", "alpha_bravo"]) {
      const al = ctx.aliasFor(t);
      expect(seen.has(al)).toBe(false);
      seen.add(al);
    }
  });
});
