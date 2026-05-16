import type { Entity, Project } from "@jrdm/model";

export interface Issue {
  code: string;
  severity: "error" | "warning";
  message: string;
  path: (string | number)[];
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function validateEntity(entity: Entity): Issue[] {
  const issues: Issue[] = [];

  if (entity.primaryKey.length === 0) {
    issues.push({
      code: "PK_REQUIRED",
      severity: "error",
      message: `Entity ${entity.name} has no primary key; duality view roots require one`,
      path: ["primaryKey"],
    });
  }

  const seen = new Set<string>();
  for (let i = 0; i < entity.columns.length; i++) {
    const col = entity.columns[i]!;
    if (seen.has(col.name)) {
      issues.push({
        code: "DUPLICATE_COLUMN",
        severity: "error",
        message: `Duplicate column name: ${col.name}`,
        path: ["columns", i, "name"],
      });
    }
    seen.add(col.name);
  }

  return issues;
}

export function validateRelationships(entities: Entity[]): Issue[] {
  const issues: Issue[] = [];
  const byTable = new Map(entities.map((e) => [`${e.schema}.${e.name}`, e]));

  for (const e of entities) {
    for (let f = 0; f < (e.foreignKeys ?? []).length; f++) {
      const fk = e.foreignKeys![f]!;
      const target = byTable.get(`${fk.references.schema}.${fk.references.table}`);
      if (!target) {
        issues.push({
          code: "FK_DANGLING_TABLE",
          severity: "error",
          message: `FK ${fk.name} on ${e.name} references unknown table ${fk.references.schema}.${fk.references.table}`,
          path: ["entities", e.name, "foreignKeys", f],
        });
        continue;
      }
      const refCols = fk.references.columns;
      const isPk = sameSet(target.primaryKey, refCols);
      const isUk = (target.uniqueKeys ?? []).some((uk) => sameSet(uk, refCols));
      if (!isPk && !isUk) {
        issues.push({
          code: "FK_TARGET_NOT_KEY",
          severity: "error",
          message: `FK ${fk.name} references ${fk.references.table}(${refCols.join(",")}) which is not its PK or a unique key`,
          path: ["entities", e.name, "foreignKeys", f, "references"],
        });
      }
    }
  }

  return issues;
}

export function validateProject(project: Project): Issue[] {
  const issues: Issue[] = [];
  for (const e of project.entities) {
    for (const issue of validateEntity(e)) {
      issues.push({ ...issue, path: ["entities", e.name, ...issue.path] });
    }
  }
  issues.push(...validateRelationships(project.entities));
  return issues;
}
