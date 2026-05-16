// @tested-by: packages/model/src/__tests__/view-schemas.test.ts
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
