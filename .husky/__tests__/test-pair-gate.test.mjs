import { describe, it, expect } from "vitest";
import { checkTestPairs } from "../test-pair-gate.mjs";

describe("test-pair-gate", () => {
  it("passes when staged source has matching test", () => {
    const staged = ["packages/model/src/types.ts", "packages/model/src/__tests__/types.test.ts"];
    expect(checkTestPairs(staged)).toEqual({ ok: true, missing: [] });
  });

  it("fails when staged source has no test pair", () => {
    const staged = ["packages/model/src/types.ts"];
    expect(checkTestPairs(staged)).toEqual({
      ok: false,
      missing: ["packages/model/src/types.ts"],
    });
  });

  it("ignores non-src files", () => {
    const staged = ["README.md", "package.json"];
    expect(checkTestPairs(staged)).toEqual({ ok: true, missing: [] });
  });

  it("ignores type-only source files (index re-exports)", () => {
    const staged = ["packages/model/src/index.ts"];
    expect(checkTestPairs(staged)).toEqual({ ok: true, missing: [] });
  });

  it("accepts colocated test in same directory", () => {
    const staged = ["packages/model/src/types.ts", "packages/model/src/types.test.ts"];
    expect(checkTestPairs(staged)).toEqual({ ok: true, missing: [] });
  });
});
