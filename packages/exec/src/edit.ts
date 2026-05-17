import type { QueryConnection } from "./query";

export class EtagMissingError extends Error {
  constructor() {
    super("EtagMissingError: document has no _metadata.etag");
    this.name = "EtagMissingError";
  }
}
type Doc = Record<string, unknown> & { _metadata?: { etag?: string } };

export function readDocSql(schema: string, view: string): string {
  return `SELECT JSON_SERIALIZE(data PRETTY) AS DOC FROM ${schema}.${view} WHERE JSON_VALUE(data,'$._id') = :id`;
}
export function writeDocSql(schema: string, view: string): string {
  return `UPDATE ${schema}.${view} v SET data = :doc WHERE JSON_VALUE(v.data,'$._id') = :id`;
}
export function etagOf(doc: Doc): string {
  const e = doc._metadata?.etag;
  if (!e) throw new EtagMissingError();
  return e;
}
export function stripMetadata(doc: Doc): Record<string, unknown> {
  const { _metadata, ...rest } = doc;
  void _metadata;
  return rest;
}

export async function readDocument(
  qc: QueryConnection,
  schema: string,
  view: string,
  id: string | number,
): Promise<Doc> {
  const rows = await qc.query<{ DOC: string }>(readDocSql(schema, view), { id: String(id) });
  if (rows.length === 0) throw new Error(`document _id=${id} not found`);
  return JSON.parse(rows[0]!.DOC) as Doc;
}

/** Writes the doc back. Oracle enforces the ETag automatically from the embedded
 *  _metadata.etag on the row; a stale doc → ORA-42699 (surfaced to caller). */
export async function writeDocument(
  qc: QueryConnection,
  schema: string,
  view: string,
  id: string | number,
  doc: Doc,
): Promise<{ etag: string }> {
  const affected = await qc.execute(writeDocSql(schema, view), {
    doc: JSON.stringify(doc),
    id: String(id),
  });
  if (affected === 0) throw new Error(`document _id=${id} not updated (not found or no-op)`);
  const fresh = await readDocument(qc, schema, view, id);
  return { etag: etagOf(fresh) };
}
