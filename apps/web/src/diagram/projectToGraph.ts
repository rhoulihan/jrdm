import dagre from "dagre";
import type { DraftProject, DraftEntity, Relationship } from "@jrdm/model";

export interface EntityNodeData extends Record<string, unknown> {
  entity: DraftEntity;
}
export interface RelationshipEdgeData extends Record<string, unknown> {
  cardinality: Relationship["cardinality"];
}

export interface GraphNode {
  id: string;
  type: "entity";
  position: { x: number; y: number };
  data: EntityNodeData;
}
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "relationship";
  data: RelationshipEdgeData;
}

const NODE_W = 220;
const NODE_H = 120;

export function projectToGraph(
  project: DraftProject,
  relationships: Relationship[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 90 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const e of project.entities) {
    g.setNode(`${e.schema}.${e.name}`, { width: NODE_W, height: NODE_H });
  }
  for (const r of relationships) {
    g.setEdge(`${r.from.schema}.${r.from.table}`, `${r.to.schema}.${r.to.table}`);
  }
  dagre.layout(g);

  const nodes: GraphNode[] = project.entities.map((e) => {
    const id = `${e.schema}.${e.name}`;
    const pos = g.node(id) as { x: number; y: number } | undefined;
    return {
      id,
      type: "entity",
      position: {
        x: (pos?.x ?? 0) - NODE_W / 2,
        y: (pos?.y ?? 0) - NODE_H / 2,
      },
      data: { entity: e },
    };
  });

  const edges: GraphEdge[] = relationships.map((r) => ({
    id: r.name,
    source: `${r.from.schema}.${r.from.table}`,
    target: `${r.to.schema}.${r.to.table}`,
    type: "relationship",
    data: { cardinality: r.cardinality },
  }));

  return { nodes, edges };
}
