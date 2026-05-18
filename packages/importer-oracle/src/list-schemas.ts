import type { QueryExec } from "./import-schema";

// Non-Oracle-maintained schemas that own at least one table — least clutter.
export const LIST_SCHEMAS_SQL =
  "SELECT DISTINCT t.OWNER AS SCHEMA_NAME " +
  "FROM ALL_TABLES t JOIN ALL_USERS u ON u.USERNAME = t.OWNER " +
  "WHERE u.ORACLE_MAINTAINED = 'N' ORDER BY t.OWNER";

export async function listSchemas(exec: QueryExec): Promise<string[]> {
  const rows = await exec<{ SCHEMA_NAME: string }>(LIST_SCHEMAS_SQL);
  return rows
    .map((r) => r.SCHEMA_NAME)
    .filter(Boolean)
    .sort();
}
