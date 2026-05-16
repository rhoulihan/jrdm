import { describe, it } from "vitest";
import fc from "fast-check";
import { dualityViewArbitrary } from "../arbitrary";
import { emitSqlJson, emitGraphql } from "../index";
import { normalizeSql, normalizeGraphql } from "../normalize";

describe("dual-syntax round-trip equivalence", () => {
  it("SQL/JSON and GraphQL encode the same view for 10k random IRs", () => {
    fc.assert(
      fc.property(dualityViewArbitrary(), (view) => {
        const a = normalizeSql(emitSqlJson(view));
        const b = normalizeGraphql(emitGraphql(view));
        return JSON.stringify(a) === JSON.stringify(b);
      }),
      { numRuns: 10_000 },
    );
  });
});
