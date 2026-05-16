// @tested-by: packages/model/src/__tests__/schemas.test.ts
export const SUPPORTED_TYPES = [
  "JSON",
  "BLOB",
  "CLOB",
  "NCLOB",
  "VARCHAR2",
  "NVARCHAR2",
  "CHAR",
  "NCHAR",
  "RAW",
  "BOOLEAN",
  "DATE",
  "TIMESTAMP",
  "TIMESTAMP WITH TIME ZONE",
  "INTERVAL YEAR TO MONTH",
  "INTERVAL DAY TO SECOND",
  "NUMBER",
  "BINARY_DOUBLE",
  "BINARY_FLOAT",
  "VECTOR",
] as const;

export type SupportedType = (typeof SUPPORTED_TYPES)[number];

export interface Column {
  name: string;
  type: SupportedType;
  nullable: boolean;
  precision?: number;
  scale?: number;
  length?: number;
  default?: string;
  comment?: string;
}

export interface Entity {
  name: string;
  schema: string;
  columns: Column[];
  primaryKey: string[];
  uniqueKeys?: string[][];
  comment?: string;
}

export type CreateMode = "create" | "orReplace" | "ifNotExists";
export type EtagPolicy = "check" | "nocheck";

export interface Permissions {
  insert: boolean;
  update: boolean;
  delete: boolean;
}

export interface ScalarField {
  key: string;
  source: string;
  etag?: EtagPolicy;
  noupdate?: boolean;
}

export interface ObjectField {
  key: string;
  kind: "object" | "unnest";
  table: string;
  permissions?: Permissions;
  etag?: EtagPolicy;
  link?: string[];
  fields: AnyField[];
}

export interface ArrayField {
  key: string;
  kind: "array";
  table: string;
  permissions?: Permissions;
  etag?: EtagPolicy;
  link?: string[];
  fields: AnyField[];
}

export type AnyField = ScalarField | ObjectField | ArrayField;

export interface DualityView {
  name: string;
  schema: string;
  createMode: CreateMode;
  replication?: "enable" | "disable";
  root: {
    table: string;
    permissions: Permissions;
    etag: EtagPolicy;
  };
  fields: AnyField[];
}
