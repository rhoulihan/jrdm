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

  // Regression tests for C2: package-level wildcard bypass
  it("REGRESSION C2: an unrelated staged test does NOT satisfy an untested source file", () => {
    const staged = [
      "packages/model/src/newfeature.ts",
      "packages/model/src/__tests__/serde.test.ts",
    ];
    const read = (p) => (p.endsWith("newfeature.ts") ? "export function f(){return 1;}" : "");
    const result = checkTestPairs(staged, read);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("packages/model/src/newfeature.ts");
  });

  it("honors an explicit @tested-by annotation when the named test is staged", () => {
    const staged = ["packages/model/src/types.ts", "packages/model/src/__tests__/schemas.test.ts"];
    const read = (p) =>
      p.endsWith("types.ts")
        ? "// @tested-by: packages/model/src/__tests__/schemas.test.ts\nexport const X = 1;"
        : "";
    expect(checkTestPairs(staged, read)).toEqual({ ok: true, missing: [] });
  });

  it("rejects @tested-by when the named test is NOT staged", () => {
    const staged = ["packages/model/src/types.ts"];
    const read = (p) =>
      p.endsWith("types.ts")
        ? "// @tested-by: packages/model/src/__tests__/schemas.test.ts\nexport const X = 1;"
        : "";
    const result = checkTestPairs(staged, read);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("packages/model/src/types.ts");
  });

  it("still accepts a stem-matched __tests__ file", () => {
    const staged = [
      "packages/model/src/schemas.ts",
      "packages/model/src/__tests__/schemas.test.ts",
    ];
    expect(checkTestPairs(staged, () => "").ok).toBe(true);
  });
});
