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
