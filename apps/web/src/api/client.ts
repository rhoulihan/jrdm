import type { ImportPayload } from "../state/store";
import type { DualityView } from "@jrdm/model";
import { buildDdlRequestBody } from "../ddl/ddlRequest";

export interface ImportRequest {
  connection: { user: string; password: string; connectString: string };
  schemaOwner: string;
  projectName: string;
  projectVersion?: string;
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Shared `!res.ok` handler — parses `{message|error}` and throws `ApiError`. */
async function throwIfNotOk(res: Response): Promise<void> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string; error?: string };
      msg = j.message ?? j.error ?? msg;
    } catch {
      /* non-JSON error body — keep default msg */
    }
    throw new ApiError(res.status, msg);
  }
}

export async function importOracle(req: ImportRequest): Promise<ImportPayload> {
  const res = await fetch("/api/import/oracle", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string; error?: string };
      msg = j.message ?? j.error ?? msg;
    } catch {
      /* non-JSON error body — keep default msg */
    }
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as ImportPayload;
}

export interface DdlPreview {
  kind: "sql" | "graphql";
  ddl: string;
}

export async function fetchDdlPreview(
  view: DualityView,
  syntax: "sql" | "graphql",
): Promise<DdlPreview> {
  const res = await fetch("/api/ddl/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildDdlRequestBody(view, syntax)),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string; error?: string };
      msg = j.message ?? j.error ?? msg;
    } catch {
      /* non-JSON */
    }
    throw new ApiError(res.status, msg);
  }
  const j = (await res.json()) as { sql?: string; graphql?: string };
  if (syntax === "graphql") return { kind: "graphql", ddl: j.graphql ?? "" };
  return { kind: "sql", ddl: j.sql ?? "" };
}

export interface OracleConn {
  user: string;
  password: string;
  connectString: string;
}

export async function deployView(
  view: DualityView,
  connection: OracleConn,
  preDdl?: string[],
): Promise<{ deployed: boolean; statements?: number; view?: string; errors?: unknown[] }> {
  const res = await fetch("/api/deploy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ view, connection, ...(preDdl !== undefined ? { preDdl } : {}) }),
  });
  await throwIfNotOk(res);
  return (await res.json()) as {
    deployed: boolean;
    statements?: number;
    view?: string;
    errors?: unknown[];
  };
}

export async function sampleDocuments(
  view: DualityView,
  connection: OracleConn,
  limit = 5,
): Promise<{ documents: unknown[] }> {
  const res = await fetch("/api/sample", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ view, connection, limit }),
  });
  await throwIfNotOk(res);
  return (await res.json()) as { documents: unknown[] };
}

export async function readDocument(
  view: DualityView,
  connection: OracleConn,
  id: string | number,
): Promise<{ document: Record<string, unknown> }> {
  const res = await fetch("/api/document/read", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ view, connection, id }),
  });
  await throwIfNotOk(res);
  return (await res.json()) as { document: Record<string, unknown> };
}

export async function writeDocument(
  view: DualityView,
  connection: OracleConn,
  id: string | number,
  doc: Record<string, unknown>,
): Promise<{ document: Record<string, unknown> }> {
  const res = await fetch("/api/document/write", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ view, connection, id, doc }),
  });
  await throwIfNotOk(res);
  return (await res.json()) as { document: Record<string, unknown> };
}

export async function createSandbox(
  connection: OracleConn,
  projectId: string,
  password: string,
): Promise<{ created: boolean; schema: string }> {
  const res = await fetch("/api/sandbox", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ connection, projectId, password }),
  });
  await throwIfNotOk(res);
  return (await res.json()) as { created: boolean; schema: string };
}

export async function dropSandbox(
  connection: OracleConn,
  projectId: string,
): Promise<{ dropped: boolean; schema: string }> {
  const res = await fetch("/api/sandbox", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ connection, projectId }),
  });
  await throwIfNotOk(res);
  return (await res.json()) as { dropped: boolean; schema: string };
}
