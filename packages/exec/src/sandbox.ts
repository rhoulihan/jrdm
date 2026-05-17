import type { Connection } from "./deploy";
import type { QueryConnection } from "./query";

export function sandboxSchemaName(projectId: string): string {
  const cleaned = projectId.toUpperCase().replace(/[^A-Z0-9_]/g, "");
  return `JRDM_PROJ_${cleaned}`.slice(0, 30);
}

export function createSandboxDdl(name: string, password: string): string[] {
  return [
    `CREATE USER "${name}" IDENTIFIED BY "${password}"`,
    `GRANT CONNECT, RESOURCE, UNLIMITED TABLESPACE TO "${name}"`,
  ];
}

export function dropSandboxDdl(name: string): string[] {
  return [`DROP USER "${name}" CASCADE`];
}

export async function createSandbox(
  admin: Connection,
  name: string,
  password: string,
): Promise<void> {
  for (const s of createSandboxDdl(name, password)) await admin.execute(s);
  await admin.commit();
}

export async function dropSandbox(admin: QueryConnection, name: string): Promise<void> {
  // idempotent: ignore "user does not exist" (ORA-01918)
  try {
    await admin.execute(dropSandboxDdl(name)[0]!);
  } catch (e) {
    if (!/ORA-01918/.test(String(e))) throw e;
  }
}
