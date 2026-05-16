import { describe, it, expect } from "vitest";
import { projectToGraph } from "./projectToGraph";
import type { DraftProject, Relationship } from "@jrdm/model";

function makeProject(n: number): { project: DraftProject; rels: Relationship[] } {
  const entities = Array.from({ length: n }, (_, i) => ({
    name: `t${i}`,
    schema: "app",
    columns: [
      { name: "id", type: "NUMBER" as const, nullable: false },
      { name: "parent_id", type: "NUMBER" as const, nullable: true },
    ],
    primaryKey: ["id"],
    ...(i > 0
      ? {
          foreignKeys: [
            {
              name: `fk_t${i}`,
              columns: ["parent_id"],
              references: { schema: "app", table: `t${i - 1}`, columns: ["id"] },
            },
          ],
        }
      : {}),
  }));
  const rels: Relationship[] = entities
    .filter((e) => e.foreignKeys)
    .map((e) => {
      const fk = e.foreignKeys![0]!;
      return {
        name: fk.name,
        from: { schema: "app", table: e.name, columns: fk.columns },
        to: { schema: "app", table: fk.references.table, columns: fk.references.columns },
        cardinality: "1:N" as const,
      };
    });
  return { project: { name: "big", version: "0.1.0", entities, views: [] }, rels };
}

describe("projectToGraph performance (50-entity fixture)", () => {
  it("lays out 50 entities in well under 1s", () => {
    const { project, rels } = makeProject(50);
    const start = performance.now();
    const { nodes, edges } = projectToGraph(project, rels);
    const ms = performance.now() - start;
    expect(nodes).toHaveLength(50);
    expect(edges).toHaveLength(49);
    expect(ms).toBeLessThan(1000);
  });
});
