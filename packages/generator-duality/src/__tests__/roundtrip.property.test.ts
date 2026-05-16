import { describe, it } from "vitest";
import fc from "fast-check";
import { dualityViewArbitrary } from "../arbitrary";
import { emitSqlJson, emitGraphql } from "../index";
import { normalizeSql, normalizeGraphql } from "../normalize";

/**
 * Parse all "FROM <table> <alias>" occurrences from a SQL duality view string.
 * Both root-level ("^\nFROM") and nested (" } FROM " inside subqueries) are captured.
 * Returns a map of alias → table so we can assert M1: no two DISTINCT tables share an alias.
 */
function parseAliasMap(sql: string): Map<string, string> {
  const aliasMap = new Map<string, string>(); // alias → first table that claimed it
  // Root FROM: starts a new line (\nFROM <table> <alias>...)
  const rootM = /\nFROM (\w+) (\w+)/.exec(sql);
  if (rootM) aliasMap.set(rootM[2]!, rootM[1]!);
  // Nested FROMs: " } FROM <table> <alias> " (inline in subquery — does NOT start on new line)
  const nestedRe = /\} FROM (\w+) (\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = nestedRe.exec(sql)) !== null) {
    aliasMap.set(m[2]!, m[1]!);
  }
  return aliasMap;
}

describe("dual-syntax round-trip equivalence", () => {
  it("SQL/JSON and GraphQL encode the same view for 10k random IRs", () => {
    fc.assert(
      fc.property(dualityViewArbitrary(), (view) => {
        const sqlOut = emitSqlJson(view);
        const gqlOut = emitGraphql(view);
        const a = normalizeSql(sqlOut);
        const b = normalizeGraphql(gqlOut);
        return JSON.stringify(a) === JSON.stringify(b);
      }),
      { numRuns: 10_000 },
    );
  });

  /**
   * M1 alias-uniqueness property: AliasContext must assign distinct aliases for
   * distinct table names.  With repeated-table generation now in the arbitrary (~40%
   * chance a nested field reuses an ancestor/sibling table name), this property
   * genuinely exercises AliasContext collision handling on every run.
   */
  it("SQL aliases are unique per distinct table (M1 coverage)", () => {
    fc.assert(
      fc.property(dualityViewArbitrary(), (view) => {
        const sql = emitSqlJson(view);
        const aliasMap = parseAliasMap(sql);
        // Invert: table → set of aliases
        const tableToAliases = new Map<string, Set<string>>();
        for (const [alias, table] of aliasMap) {
          if (!tableToAliases.has(table)) tableToAliases.set(table, new Set());
          tableToAliases.get(table)!.add(alias);
        }
        // Assert: no two distinct tables share the same alias
        const aliasToTables = new Map<string, Set<string>>();
        for (const [alias, table] of aliasMap) {
          if (!aliasToTables.has(alias)) aliasToTables.set(alias, new Set());
          aliasToTables.get(alias)!.add(table);
        }
        for (const [alias, tables] of aliasToTables) {
          if (tables.size > 1) {
            // Two distinct tables share the same alias — M1 violation
            return false;
          }
          void alias;
        }
        return true;
      }),
      { numRuns: 10_000 },
    );
  });
});
