import type { ImportPayload } from "../state/store";

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
