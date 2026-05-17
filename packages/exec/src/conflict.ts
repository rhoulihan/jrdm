import type { QueryConnection } from "./query";
import { readDocument, writeDocument } from "./edit";

export function isEtagConflict(e: unknown): boolean {
  return /ORA-42699/.test(String(e instanceof Error ? e.message : e));
}

export interface ConflictOutcome {
  firstWriteEtag: string;
  secondWriteConflicted: boolean;
  error?: string;
}

/** Reads the same doc into two "tabs", writes tab A (succeeds, etag advances),
 *  then writes tab B with its now-stale _metadata.etag → expect ORA-42699. */
export async function simulateConflict(
  qc: QueryConnection,
  schema: string,
  view: string,
  id: string | number,
  mutate: (doc: Record<string, unknown>) => Record<string, unknown>,
): Promise<ConflictOutcome> {
  const tabA = await readDocument(qc, schema, view, id);
  const tabB = await readDocument(qc, schema, view, id); // same stale etag as A
  const a = await writeDocument(qc, schema, view, id, mutate({ ...tabA }));
  try {
    await writeDocument(qc, schema, view, id, mutate({ ...tabB }));
    return { firstWriteEtag: a.etag, secondWriteConflicted: false };
  } catch (e) {
    if (isEtagConflict(e)) {
      return {
        firstWriteEtag: a.etag,
        secondWriteConflicted: true,
        error: String(e instanceof Error ? e.message : e),
      };
    }
    throw e;
  }
}
