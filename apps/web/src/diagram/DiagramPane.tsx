import { useMemo } from "react";
import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useJrdmStore } from "../state/store";
import { projectToGraph } from "./projectToGraph";
import { EntityNode } from "./EntityNode";
import { RelationshipEdge } from "./RelationshipEdge";

export function DiagramPane() {
  const project = useJrdmStore((s) => s.project);
  const relationships = useJrdmStore((s) => s.relationships);

  const graph = useMemo(
    () => (project ? projectToGraph(project, relationships) : { nodes: [], edges: [] }),
    [project, relationships],
  );

  const nodeTypes = useMemo(() => ({ entity: EntityNode }), []);
  const edgeTypes = useMemo(() => ({ relationship: RelationshipEdge }), []);

  if (!project) {
    return (
      <div data-testid="diagram-empty" className="h-full grid place-items-center text-jrdm-muted">
        Import an Oracle schema to see the ERD.
      </div>
    );
  }

  return (
    <div data-testid="diagram-canvas" className="h-full">
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
