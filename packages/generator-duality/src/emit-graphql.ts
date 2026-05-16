import type { AnyField, DualityView, NestedField, Permissions, ScalarField } from "@jrdm/model";
import { MissingLinkError } from "./emit-sql-json";

function isNested(f: AnyField): f is NestedField {
  return "kind" in f;
}

function createPrefix(mode: DualityView["createMode"]): string {
  return mode === "orReplace"
    ? "CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW"
    : "CREATE JSON RELATIONAL DUALITY VIEW";
}

function anns(p: Permissions | undefined): string {
  if (!p) return "";
  const a: string[] = [];
  if (p.insert) a.push("@insert");
  if (p.update) a.push("@update");
  if (p.delete) a.push("@delete");
  return a.length ? " " + a.join(" ") : "";
}

function scalarCol(source: string): string {
  const dot = source.lastIndexOf(".");
  return dot >= 0 ? source.slice(dot + 1) : source;
}

function emitScalar(f: ScalarField): string {
  let s = `${f.key} : ${scalarCol(f.source)}`;
  if (f.etag === "nocheck") s += " @nocheck";
  if (f.noupdate) s += " @noupdate";
  return s;
}

function emitField(f: AnyField, indent: string): string {
  if (isNested(f)) {
    return emitNested(f, indent);
  }
  return emitScalar(f);
}

function emitNested(f: NestedField, indent: string): string {
  if (!f.link || f.link.length === 0) throw new MissingLinkError(f.key);
  const nodeAnns = anns(f.permissions);
  const unnest = f.kind === "unnest" ? " @unnest" : "";
  const nocheck = f.etag === "nocheck" ? " @nocheck" : "";
  const link = ` @link(to : [${f.link.map((c) => `"${c}"`).join(", ")}])`;
  const childIndent = indent + "  ";
  const body = f.fields.map((c) => childIndent + emitField(c, childIndent)).join("\n");
  const open = `${f.key} : ${f.table}${unnest}${nodeAnns}${nocheck}${link}`;
  if (f.kind === "array") {
    return `${open} [ {\n${body}\n${indent}} ]`;
  }
  // object | unnest
  return `${open} {\n${body}\n${indent}}`;
}

export function emitGraphql(view: DualityView): string {
  const create = createPrefix(view.createMode);
  const rootAnns = anns(view.root.permissions);
  const indent = "  ";
  const body = view.fields.map((f) => indent + emitField(f, indent)).join("\n");
  let out =
    `${create} ${view.schema}.${view.name} AS\n` + `${view.root.table}${rootAnns} {\n${body}\n}`;
  if (view.replication === "enable") out += "\nENABLE LOGICAL REPLICATION";
  else if (view.replication === "disable") out += "\nDISABLE LOGICAL REPLICATION";
  return out + ";";
}
