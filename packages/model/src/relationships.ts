import type { Entity, Relationship } from "./schemas";

function sameColumnSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function deriveRelationships(entities: Entity[]): Relationship[] {
  const byTable = new Map(entities.map((e) => [`${e.schema}.${e.name}`, e]));
  const rels: Relationship[] = [];

  for (const e of entities) {
    for (const fk of e.foreignKeys ?? []) {
      const refKey = `${fk.references.schema}.${fk.references.table}`;
      if (!byTable.has(refKey)) continue; // dangling — referenced table not in set

      const childIsUnique =
        (e.uniqueKeys ?? []).some((uk) => sameColumnSet(uk, fk.columns)) ||
        sameColumnSet(e.primaryKey, fk.columns);

      rels.push({
        name: fk.name,
        from: { schema: e.schema, table: e.name, columns: fk.columns },
        to: {
          schema: fk.references.schema,
          table: fk.references.table,
          columns: fk.references.columns,
        },
        cardinality: childIsUnique ? "1:1" : "1:N",
      });
    }
  }

  return rels;
}
