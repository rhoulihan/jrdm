import type { Relationship } from "@jrdm/model";

export interface EmbedDecision {
  /** "array" for a 1:N parent→child, "object" otherwise. */
  kind: "array" | "object";
  /**
   * Asymmetric join contract (v0.4.2 I3 / SQL emitter `child.<to> = parent.<from>`):
   *  - `link.from` = the PARENT (P) node's columns
   *  - `link.to`   = the CHILD (T) node's columns
   * (See packages/generator-duality/src/emit-sql-json.ts joinPredicate.)
   */
  link: { from: string[]; to: string[] };
  /** true when an FK unambiguously decided kind+link (checkbox forced in UI). */
  fkDriven: boolean;
  /** the relationship that drove the decision, if any. */
  rel?: Relationship;
}

/**
 * §4 FK-aware embed rule. Given the parent node's table P and the child
 * entity-table T being placed under it, decide array-vs-object and the join.
 *
 * `Relationship.from` = PK/parent side, `Relationship.to` = FK/child side.
 *
 *  1. from=P, to=T, 1:N  → array,  link.from=P cols, link.to=T cols, fkDriven
 *  2. from=P, to=T, 1:1  → object, same join columns,                fkDriven
 *  3. reversed (from=T, to=P) → object; relative to parent=P the link is
 *     from=P cols (the rel's `to` cols, which live on P), to=T cols
 *     (the rel's `from` cols, which live on T),                       fkDriven
 *  4. no relationship    → object, blank link,                        not fkDriven
 */
export function decideEmbed(
  relationships: Relationship[],
  parentTable: string,
  childTable: string,
): EmbedDecision {
  // Prefer a direct P→T relationship (rows 1/2) over a reversed one (row 3).
  const direct = relationships.find(
    (r) => r.from.table === parentTable && r.to.table === childTable,
  );
  if (direct) {
    return {
      kind: direct.cardinality === "1:N" ? "array" : "object",
      link: { from: [...direct.from.columns], to: [...direct.to.columns] },
      fkDriven: true,
      rel: direct,
    };
  }

  // Reversed: the relationship's parent side is the child table T.
  const reversed = relationships.find(
    (r) => r.from.table === childTable && r.to.table === parentTable,
  );
  if (reversed) {
    // Relative to the document parent P: P holds the rel's `to` columns
    // (the FK side), T holds the rel's `from` columns (the PK side).
    return {
      kind: "object",
      link: { from: [...reversed.to.columns], to: [...reversed.from.columns] },
      fkDriven: true,
      rel: reversed,
    };
  }

  // No relationship: default to object with a blank link; the user decides.
  return { kind: "object", link: { from: [], to: [] }, fkDriven: false };
}
