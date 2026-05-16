import { describe, it, expect } from "vitest";
import { ProjectSchema, type Project } from "../schemas";

const project: Project = {
  name: "orders",
  version: "0.1.0",
  entities: [
    {
      name: "orders",
      schema: "app",
      columns: [{ name: "order_id", type: "NUMBER", nullable: false }],
      primaryKey: ["order_id"],
    },
  ],
  views: [],
};

describe("ProjectSchema", () => {
  it("accepts a minimal valid project", () => {
    expect(ProjectSchema.safeParse(project).success).toBe(true);
  });

  it("requires a name", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name: _n, ...rest } = project;
    expect(ProjectSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects duplicate entity names within a schema", () => {
    const dup: Project = {
      ...project,
      entities: [project.entities[0]!, project.entities[0]!],
    };
    expect(ProjectSchema.safeParse(dup).success).toBe(false);
  });

  it("allows empty entities and views", () => {
    expect(
      ProjectSchema.safeParse({ name: "p", version: "0.1.0", entities: [], views: [] }).success,
    ).toBe(true);
  });
});
