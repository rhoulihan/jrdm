export interface Connection {
  execute(sql: string): Promise<{ rowsAffected: number }>;
  commit(): Promise<void>;
  close(): Promise<void>;
}

export interface DeployResult {
  statements: number;
  errors: { statementIndex: number; message: string }[];
}

export async function deployDdl(conn: Connection, statements: string[]): Promise<DeployResult> {
  const errors: DeployResult["errors"] = [];
  let executed = 0;
  for (let i = 0; i < statements.length; i++) {
    try {
      await conn.execute(statements[i]!);
      executed++;
    } catch (e) {
      errors.push({
        statementIndex: i,
        message: e instanceof Error ? e.message : String(e),
      });
      break;
    }
  }
  if (errors.length === 0) await conn.commit();
  return { statements: executed, errors };
}
