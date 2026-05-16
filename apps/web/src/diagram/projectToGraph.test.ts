import { describe, it, expect } from "vitest";
import { projectToGraph } from "./projectToGraph";
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
});
