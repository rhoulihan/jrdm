import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { tokens } from "../theme/tokens";
import type { RelationshipEdgeData } from "./projectToGraph";

export function RelationshipEdge(props: EdgeProps & { data?: RelationshipEdgeData }) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const cardinality = data?.cardinality ?? "1:N";
  const color = tokens.edge[cardinality];

  return (
    <>
      <BaseEdge id={props.id} path={path} style={{ stroke: color, strokeWidth: 1.5 }} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            background: tokens.color.surfaceAlt,
            color,
            border: `1px solid ${color}`,
            borderRadius: 4,
            padding: "0 4px",
            fontSize: 11,
            pointerEvents: "all",
          }}
        >
          {cardinality}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
