import type { Entity, Column, ForeignKey, SupportedType } from "@jrdm/model";
import { SUPPORTED_TYPES } from "@jrdm/model";

export interface ColumnRow {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  DATA_TYPE: string;
  DATA_PRECISION: number | null;
  DATA_SCALE: number | null;
  CHAR_LENGTH: number | null;
  NULLABLE: string;
  DATA_DEFAULT: string | null;
  COLUMN_ID: number;
}

export interface KeyRow {
  CONSTRAINT_NAME: string;
  CONSTRAINT_TYPE: string; // 'P' | 'U'
  TABLE_NAME: string;
  COLUMN_NAME: string;
  POSITION: number;
}

export interface FkRow {
  CONSTRAINT_NAME: string;
  TABLE_NAME: string;
  COLUMN_NAME: string;
  POSITION: number;
  REF_TABLE: string;
  REF_COLUMN: string;
  REF_POSITION: number;
  REF_OWNER: string;
}

const SUPPORTED = new Set<string>(SUPPORTED_TYPES);

function normalizeType(dataType: string): SupportedType {
  const t = dataType.toUpperCase();
  if (SUPPORTED.has(t)) return t as SupportedType;
  // Oracle reports e.g. "TIMESTAMP(6)" — strip parenthetical precision
  const base = t.replace(/\(.*\)/, "").trim();
  if (SUPPORTED.has(base)) return base as SupportedType;
  // Map common dictionary spellings
  if (base.startsWith("TIMESTAMP")) return "TIMESTAMP";
  return "VARCHAR2"; // safe default; validator/user can correct
}

function mapColumn(r: ColumnRow): Column {
  const col: Column = {
    name: r.COLUMN_NAME.toLowerCase(),
    type: normalizeType(r.DATA_TYPE),
    nullable: r.NULLABLE === "Y",
  };
  if (r.DATA_PRECISION != null) col.precision = r.DATA_PRECISION;
  if (r.DATA_SCALE != null) col.scale = r.DATA_SCALE;
  if (r.CHAR_LENGTH != null && r.CHAR_LENGTH > 0) col.length = r.CHAR_LENGTH;
  if (r.DATA_DEFAULT != null) col.default = String(r.DATA_DEFAULT).trim();
  return col;
}

export function mapRowsToEntities(
  schemaOwner: string,
  tableNames: string[],
  columns: ColumnRow[],
  keys: KeyRow[],
  fks: FkRow[],
): Entity[] {
  const schema = schemaOwner.toLowerCase();

  return tableNames.map((tn) => {
    const tableCols = columns
      .filter((c) => c.TABLE_NAME === tn)
      .sort((a, b) => a.COLUMN_ID - b.COLUMN_ID)
      .map(mapColumn);

    const tableKeys = keys.filter((k) => k.TABLE_NAME === tn);
    const pkRows = tableKeys
      .filter((k) => k.CONSTRAINT_TYPE === "P")
      .sort((a, b) => a.POSITION - b.POSITION);
    const primaryKey = pkRows.map((k) => k.COLUMN_NAME.toLowerCase());

    const ukByName = new Map<string, KeyRow[]>();
    for (const k of tableKeys.filter((k) => k.CONSTRAINT_TYPE === "U")) {
      const arr = ukByName.get(k.CONSTRAINT_NAME) ?? [];
      arr.push(k);
      ukByName.set(k.CONSTRAINT_NAME, arr);
    }
    const uniqueKeys = [...ukByName.values()].map((rows) =>
      rows.sort((a, b) => a.POSITION - b.POSITION).map((r) => r.COLUMN_NAME.toLowerCase()),
    );

    const fkByName = new Map<string, FkRow[]>();
    for (const f of fks.filter((f) => f.TABLE_NAME === tn)) {
      const arr = fkByName.get(f.CONSTRAINT_NAME) ?? [];
      arr.push(f);
      fkByName.set(f.CONSTRAINT_NAME, arr);
    }
    const foreignKeys: ForeignKey[] = [...fkByName.entries()].map(([name, rows]) => {
      const ordered = rows.sort((a, b) => a.POSITION - b.POSITION);
      return {
        name: name.toLowerCase(),
        columns: ordered.map((r) => r.COLUMN_NAME.toLowerCase()),
        references: {
          schema: (ordered[0]!.REF_OWNER || schemaOwner).toLowerCase(),
          table: ordered[0]!.REF_TABLE.toLowerCase(),
          columns: ordered.map((r) => r.REF_COLUMN.toLowerCase()),
        },
      };
    });

    const entity: Entity = {
      name: tn.toLowerCase(),
      schema,
      columns: tableCols,
      primaryKey,
    };
    if (uniqueKeys.length > 0) entity.uniqueKeys = uniqueKeys;
    if (foreignKeys.length > 0) entity.foreignKeys = foreignKeys;
    return entity;
  });
}
