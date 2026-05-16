// @tested-by: apps/web/src/App.test.tsx
import { ConnectionForm } from "./connection/ConnectionForm";
import { DiagramPane } from "./diagram/DiagramPane";
import { Inspector } from "./inspector/Inspector";
import { IssuesPanel } from "./issues/IssuesPanel";
import { useImport } from "./import/useImport";

export function App() {
  const { run, busy, error } = useImport();

  return (
    <div className="h-full flex flex-col bg-surface text-jrdm-text">
      <header className="px-4 py-2 border-b border-jrdm-border bg-surface-alt">
        <h1 className="font-semibold text-accent">JRDM — JSON Relational Duality Mapper</h1>
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
        <main className="flex-1 min-w-0">
          <DiagramPane />
        </main>
        <aside className="w-80 border-l border-jrdm-border overflow-auto">
          <Inspector />
        </aside>
      </div>
      <footer className="h-40 border-t border-jrdm-border overflow-auto bg-surface-alt">
        <IssuesPanel />
      </footer>
    </div>
  );
}
