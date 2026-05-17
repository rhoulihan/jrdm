import { useJrdmStore } from "../state/store";
import { getField, patchField, removeField } from "../document/documentModel";
import type { AnyField } from "@jrdm/model";

export function FieldInspector() {
  const view = useJrdmStore((s) => s.editingView);
  const path = useJrdmStore((s) => s.selectedFieldPath);
  const setEditingView = useJrdmStore((s) => s.setEditingView);
  const selectField = useJrdmStore((s) => s.selectField);

  const field: AnyField | undefined = view && path ? getField(view, path) : undefined;

  if (!view || !path || !field) {
    return (
      <div data-testid="fieldinspector-empty" className="p-4 text-sm text-jrdm-muted">
        Select a field in the document to edit it.
      </div>
    );
  }

  const patch = (p: Partial<AnyField>) => setEditingView(patchField(view, path, p));
  const nested = "kind" in field;

  return (
    <div className="p-4 text-sm flex flex-col gap-2" data-testid="fieldinspector">
      <label className="flex flex-col gap-1">
        Key
        <input
          className="border border-jrdm-border rounded px-2 py-1"
          value={field.key}
          onChange={(e) => patch({ key: e.target.value })}
        />
      </label>

      {!nested && (
        <>
          <label className="flex flex-col gap-1">
            Source
            <input
              className="border border-jrdm-border rounded px-2 py-1"
              value={field.source}
              onChange={(e) => patch({ source: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={field.noupdate ?? false}
              onChange={(e) => patch({ noupdate: e.target.checked })}
            />
            noupdate
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={field.etag === "nocheck"}
              onChange={(e) => patch({ etag: e.target.checked ? "nocheck" : "check" })}
            />
            etag nocheck
          </label>
        </>
      )}

      {nested && (
        <>
          <label className="flex flex-col gap-1">
            Table
            <input
              className="border border-jrdm-border rounded px-2 py-1"
              value={field.table}
              onChange={(e) => patch({ table: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            Link (comma-separated columns)
            <input
              className="border border-jrdm-border rounded px-2 py-1"
              value={(field.link ?? []).join(",")}
              onChange={(e) =>
                patch({
                  link: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          {(["insert", "update", "delete"] as const).map((perm) => (
            <label key={perm} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={field.permissions?.[perm] ?? false}
                onChange={(e) =>
                  patch({
                    permissions: {
                      insert: field.permissions?.insert ?? false,
                      update: field.permissions?.update ?? false,
                      delete: field.permissions?.delete ?? false,
                      [perm]: e.target.checked,
                    },
                  })
                }
              />
              {perm}
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={field.etag === "nocheck"}
              onChange={(e) => patch({ etag: e.target.checked ? "nocheck" : "check" })}
            />
            etag nocheck
          </label>
        </>
      )}

      <button
        type="button"
        className="mt-2 text-[color:var(--danger,#B00020)] text-left"
        onClick={() => {
          setEditingView(removeField(view, path));
          selectField(null);
        }}
      >
        Remove field
      </button>
    </div>
  );
}
