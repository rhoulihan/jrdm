import type { Entity, Relationship } from "@jrdm/model";
import { deriveRelationships } from "@jrdm/model";

export interface Junction {
  table: string;
  between: [string, string];
  fks: [string, string];
}

export interface CardinalityResult {
  relationships: Relationship[];
  junctions: Junction[];
}

function sortedEq(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function isPureJunction(e: Entity): boolean {
  const fks = e.foreignKeys ?? [];
  if (fks.length !== 2) return false;
  const fkCols = new Set(fks.flatMap((f) => f.columns));
  // every column is part of an FK, and the PK is exactly the union of the two FK column sets
  const allColsAreFk = e.columns.every((c) => fkCols.has(c.name));
  const pkIsFkUnion = sortedEq(e.primaryKey, [...fkCols]);
  return allColsAreFk && pkIsFkUnion;
}

export function classifyCardinality(entities: Entity[]): CardinalityResult {
  const relationships = deriveRelationships(entities);
  const junctions: Junction[] = [];

  for (const e of entities) {
    if (!isPureJunction(e)) continue;
    const [f1, f2] = e.foreignKeys!;
    junctions.push({
      table: e.name,
      between: [f1!.references.table, f2!.references.table],
      fks: [f1!.name, f2!.name],
    });
  }

  return { relationships, junctions };
}
