// @tested-by: packages/exec/src/__tests__/query.integration.test.ts
import oracledb from "oracledb";
import type { OracleConnectParams } from "./connect";

export interface QueryConnection {
  query<T>(sql: string, binds?: oracledb.BindParameters): Promise<T[]>;
  execute(sql: string, binds?: oracledb.BindParameters): Promise<number>; // rowsAffected, autoCommit
  close(): Promise<void>;
}

export async function openQueryConnection(p: OracleConnectParams): Promise<QueryConnection> {
  const c = await oracledb.getConnection(p);
  return {
    query: async <T>(sql: string, binds: oracledb.BindParameters = {}) => {
      const r = await c.execute<T>(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows ?? [];
    },
    execute: async (sql: string, binds: oracledb.BindParameters = {}) => {
      const r = await c.execute(sql, binds, { autoCommit: true });
      return r.rowsAffected ?? 0;
    },
    close: () => c.close(),
  };
}
