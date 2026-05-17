import type { DragEvent } from "react";
import { useJrdmStore } from "../state/store";
import { DRAG_MIME, parseDragPayload } from "./dropTarget";
import { addField, scalarField } from "./documentModel";
import type { AnyField } from "@jrdm/model";

function pathId(path: number[]): string {
  return path.join(".");
}

export function FieldNode({ field, path }: { field: AnyField; path: number[] }) {
  const select = useJrdmStore((s) => s.selectField);
  const selected = useJrdmStore((s) => s.selectedFieldPath);
  const view = useJrdmStore((s) => s.editingView);
  const setEditingView = useJrdmStore((s) => s.setEditingView);
  const isSelected = selected !== null && pathId(selected) === pathId(path);
  const nested = "kind" in field;

  function onDrop(e: DragEvent<HTMLDivElement>) {
    if (!nested) return; // scalars don't accept drops; bubbles to root
    e.preventDefault();
    e.stopPropagation();
    const drag = parseDragPayload(e.dataTransfer.getData(DRAG_MIME));
    if (!drag || !view) return;
    setEditingView(addField(view, path, scalarField(drag.column, drag.table, drag.column)));
  }

  return (
    <>
      <div
        data-testid={`field-${pathId(path)}`}
        data-selected={isSelected ? "true" : "false"}
        className={`border-l-2 pl-2 my-0.5 cursor-pointer ${isSelected ? "border-accent bg-surface" : "border-jrdm-border"}`}
        onClick={() => select(path)}
        onDragOver={
          nested
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
              }
            : undefined
        }
        onDrop={onDrop}
      >
        {nested ? (
          `${field.key} (${field.kind} ${field.table})`
        ) : (
          <>
            <span className="font-medium">{field.key}</span>
            <span className="text-jrdm-muted"> : </span>
            <span className="text-jrdm-muted">{field.source}</span>
          </>
        )}
      </div>
      {nested && (
        <div className="ml-3">
          {field.fields.map((c, i) => (
            <FieldNode key={`${pathId(path)}.${i}`} field={c} path={[...path, i]} />
          ))}
        </div>
      )}
    </>
  );
}
