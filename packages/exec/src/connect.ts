// @tested-by: packages/exec/src/__tests__/connect.integration.test.ts
import oracledb from "oracledb";
import type { Connection } from "./deploy";

export interface OracleConnectParams {
  user: string;
  password: string;
  connectString: string; // host:port/service
}

export async function openOracleConnection(p: OracleConnectParams): Promise<Connection> {
  const c = await oracledb.getConnection(p);
  return {
    execute: async (sql) => {
      const r = await c.execute(sql, [], { autoCommit: false });
      return { rowsAffected: r.rowsAffected ?? 0 };
    },
    commit: () => c.commit(),
    close: () => c.close(),
  };
}
