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

function emitField(f: AnyField, parentAlias: string, _ctx: AliasContext): string {
  if (isNested(f)) {
    throw new UnsupportedFieldError(f.key, f.kind);
  }
  return emitScalar(f, parentAlias);
}

export function emitSqlJson(view: DualityView): string {
  const ctx = new AliasContext();
  const rootAlias = ctx.aliasFor(view.root.table);
  const create = createPrefix(view.createMode);
  const body = view.fields.map((f) => emitField(f, rootAlias, ctx)).join(",\n  ");
  const rootDml = emitDml(view.root.permissions);

  return [
    `${create} ${view.schema}.${view.name} AS`,
    `SELECT JSON {`,
    `  ${body}`,
    `}`,
    `FROM ${view.root.table} ${rootAlias}${rootDml};`,
  ].join("\n");
}
