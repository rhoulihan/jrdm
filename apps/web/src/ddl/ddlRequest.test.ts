import { describe, it, expect } from "vitest";
import { buildDdlRequestBody } from "./ddlRequest";
import type { AnyField, DualityView } from "@jrdm/model";

function bigView(n: number): DualityView {
  const fields: AnyField[] = [{ key: "_id", source: "root.id" }];
  for (let i = 0; i < n; i++) fields.push({ key: `c${i}`, source: `root.c${i}` });
  return {
    name: "big_dv",
    schema: "app",
    createMode: "orReplace",
    root: {
      table: "root",
      permissions: { insert: true, update: true, delete: true },
      etag: "check",
    },
    fields,
  };
}

describe("buildDdlRequestBody", () => {
  it("produces the {view,syntax} request body", () => {
    const v = bigView(0);
    expect(buildDdlRequestBody(v, "graphql")).toEqual({ view: v, syntax: "graphql" });
  });

  it("builds + serializes a 200-field view body in < 50ms", () => {
    const v = bigView(200);
    const t = performance.now();
    const body = JSON.stringify(buildDdlRequestBody(v, "sql"));
    const ms = performance.now() - t;
    expect(body.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(50);
  });
});
