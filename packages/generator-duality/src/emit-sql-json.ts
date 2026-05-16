import type { AnyField, DualityView, NestedField, Permissions, ScalarField } from "@jrdm/model";
import { AliasContext } from "./alias";

export class UnsupportedFieldError extends Error {
  constructor(key: string, kind: string) {
    super(
      `UnsupportedFieldError: field "${key}" (kind "${kind}") is not supported by the SQL/JSON emitter yet`,
    );
    this.name = "UnsupportedFieldError";
  }
}

export class MissingLinkError extends Error {
  constructor(key: string) {
    super(
      `MissingLinkError: nested field "${key}" requires a non-empty "link" (join columns) to emit DDL`,
    );
    this.name = "MissingLinkError";
  }
}

function isNested(f: AnyField): f is NestedField {
  return "kind" in f;
}

function createPrefix(mode: DualityView["createMode"]): string {
  return mode === "orReplace"
    ? "CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW"
    : "CREATE JSON RELATIONAL DUALITY VIEW";
}

function emitDml(p: Permissions | undefined): string {
  if (!p) return "";
  const parts: string[] = [];
  if (p.insert) parts.push("INSERT");
  if (p.update) parts.push("UPDATE");
  if (p.delete) parts.push("DELETE");
  return parts.length === 0 ? "" : ` WITH ${parts.join(" ")}`;
}

function emitScalar(field: ScalarField, alias: string): string {
  const dot = field.source.lastIndexOf(".");
  const col = dot >= 0 ? field.source.slice(dot + 1) : field.source;
  let s = `'${field.key}' : ${alias}.${col}`;
  if (field.noupdate) s += " WITH NOUPDATE";
  if (field.etag === "nocheck") s += " WITH NOCHECK";
  return s;
}

function joinPredicate(childAlias: string, parentAlias: string, link: string[]): string {
  return link.map((c) => `${childAlias}.${c} = ${parentAlias}.${c}`).join(" AND ");
}

function emitChildBody(fields: AnyField[], alias: string, ctx: AliasContext): string {
  return fields.map((f) => emitField(f, alias, ctx)).join(",\n    ");
}

function emitNested(f: NestedField, parentAlias: string, ctx: AliasContext): string {
  if (!f.link || f.link.length === 0) throw new MissingLinkError(f.key);
  const childAlias = ctx.aliasFor(f.table);
  const dml = emitDml(f.permissions);
  const check = f.etag === "nocheck" ? " WITH NOCHECK" : "";
  const where = joinPredicate(childAlias, parentAlias, f.link);
  const inner = emitChildBody(f.fields, childAlias, ctx);
  const sub = `SELECT JSON {\n    ${inner}\n  } FROM ${f.table} ${childAlias}${dml}${check} WHERE ${where}`;

  if (f.kind === "unnest") {
    return `UNNEST ( ${sub} )`;
  }
  if (f.kind === "object") {
    return `'${f.key}' : ( ${sub} )`;
  }
  // kind === "array" — implemented in Task 4
  return emitArray(f, sub);
}

function emitArray(f: NestedField, sub: string): string {
  return `'${f.key}' : [ ${sub} ]`;
}

function emitField(f: AnyField, parentAlias: string, ctx: AliasContext): string {
  if (isNested(f)) {
    return emitNested(f, parentAlias, ctx);
  }
  return emitScalar(f, parentAlias);
}

export function emitSqlJson(view: DualityView): string {
  const ctx = new AliasContext();
  const rootAlias = ctx.aliasFor(view.root.table);
  const create = createPrefix(view.createMode);
  const body = view.fields.map((f) => emitField(f, rootAlias, ctx)).join(",\n  ");
  const rootDml = emitDml(view.root.permissions);

  const rootCheck = view.root.etag === "nocheck" ? " WITH NOCHECK" : "";
  const lines = [
    `${create} ${view.schema}.${view.name} AS`,
    `SELECT JSON {`,
    `  ${body}`,
    `}`,
    `FROM ${view.root.table} ${rootAlias}${rootDml}${rootCheck}`,
  ];
  if (view.replication === "enable") lines.push("ENABLE LOGICAL REPLICATION");
  else if (view.replication === "disable") lines.push("DISABLE LOGICAL REPLICATION");
  return lines.join("\n") + ";";
}
