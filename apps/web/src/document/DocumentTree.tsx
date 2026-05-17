import type { DragEvent } from "react";
import { useJrdmStore } from "../state/store";
import { FieldNode } from "./FieldNode";
import { DRAG_MIME, parseDragPayload } from "./dropTarget";
import {
  scalarField,
  addField,
  nestedField,
  getField,
  resolveAddTargetPath,
} from "./documentModel";
import type { NestedField } from "@jrdm/model";

const KINDS = ["object", "unnest", "array"] as const;

export function DocumentTree() {
  const view = useJrdmStore((s) => s.editingView);
  const selectedFieldPath = useJrdmStore((s) => s.selectedFieldPath);
  const setEditingView = useJrdmStore((s) => s.setEditingView);
  const selectField = useJrdmStore((s) => s.selectField);

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const raw = e.dataTransfer.getData(DRAG_MIME);
    const drag = parseDragPayload(raw);
    if (!drag || !view) return;
    setEditingView(addField(view, [], scalarField(drag.column, drag.table, drag.column)));
  }

  function addNested(kind: NestedField["kind"]) {
    if (!view) return;
    const target = resolveAddTargetPath(view, selectedFieldPath);
    const siblings =
      target.length === 0 ? view.fields : (getField(view, target) as NestedField).fields;
    const newPath = [...target, siblings.length];
    setEditingView(addField(view, target, nestedField(`new_${kind}`, kind, view.root.table)));
    selectField(newPath);
  }

  if (!view) {
    return (
      <div data-testid="doctree-empty" className="p-4 text-sm text-jrdm-muted">
        Select an entity in the ERD and choose "Design view" to start authoring a duality view.
      </div>
    );
  }

  return (
    <div
      className="p-3 text-sm h-full overflow-auto"
      data-testid="doctree"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div data-testid="doctree-root" className="mb-2">
        <div className="font-semibold text-accent">
          {view.schema}.{view.name}
        </div>
        <div className="text-jrdm-muted">root: {view.root.table}</div>
      </div>
      <div className="flex gap-2 mb-2" data-testid="doctree-toolbar">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => addNested(k)}
            className="text-xs border border-jrdm-border rounded px-2 py-0.5 bg-surface-alt"
          >
            + {k}
          </button>
        ))}
      </div>
      <div>
        {view.fields.map((f, i) => (
          <FieldNode key={i} field={f} path={[i]} />
        ))}
      </div>
    </div>
  );
}
