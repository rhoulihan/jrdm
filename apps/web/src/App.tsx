// @tested-by: apps/web/src/App.test.tsx
import { ConnectionForm } from "./connection/ConnectionForm";
import { DiagramPane } from "./diagram/DiagramPane";
import { ContextInspector } from "./inspector/ContextInspector";
import { IssuesPanel } from "./issues/IssuesPanel";
import { DocumentTree } from "./document/DocumentTree";
import { DdlPane } from "./ddl/DdlPane";
import { PreviewPanel } from "./preview/PreviewPanel";
import { useImport } from "./import/useImport";
import { useJrdmStore } from "./state/store";

export function App() {
  const { run, busy, error } = useImport();
  const mode = useJrdmStore((s) => s.mode);
  const setMode = useJrdmStore((s) => s.setMode);
  const selectedEntity = useJrdmStore((s) => s.selectedEntity);
  const startNewView = useJrdmStore((s) => s.startNewView);

  return (
    <div className="h-full flex flex-col bg-surface text-jrdm-text">
      <header className="px-4 py-2 border-b border-jrdm-border bg-surface-alt flex items-center gap-4">
        <h1 className="font-semibold text-accent">JRDM — JSON Relational Duality Mapper</h1>
        <div className="inline-flex border border-jrdm-border rounded overflow-hidden text-xs">
          <button
            type="button"
            aria-pressed={mode === "erd"}
            onClick={() => setMode("erd")}
            className={`px-2 py-1 ${mode === "erd" ? "bg-accent text-white" : "bg-surface-alt"}`}
          >
            ERD mode
          </button>
          <button
            type="button"
            aria-pressed={mode === "design"}
            onClick={() => setMode("design")}
            className={`px-2 py-1 ${mode === "design" ? "bg-accent text-white" : "bg-surface-alt"}`}
          >
            Design mode
          </button>
        </div>
        {selectedEntity && (
          <button
            type="button"
            onClick={() => startNewView(selectedEntity.split(".").pop() ?? selectedEntity)}
            className="text-xs underline text-accent"
          >
            Design view from "{selectedEntity}"
          </button>
        )}
      </header>
      {error && (
        <div
          data-testid="error-banner"
          className="bg-[color:var(--danger,#B00020)] text-white px-4 py-2 text-sm"
        >
          Import failed: {error}
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        <aside className="w-72 border-r border-jrdm-border overflow-auto">
          <ConnectionForm onSubmit={(req) => void run(req)} busy={busy} />
        </aside>
        <main className="flex-1 min-w-0 flex flex-col">
          {mode === "erd" ? (
            <DiagramPane />
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 min-h-0 border-b border-jrdm-border overflow-auto">
                <DocumentTree />
              </div>
              <div className="h-1/2 min-h-0">
                <DdlPane />
              </div>
            </div>
          )}
        </main>
        <aside className="w-80 border-l border-jrdm-border overflow-auto flex flex-col">
          <ContextInspector />
          {mode === "design" && <PreviewPanel />}
        </aside>
      </div>
      <footer className="h-32 border-t border-jrdm-border overflow-auto bg-surface-alt">
        <IssuesPanel />
      </footer>
    </div>
  );
}
