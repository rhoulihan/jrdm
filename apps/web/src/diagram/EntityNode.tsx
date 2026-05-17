import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useJrdmStore } from "../state/store";
import type { EntityNodeData } from "./projectToGraph";
import { DRAG_MIME } from "../document/dropTarget";

export function EntityNode(props: NodeProps & { data: EntityNodeData }) {
  const { id, data } = props;
  const entity = data.entity;
  const select = useJrdmStore((s) => s.selectEntity);
  const pk = new Set(entity.primaryKey);
  const fkCols = new Set((entity.foreignKeys ?? []).flatMap((f) => f.columns));

  return (
    <div className="bg-surface-alt border border-jrdm-border rounded shadow-sm min-w-[200px]">
      <Handle type="target" position={Position.Left} />
      <button
        type="button"
        onClick={() => select(id)}
        className="w-full text-left bg-accent text-white px-3 py-1 font-semibold rounded-t"
      >
        {entity.name}
      </button>
      <ul className="text-sm">
        {entity.columns.map((c) => {
          const tags = [pk.has(c.name) ? "PK" : null, fkCols.has(c.name) ? "FK" : null]
            .filter(Boolean)
            .join(" ");
          return (
            <li
              key={c.name}
              data-testid={`col-${c.name}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  DRAG_MIME,
                  JSON.stringify({ table: entity.name, column: c.name }),
                );
                e.dataTransfer.effectAllowed = "copy";
              }}
              className="flex justify-between px-3 py-0.5 border-t border-jrdm-border cursor-grab"
            >
              <span>{c.name}</span>
              <span className="text-jrdm-muted">
                {c.type}
                {tags ? ` · ${tags}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
