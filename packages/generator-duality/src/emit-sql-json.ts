import type { DualityView, Permissions, ScalarField } from "@jrdm/model";

export function emitSqlJson(view: DualityView): string {
  const create = createPrefix(view.createMode);
  const rootAlias = aliasFor(view.root.table);
  const fields = view.fields
    .filter((f): f is ScalarField => "source" in f)
    .map((f) => emitScalar(f, rootAlias))
    .join(",\n  ");
  const rootDml = emitDml(view.root.permissions);

  return [
    `${create} JSON RELATIONAL DUALITY VIEW ${view.schema}.${view.name} AS`,
    `SELECT JSON {`,
    `  ${fields}`,
    `}`,
    `FROM ${view.root.table} ${rootAlias}${rootDml};`,
  ].join("\n");
}

function createPrefix(mode: DualityView["createMode"]): string {
  switch (mode) {
    case "create":
      return "CREATE";
    case "orReplace":
      return "CREATE OR REPLACE";
    case "ifNotExists":
      return "CREATE IF NOT EXISTS";
  }
}

function emitDml(p: Permissions): string {
  const parts: string[] = [];
  if (p.insert) parts.push("INSERT");
  if (p.update) parts.push("UPDATE");
  if (p.delete) parts.push("DELETE");
  return parts.length === 0 ? "" : ` WITH ${parts.join(" ")}`;
}

function aliasFor(table: string): string {
  const parts = table.split("_");
  if (parts.length === 1) return table[0]!.toLowerCase();
  return parts
    .map((p) => p[0])
    .join("")
    .toLowerCase();
}

function emitScalar(field: ScalarField, rootAlias: string): string {
  const [, col] = field.source.split(".");
  return `'${field.key}' : ${rootAlias}.${col ?? field.source}`;
}
