import { useState } from "react";
import { useJrdmStore } from "../state/store";
import { sampleDocuments, ApiError } from "../api/client";
import type { OracleConn } from "../api/client";

// ---------------------------------------------------------------------------
// JsonNode — recursive collapsible JSON tree (pure presenter)
// ---------------------------------------------------------------------------

function JsonNode({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [open, setOpen] = useState(true);
  const indent = depth * 12;

  if (value === null) {
    return <span className="text-gray-500">null</span>;
  }

  if (Array.isArray(value)) {
    const items = value as unknown[];
    if (!open) {
      return (
        <span>
          <button onClick={() => setOpen(true)} className="text-xs text-jrdm-accent underline">
            [{items.length}]
          </button>
        </span>
      );
    }
    return (
      <span>
        <button onClick={() => setOpen(false)} className="text-xs text-jrdm-accent underline">
          [−]
        </button>
        <div style={{ paddingLeft: indent }}>
          {items.map((item, i) => (
            <div key={i}>
              <JsonNode value={item} depth={depth + 1} />
            </div>
          ))}
        </div>
      </span>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!open) {
      return (
        <span>
          <button onClick={() => setOpen(true)} className="text-xs text-jrdm-accent underline">
            {"{…}"}
          </button>
        </span>
      );
    }
    return (
      <span>
        <button onClick={() => setOpen(false)} className="text-xs text-jrdm-accent underline">
          {"−"}
        </button>
        <div style={{ paddingLeft: indent }}>
          {entries.map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <span className="text-blue-600 font-mono text-xs">{k}:</span>
              <JsonNode value={v} depth={depth + 1} />
            </div>
          ))}
        </div>
      </span>
    );
  }

  // scalar
  const cls =
    typeof value === "string"
      ? "text-green-700"
      : typeof value === "number"
        ? "text-orange-600"
        : "text-purple-600";
  return <span className={`font-mono text-xs ${cls}`}>{JSON.stringify(value)}</span>;
}

// ---------------------------------------------------------------------------
// ResultsPane
// ---------------------------------------------------------------------------

export function ResultsPane() {
  const editingView = useJrdmStore((s) => s.editingView);
  const connection = useJrdmStore((s) => s.connection);
  const sampleDocs = useJrdmStore((s) => s.sampleDocs);
  const setSampleDocs = useJrdmStore((s) => s.setSampleDocs);
  const selectDoc = useJrdmStore((s) => s.selectDoc);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleSample() {
    if (!editingView) return;

    const conn: OracleConn = {
      user: connection.user,
      password: connection.password,
      connectString: connection.connectString,
    };

    setErrorMsg(null);
    sampleDocuments(editingView, conn, 5)
      .then((result) => {
        setSampleDocs(result.documents);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          setErrorMsg(err.message);
        } else {
          setErrorMsg(String(err instanceof Error ? err.message : err));
        }
      });
  }

  const docs = sampleDocs as Array<Record<string, unknown>>;

  return (
    <div className="flex flex-col gap-3 p-4 bg-surface-alt border-b border-jrdm-border">
      <h2 className="text-jrdm-text font-semibold">Sample Documents</h2>

      <button
        type="button"
        data-testid="sample-btn"
        onClick={handleSample}
        className="bg-accent text-white rounded px-4 py-2 disabled:opacity-50 self-start"
      >
        Sample
      </button>

      {errorMsg !== null && (
        <p data-testid="sample-error" className="text-sm text-red-600">
          {errorMsg}
        </p>
      )}

      {docs.length === 0 && errorMsg === null && (
        <p data-testid="sample-empty" className="text-sm text-gray-400 italic">
          No documents sampled yet.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {docs.slice(0, 5).map((doc) => {
          const id = doc["_id"] as string | number;
          const etag = (doc["_metadata"] as Record<string, unknown> | undefined)?.["etag"] as
            | string
            | undefined;

          return (
            <div
              key={String(id)}
              data-testid={`doc-row-${id}`}
              onClick={() => selectDoc(id)}
              className="cursor-pointer rounded border border-jrdm-border p-2 hover:bg-surface"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs text-jrdm-text font-semibold">
                  _id: {JSON.stringify(id)}
                </span>
                {etag !== undefined && (
                  <span data-testid={`doc-etag-${id}`} className="font-mono text-xs text-gray-500">
                    etag: {etag}
                  </span>
                )}
              </div>
              <JsonNode value={doc} depth={1} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
