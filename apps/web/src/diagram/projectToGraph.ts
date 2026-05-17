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

export const NODE_W = 220;
export const NODE_H = 120;

// Gap between grid cells (must satisfy GAP_X ≥ 80, GAP_Y ≥ 60 per spec).
const GAP_X = 80;
const GAP_Y = 60;

/** Lay out a list of entities in a grid, starting at (originX, originY). */
function gridLayout(
  entities: DraftEntity[],
  originX: number,
  originY: number,
): Map<string, { x: number; y: number }> {
  const cols = Math.ceil(Math.sqrt(entities.length));
  const positions = new Map<string, { x: number; y: number }>();
  entities.forEach((e, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(`${e.schema}.${e.name}`, {
      x: originX + col * (NODE_W + GAP_X),
      y: originY + row * (NODE_H + GAP_Y),
    });
  });
  return positions;
}

export function projectToGraph(
  project: DraftProject,
  relationships: Relationship[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  // Determine which entity ids are referenced by at least one relationship.
  const connectedIds = new Set<string>();
  for (const r of relationships) {
    connectedIds.add(`${r.from.schema}.${r.from.table}`);
    connectedIds.add(`${r.to.schema}.${r.to.table}`);
  }

  const connectedEntities = project.entities.filter((e) =>
    connectedIds.has(`${e.schema}.${e.name}`),
  );
  const isolatedEntities = project.entities.filter(
    (e) => !connectedIds.has(`${e.schema}.${e.name}`),
  );

  const positions = new Map<string, { x: number; y: number }>();

  // ── Dagre pass for connected entities ─────────────────────────────────────
  let dagreMaxY = 0;
  let dagreMaxX = 0;

  if (connectedEntities.length > 0) {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 90 });
    g.setDefaultEdgeLabel(() => ({}));

    for (const e of connectedEntities) {
      g.setNode(`${e.schema}.${e.name}`, { width: NODE_W, height: NODE_H });
    }
    for (const r of relationships) {
      g.setEdge(`${r.from.schema}.${r.from.table}`, `${r.to.schema}.${r.to.table}`);
    }
    dagre.layout(g);

    for (const e of connectedEntities) {
      const id = `${e.schema}.${e.name}`;
      const pos = g.node(id) as { x: number; y: number } | undefined;
      const x = (pos?.x ?? 0) - NODE_W / 2;
      const y = (pos?.y ?? 0) - NODE_H / 2;
      positions.set(id, { x, y });
      if (x + NODE_W > dagreMaxX) dagreMaxX = x + NODE_W;
      if (y + NODE_H > dagreMaxY) dagreMaxY = y + NODE_H;
    }
  }

  // ── Grid pass for isolated (or all) entities ──────────────────────────────
  if (isolatedEntities.length > 0) {
    // Place the grid below the dagre band with a margin, or at origin if no dagre.
    const gridOriginX = 0;
    const gridOriginY = connectedEntities.length > 0 ? dagreMaxY + GAP_Y * 2 : 0;

    const gridPositions = gridLayout(isolatedEntities, gridOriginX, gridOriginY);
    for (const [id, pos] of gridPositions) {
      positions.set(id, pos);
    }
  }

  // ── If there are no relationships at all, grid-lay everything ─────────────
  if (relationships.length === 0 && project.entities.length > 0) {
    const gridPositions = gridLayout(project.entities, 0, 0);
    for (const [id, pos] of gridPositions) {
      positions.set(id, pos);
    }
  }

  const nodes: GraphNode[] = project.entities.map((e) => {
    const id = `${e.schema}.${e.name}`;
    const pos = positions.get(id);
    return {
      id,
      type: "entity",
      position: {
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
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
