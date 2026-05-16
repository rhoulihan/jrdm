// Covers: packages/generator-duality/src/arbitrary.ts
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { dualityViewArbitrary } from "../arbitrary";
import { DualityViewSchema } from "@jrdm/model";
import type { AnyField } from "@jrdm/model";

describe("dualityViewArbitrary", () => {
  it("only produces views that pass DualityViewSchema", () => {
    fc.assert(
      fc.property(dualityViewArbitrary(), (view) => {
        expect(DualityViewSchema.safeParse(view).success).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it("every nested field has a non-empty link (emittable)", () => {
    fc.assert(
      fc.property(dualityViewArbitrary(), (view) => {
        const walk = (fs: AnyField[]): boolean =>
          fs.every((f) => ("kind" in f ? !!f.link && f.link.length > 0 && walk(f.fields) : true));
        expect(walk(view.fields)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });
});
