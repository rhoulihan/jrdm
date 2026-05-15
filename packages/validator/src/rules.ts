import type { Entity } from "@jrdm/model";

export interface Issue {
  code: string;
  severity: "error" | "warning";
  message: string;
  path: (string | number)[];
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
