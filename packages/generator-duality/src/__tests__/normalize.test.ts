import { describe, it, expect } from "vitest";
import { emitSqlJson, emitGraphql } from "../index";
import { normalizeSql, normalizeGraphql } from "../normalize";
import type { DualityView } from "@jrdm/model";

const v: DualityView = {
  name: "team_dv",
  schema: "app",
  createMode: "orReplace",
  root: { table: "team", permissions: { insert: true, update: true, delete: true }, etag: "check" },
  fields: [
    { key: "_id", source: "team.team_id" },
    {
      key: "driver",
      kind: "array",
      table: "driver",
      permissions: { insert: true, update: false, delete: false },
      etag: "check",
      link: ["team_id"],
      fields: [{ key: "name", source: "driver.name", etag: "nocheck" }],
    },
  ],
};

describe("normalize", () => {
  it("the two syntaxes normalize to the same structural form", () => {
    expect(normalizeSql(emitSqlJson(v))).toEqual(normalizeGraphql(emitGraphql(v)));
  });
});
