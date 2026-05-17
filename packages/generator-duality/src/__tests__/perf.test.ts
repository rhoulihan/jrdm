import { describe, it, expect } from "vitest";
import { emitSqlJson, emitGraphql } from "../index";
import type { AnyField, DualityView } from "@jrdm/model";

function wideDeep(depth: number, width: number, table: string): AnyField[] {
  const scalars: AnyField[] = Array.from({ length: width }, (_, i) => ({
    key: `c${i}`,
    source: `${table}.c${i}`,
  }));
  if (depth <= 0) return scalars;
  const child: AnyField = {
    key: `child${depth}`,
    kind: "array",
    table: `t${depth}`,
    permissions: { insert: true, update: true, delete: false },
    etag: "check",
    link: { from: ["pid"], to: ["pid"] },
    fields: wideDeep(depth - 1, width, `t${depth}`),
  };
  return [...scalars, child];
}

const big: DualityView = {
  name: "big_dv",
  schema: "app",
  createMode: "orReplace",
  root: { table: "root", permissions: { insert: true, update: true, delete: true }, etag: "check" },
  fields: [{ key: "_id", source: "root.id" }, ...wideDeep(6, 20, "root")],
};

describe("generator perf guard", () => {
  it("emits a deep/wide view (6 levels, 20 cols each) in < 50ms per syntax", () => {
    const t1 = performance.now();
    emitSqlJson(big);
    const sqlMs = performance.now() - t1;
    const t2 = performance.now();
    emitGraphql(big);
    const gqlMs = performance.now() - t2;
    expect(sqlMs).toBeLessThan(50);
    expect(gqlMs).toBeLessThan(50);
  });
});
