import { useJrdmStore } from "../state/store";
import { FieldNode } from "./FieldNode";

export function DocumentTree() {
  const view = useJrdmStore((s) => s.editingView);

  if (!view) {
    return (
      <div data-testid="doctree-empty" className="p-4 text-sm text-jrdm-muted">
        Select an entity in the ERD and choose "Design view" to start authoring a duality view.
      </div>
    );
  }

  return (
    <div className="p-3 text-sm h-full overflow-auto" data-testid="doctree">
      <div data-testid="doctree-root" className="mb-2">
        <div className="font-semibold text-accent">
          {view.schema}.{view.name}
        </div>
        <div className="text-jrdm-muted">root: {view.root.table}</div>
      </div>
      <div>
        {view.fields.map((f, i) => (
          <FieldNode key={i} field={f} path={[i]} />
        ))}
      </div>
    </div>
  );
}
