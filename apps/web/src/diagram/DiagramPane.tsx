import { useEffect, useMemo } from "react";
import { ReactFlow, Background, Controls, useNodesState, useEdgesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useJrdmStore } from "../state/store";
import { projectToGraph } from "./projectToGraph";
import { EntityNode } from "./EntityNode";
import { RelationshipEdge } from "./RelationshipEdge";
import type { GraphNode, GraphEdge } from "./projectToGraph";

export function DiagramPane() {
  const project = useJrdmStore((s) => s.project);
  const relationships = useJrdmStore((s) => s.relationships);

  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<GraphEdge>([]);

  // Re-seed layout ONLY when a new import arrives (project identity changes).
  // Uses a stable key: project name + entity count so user drags persist across
  // unrelated store updates but a fresh import triggers a full re-layout.
  const projectKey = project ? `${project.name}:${project.entities.length}` : null;

  useEffect(() => {
    if (!project) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const graph = projectToGraph(project, relationships);
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [projectKey]); // intentionally keyed on project identity only — setNodes/setEdges are stable

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
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
