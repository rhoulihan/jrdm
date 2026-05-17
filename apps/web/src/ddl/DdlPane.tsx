import { useJrdmStore } from "../state/store";
import { useDdlPreview } from "./useDdlPreview";
import { SyntaxToggle } from "./SyntaxToggle";

export function DdlPane() {
  const view = useJrdmStore((s) => s.editingView);
  const { ddl, busy, error } = useDdlPreview();

  if (!view) {
    return (
      <div data-testid="ddl-empty" className="p-3 text-sm text-jrdm-muted">
        Start authoring a view to see its DDL.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" data-testid="ddl-pane">
      <div className="flex items-center justify-between px-3 py-1 border-b border-jrdm-border">
        <span className="text-xs text-jrdm-muted">{busy ? "generating…" : "DDL preview"}</span>
        <SyntaxToggle />
      </div>
      {error ? (
        <div data-testid="ddl-error" className="p-3 text-sm text-[color:var(--danger,#B00020)]">
          Cannot generate DDL: {error}
        </div>
      ) : (
        <pre
          data-testid="ddl-output"
          className="flex-1 overflow-auto p-3 text-xs whitespace-pre-wrap"
        >
          {ddl}
        </pre>
      )}
    </div>
  );
}
