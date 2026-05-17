import type { QueryConnection } from "./query";

export class SampleParseError extends Error {
  constructor(msg: string) {
    super(`SampleParseError: ${msg}`);
    this.name = "SampleParseError";
  }
}

export function sampleQuery(schema: string, view: string, limit: number): string {
  const n = Math.max(1, Math.min(50, Math.trunc(limit) || 1));
  return `SELECT JSON_SERIALIZE(data PRETTY) AS DOC FROM ${schema}.${view} FETCH FIRST ${n} ROWS ONLY`;
}

export function parseSampleRows(rows: { DOC: string }[]): unknown[] {
  return rows.map((r) => {
    try {
      return JSON.parse(r.DOC) as unknown;
    } catch {
      throw new SampleParseError("row DOC was not valid JSON");
    }
  });
}

export async function sampleDocuments(
  qc: QueryConnection,
  schema: string,
  view: string,
  limit = 5,
): Promise<unknown[]> {
  const rows = await qc.query<{ DOC: string }>(sampleQuery(schema, view, limit));
  return parseSampleRows(rows);
}
