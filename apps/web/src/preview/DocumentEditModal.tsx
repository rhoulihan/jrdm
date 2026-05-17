import { useEffect, useState } from "react";
import { useJrdmStore } from "../state/store";
import { readDocument, writeDocument, ApiError } from "../api/client";
import type { OracleConn } from "../api/client";

/** Returns the first scalar-valued non-system key from the doc, plus its key. */
function firstEditableField(doc: Record<string, unknown>): { key: string; value: string } | null {
  for (const [k, v] of Object.entries(doc)) {
    if (k === "_id" || k === "_metadata") continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      return { key: k, value: String(v) };
    }
  }
  return null;
}

export function DocumentEditModal() {
  const editingView = useJrdmStore((s) => s.editingView);
  const connection = useJrdmStore((s) => s.connection);
  const selectedDocId = useJrdmStore((s) => s.selectedDocId);
  const sampleDocs = useJrdmStore((s) => s.sampleDocs);
  const setSampleDocs = useJrdmStore((s) => s.setSampleDocs);
  const selectDoc = useJrdmStore((s) => s.selectDoc);
  const setConflict = useJrdmStore((s) => s.setConflict);

  const [doc, setDoc] = useState<Record<string, unknown> | null>(null);
  const [fieldKey, setFieldKey] = useState<string>("");
  const [fieldValue, setFieldValue] = useState<string>("");
  const [newEtag, setNewEtag] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedDocId === null || !editingView) {
      setDoc(null);
      setNewEtag(null);
      setWriteError(null);
      return;
    }

    const conn: OracleConn = {
      user: connection.user,
      password: connection.password,
      connectString: connection.connectString,
    };

    setLoading(true);
    setNewEtag(null);
    setWriteError(null);

    readDocument(editingView, conn, selectedDocId)
      .then((result) => {
        setDoc(result.document);
        const field = firstEditableField(result.document);
        if (field) {
          setFieldKey(field.key);
          setFieldValue(field.value);
        }
      })
      .catch((err: unknown) => {
        setWriteError(
          err instanceof ApiError ? err.message : String(err instanceof Error ? err.message : err),
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedDocId, editingView, connection]);

  function handleSave() {
    if (!doc || !editingView || selectedDocId === null) return;

    const conn: OracleConn = {
      user: connection.user,
      password: connection.password,
      connectString: connection.connectString,
    };

    // Write the WHOLE doc including original _metadata (Oracle ETag contract)
    const mutatedDoc: Record<string, unknown> = { ...doc, [fieldKey]: fieldValue };

    setWriteError(null);
    writeDocument(editingView, conn, selectedDocId, mutatedDoc)
      .then((result) => {
        const returnedDoc = result.document;
        const etag = (returnedDoc["_metadata"] as Record<string, unknown> | undefined)?.["etag"] as
          | string
          | undefined;
        if (etag !== undefined) {
          setNewEtag(etag);
        }
        // Refresh that doc in sampleDocs
        const updated = (sampleDocs as Array<Record<string, unknown>>).map((d) =>
          d["_id"] === selectedDocId ? returnedDoc : d,
        );
        setSampleDocs(updated);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 409) {
          setConflict({ message: err.message });
          selectDoc(null);
        } else {
          setWriteError(
            err instanceof ApiError
              ? err.message
              : String(err instanceof Error ? err.message : err),
          );
        }
      });
  }

  if (selectedDocId === null || !editingView) return null;

  return (
    <div className="flex flex-col gap-3 p-4 bg-surface-alt border-b border-jrdm-border">
      <h2 className="text-jrdm-text font-semibold">Edit Document (_id: {String(selectedDocId)})</h2>

      {loading && <p className="text-sm text-gray-400 italic">Loading…</p>}

      {!loading && doc !== null && fieldKey && (
        <label className="flex flex-col gap-1 text-sm text-jrdm-text">
          {fieldKey}
          <input
            type="text"
            data-testid="edit-field"
            value={fieldValue}
            onChange={(e) => setFieldValue(e.target.value)}
            className="border border-jrdm-border rounded px-2 py-1 font-mono text-xs"
          />
        </label>
      )}

      {writeError !== null && (
        <p data-testid="edit-write-error" className="text-sm text-red-600">
          {writeError}
        </p>
      )}

      {newEtag !== null && (
        <p data-testid="edit-new-etag" className="text-sm text-gray-500 font-mono">
          New ETag: {newEtag}
        </p>
      )}

      {!loading && doc !== null && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="bg-accent text-white rounded px-4 py-2 text-sm"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => selectDoc(null)}
            className="rounded border border-jrdm-border px-4 py-2 text-sm text-jrdm-text"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
