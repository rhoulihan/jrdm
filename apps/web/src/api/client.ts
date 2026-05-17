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
