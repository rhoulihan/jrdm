// @tested-by: packages/generator-duality/src/__tests__/arbitrary.test.ts
import fc from "fast-check";
import type { AnyField, DualityView, NestedField, ScalarField } from "@jrdm/model";

const ident = fc.stringMatching(/^[a-z][a-z0-9_]{0,11}$/).filter((s) => s.length > 0);

const permissions = fc.record({
  insert: fc.boolean(),
  update: fc.boolean(),
  delete: fc.boolean(),
});

function scalar(table: string): fc.Arbitrary<ScalarField> {
  return fc.record(
    {
      key: ident,
      source: ident.map((c) => `${table}.${c}`),
      etag: fc.option(fc.constantFrom<"check" | "nocheck">("check", "nocheck"), { nil: undefined }),
      noupdate: fc.option(fc.boolean(), { nil: undefined }),
    },
    { requiredKeys: ["key", "source"] },
  );
}

/**
 * nested() now accepts an optional list of ancestor/sibling table names so that
 * ~40% of nested fields pick a table from the existing pool (exercising AliasContext
 * collision handling / M1) and ~60% get a fresh ident.
 */
function nested(depth: number, knownTables: string[]): fc.Arbitrary<NestedField> {
  // Choose table: ~40% from known pool (if non-empty), ~60% fresh ident
  const tableArb: fc.Arbitrary<string> =
    knownTables.length > 0
      ? fc.oneof(
          { weight: 6, arbitrary: ident },
          { weight: 4, arbitrary: fc.constantFrom(...knownTables) },
        )
      : ident;

  return tableArb.chain((table) =>
    fc.record(
      {
        key: ident,
        kind: fc.constantFrom<"object" | "unnest" | "array">("object", "unnest", "array"),
        table: fc.constant(table),
        permissions: fc.option(permissions, { nil: undefined }),
        etag: fc.option(fc.constantFrom<"check" | "nocheck">("check", "nocheck"), {
          nil: undefined,
        }),
        link: fc.integer({ min: 1, max: 2 }).chain((n) =>
          fc.record({
            from: fc.array(ident, { minLength: n, maxLength: n }),
            to: fc.array(ident, { minLength: n, maxLength: n }),
          }),
        ),
        fields: fields(table, depth - 1, [...knownTables, table]),
      },
      { requiredKeys: ["key", "kind", "table", "link", "fields"] },
    ),
  );
}

function fields(table: string, depth: number, knownTables: string[]): fc.Arbitrary<AnyField[]> {
  const leaf = scalar(table);
  const node: fc.Arbitrary<AnyField> =
    depth <= 0
      ? leaf
      : fc.oneof(
          { weight: 3, arbitrary: leaf },
          { weight: 1, arbitrary: nested(depth, knownTables) },
        );
  return fc.array(node, { minLength: 1, maxLength: 4 });
}

export function dualityViewArbitrary(): fc.Arbitrary<DualityView> {
  return ident.chain((rootTable) =>
    fc.record({
      name: ident.map((s) => `${s}_dv`),
      schema: ident,
      createMode: fc.constantFrom<"create" | "orReplace">("create", "orReplace"),
      replication: fc.option(fc.constantFrom<"enable" | "disable">("enable", "disable"), {
        nil: undefined,
      }),
      root: fc.record({
        table: fc.constant(rootTable),
        permissions,
        etag: fc.constantFrom<"check" | "nocheck">("check", "nocheck"),
      }),
      fields: fields(rootTable, 2, [rootTable]).map((rest) => [
        { key: "_id", source: `${rootTable}.id` },
        ...rest,
      ]),
    }),
  );
}
