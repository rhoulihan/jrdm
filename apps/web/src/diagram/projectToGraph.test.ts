import { describe, it, expect } from "vitest";
import { projectToGraph, NODE_W, NODE_H } from "./projectToGraph";
import type { DraftProject, Relationship } from "@jrdm/model";

const project: DraftProject = {
  name: "p",
  version: "0.1.0",
  entities: [
    {
      name: "customers",
      schema: "app",
      columns: [{ name: "customer_id", type: "NUMBER", nullable: false }],
      primaryKey: ["customer_id"],
    },
    {
      name: "orders",
      schema: "app",
      columns: [
        { name: "order_id", type: "NUMBER", nullable: false },
        { name: "customer_id", type: "NUMBER", nullable: false },
      ],
      primaryKey: ["order_id"],
      foreignKeys: [
        {
          name: "fk_o_c",
          columns: ["customer_id"],
          references: { schema: "app", table: "customers", columns: ["customer_id"] },
        },
      ],
    },
  ],
  views: [],
};
const rels: Relationship[] = [
  {
    name: "fk_o_c",
    from: { schema: "app", table: "orders", columns: ["customer_id"] },
    to: { schema: "app", table: "customers", columns: ["customer_id"] },
    cardinality: "1:N",
  },
];

/** Returns true if two axis-aligned rectangles overlap (touching edges don't count). */
function boxesOverlap(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  w = NODE_W,
  h = NODE_H,
): boolean {
  return ax < bx + w && ax + w > bx && ay < by + h && ay + h > by;
}

/** Assert that no two nodes in the list have overlapping bounding boxes. */
function assertNoOverlap(nodes: { position: { x: number; y: number } }[]): void {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      if (boxesOverlap(a.position.x, a.position.y, b.position.x, b.position.y)) {
        throw new Error(
          `Nodes ${i} and ${j} overlap: ` +
            `(${a.position.x},${a.position.y}) vs (${b.position.x},${b.position.y})`,
        );
      }
    }
  }
}

describe("projectToGraph", () => {
  it("creates one node per entity with id schema.name and entity data", () => {
    const { nodes } = projectToGraph(project, rels);
    expect(nodes.map((n) => n.id).sort()).toEqual(["app.customers", "app.orders"]);
    const orders = nodes.find((n) => n.id === "app.orders")!;
    expect(orders.type).toBe("entity");
    expect(orders.data.entity.name).toBe("orders");
    expect(typeof orders.position.x).toBe("number");
    expect(typeof orders.position.y).toBe("number");
  });

  it("creates one edge per relationship, source=child target=parent, with cardinality", () => {
    const { edges } = projectToGraph(project, rels);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      id: "fk_o_c",
      source: "app.orders",
      target: "app.customers",
      type: "relationship",
      data: { cardinality: "1:N" },
    });
  });

  it("assigns distinct positions (dagre layout, no overlap of identical coords)", () => {
    const { nodes } = projectToGraph(project, rels);
    const [a, b] = nodes;
    expect(a!.position.x !== b!.position.x || a!.position.y !== b!.position.y).toBe(true);
  });

  it("handles an empty project", () => {
    const { nodes, edges } = projectToGraph(
      { name: "e", version: "0.1.0", entities: [], views: [] },
      [],
    );
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
  });

  // ── NEW: grid layout for zero-relationship projects ──────────────────────

  it("0 relationships, 6 entities → grid (multiple distinct x, ≥2 distinct y, no bbox overlap)", () => {
    const sixProject: DraftProject = {
      name: "grid6",
      version: "0.1.0",
      entities: Array.from({ length: 6 }, (_, i) => ({
        name: `t${i}`,
        schema: "s",
        columns: [{ name: "id", type: "NUMBER" as const, nullable: false }],
        primaryKey: ["id"],
      })),
      views: [],
    };
    const { nodes } = projectToGraph(sixProject, []);

    // Must NOT be a single column — multiple distinct x values
    const distinctX = new Set(nodes.map((n) => n.position.x)).size;
    expect(distinctX).toBeGreaterThan(1);

    // ceil(sqrt(6)) = 3 columns → exactly 3 distinct x values
    expect(distinctX).toBe(3);

    // 6 nodes in 3 cols = 2 rows → exactly 2 distinct y values
    const distinctY = new Set(nodes.map((n) => n.position.y)).size;
    expect(distinctY).toBe(2);

    // No bounding-box overlaps
    assertNoOverlap(nodes);
  });

  // ── NEW: dagre preserved for connected components ────────────────────────

  it("with relationships, dagre lays out child to the right of parent (rankdir LR, x diff ≥ ranksep)", () => {
    const { nodes } = projectToGraph(project, rels);
    const orders = nodes.find((n) => n.id === "app.orders")!;
    const customers = nodes.find((n) => n.id === "app.customers")!;
    // orders → customers FK, so orders is to the left (source) and customers to the right (target)
    // In dagre LR the from-node and to-node are placed in adjacent ranks.
    // The x diff must be at least ranksep (90).
    const xDiff = Math.abs(orders.position.x - customers.position.x);
    expect(xDiff).toBeGreaterThanOrEqual(90);
  });

  // ── NEW: mixed project — dagre band + isolated grid, no overlaps anywhere ─

  it("mixed (2 FK-connected + 4 isolated) → dagre band + grid offset, no bbox overlaps", () => {
    const mixedProject: DraftProject = {
      name: "mixed",
      version: "0.1.0",
      entities: [
        {
          name: "parent",
          schema: "s",
          columns: [{ name: "id", type: "NUMBER" as const, nullable: false }],
          primaryKey: ["id"],
        },
        {
          name: "child",
          schema: "s",
          columns: [
            { name: "id", type: "NUMBER" as const, nullable: false },
            { name: "parent_id", type: "NUMBER" as const, nullable: true },
          ],
          primaryKey: ["id"],
          foreignKeys: [
            {
              name: "fk_c_p",
              columns: ["parent_id"],
              references: { schema: "s", table: "parent", columns: ["id"] },
            },
          ],
        },
        ...Array.from({ length: 4 }, (_, i) => ({
          name: `iso${i}`,
          schema: "s",
          columns: [{ name: "id", type: "NUMBER" as const, nullable: false }],
          primaryKey: ["id"],
        })),
      ],
      views: [],
    };
    const mixedRels: Relationship[] = [
      {
        name: "fk_c_p",
        from: { schema: "s", table: "child", columns: ["parent_id"] },
        to: { schema: "s", table: "parent", columns: ["id"] },
        cardinality: "1:N",
      },
    ];

    const { nodes } = projectToGraph(mixedProject, mixedRels);

    // All 6 nodes exist
    expect(nodes).toHaveLength(6);

    // No bounding-box overlaps anywhere (dagre band + grid band must be clear of each other)
    assertNoOverlap(nodes);

    // The isolated nodes must have multiple distinct x values (not all in one column)
    const isoNodes = nodes.filter((n) => n.id.startsWith("s.iso"));
    expect(isoNodes).toHaveLength(4);
    const isoDistinctX = new Set(isoNodes.map((n) => n.position.x)).size;
    expect(isoDistinctX).toBeGreaterThan(1);
  });
});
