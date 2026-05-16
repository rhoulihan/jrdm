import { useMemo } from "react";
import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useJrdmStore } from "../state/store";
import { projectToGraph } from "./projectToGraph";

export function DiagramPane() {
  const project = useJrdmStore((s) => s.project);
  const relationships = useJrdmStore((s) => s.relationships);

  const graph = useMemo(
    () => (project ? projectToGraph(project, relationships) : { nodes: [], edges: [] }),
    [project, relationships],
  );

  if (!project) {
    return (
      <div data-testid="diagram-empty" className="h-full grid place-items-center text-jrdm-muted">
        Import an Oracle schema to see the ERD.
      </div>
    );
  }

  return (
    <div data-testid="diagram-canvas" className="h-full">
      <ReactFlow nodes={graph.nodes} edges={graph.edges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
