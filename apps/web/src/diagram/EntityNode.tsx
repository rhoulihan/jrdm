// @tested-by: apps/web/src/diagram/EntityNode.test.tsx
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useJrdmStore } from "../state/store";
import type { EntityNodeData } from "./projectToGraph";

export interface EntityNodeProps extends NodeProps {
  data: EntityNodeData;
  /** Lifted callback: signals DiagramPane to open the context menu for this entity. */
  onOpenMenu?: (entityName: string, x: number, y: number) => void;
}

export function EntityNode(props: EntityNodeProps) {
  const { id, data, onOpenMenu } = props;
  const entity = data.entity;
  const select = useJrdmStore((s) => s.selectEntity);
  const pk = new Set(entity.primaryKey);
  const fkCols = new Set((entity.foreignKeys ?? []).flatMap((f) => f.columns));

  return (
    <div className="bg-surface-alt border border-jrdm-border rounded shadow-sm min-w-[200px]">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center bg-accent text-white rounded-t">
        <button
          type="button"
          data-testid={`entity-header-${entity.name}`}
          onClick={() => select(id)}
          className="flex-1 text-left px-3 py-1 font-semibold cursor-pointer"
        >
          {entity.name}
        </button>
        <button
          type="button"
          data-testid={`entity-menu-${entity.name}`}
          aria-label={`Table actions for ${entity.name}`}
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            onOpenMenu?.(entity.name, rect.left, rect.bottom);
          }}
          className="px-2 py-1 hover:bg-white/20 rounded-tr cursor-pointer text-xs leading-none select-none"
        >
          ⋯
        </button>
      </div>
      <ul className="text-sm">
        {entity.columns.map((c) => {
          const tags = [pk.has(c.name) ? "PK" : null, fkCols.has(c.name) ? "FK" : null]
            .filter(Boolean)
            .join(" ");
          return (
            <li
              key={c.name}
              data-testid={`col-${c.name}`}
              className="flex justify-between px-3 py-0.5 border-t border-jrdm-border"
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
