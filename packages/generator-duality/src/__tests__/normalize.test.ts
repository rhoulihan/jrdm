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
      link: { from: ["team_id"], to: ["fk_team"] },
      fields: [{ key: "name", source: "driver.name", etag: "nocheck" }],
    },
  ],
};

describe("normalize", () => {
  it("the two syntaxes normalize to the same structural form", () => {
    expect(normalizeSql(emitSqlJson(v))).toEqual(normalizeGraphql(emitGraphql(v)));
  });
});

// Step A — prove the root-etag gap BEFORE fixing it:
// When root.etag is "nocheck", emitSqlJson emits " WITH NOCHECK" on the root FROM line,
// but emitGraphql did NOT emit a root @nocheck.  Assert the GraphQL output must contain
// a root-level @nocheck — this FAILS RED until Step B is applied.
const vNocheck: DualityView = {
  name: "race_dv",
  schema: "app",
  createMode: "create",
  root: {
    table: "race",
    permissions: { insert: true, update: true, delete: false },
    etag: "nocheck",
  },
  fields: [
    { key: "_id", source: "race.race_id" },
    { key: "name", source: "race.name" },
  ],
};

describe("normalize — root etag parity (I1)", () => {
  it("emitGraphql emits a root-level @nocheck when root.etag === 'nocheck'", () => {
    const gql = emitGraphql(vNocheck);
    // The root line is "<table> [anns] @nocheck {" — it starts with the table name
    // (find the line that starts with the root table name, not the CREATE ... line)
    const rootLine = gql.split("\n").find((l) => l.startsWith(vNocheck.root.table))!;
    expect(rootLine).toBeDefined();
    expect(rootLine).toContain("@nocheck");
  });

  it("both normalizers agree on rootNocheck for a nocheck root view", () => {
    const a = normalizeSql(emitSqlJson(vNocheck));
    const b = normalizeGraphql(emitGraphql(vNocheck));
    expect(a.rootNocheck).toBe(true);
    expect(b.rootNocheck).toBe(true);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("both normalizers agree for a check root view (rootNocheck remains false)", () => {
    const a = normalizeSql(emitSqlJson(v));
    const b = normalizeGraphql(emitGraphql(v));
    expect(a.rootNocheck).toBe(false);
    expect(b.rootNocheck).toBe(false);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
