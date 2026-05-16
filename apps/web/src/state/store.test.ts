import { describe, it, expect, beforeEach } from "vitest";
import { useJrdmStore } from "./store";
import type { DraftProject, Relationship } from "@jrdm/model";

const project: DraftProject = {
  name: "imported",
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
const rels: Relationship[] = [];

describe("useJrdmStore", () => {
  beforeEach(() => {
    useJrdmStore.getState().reset();
  });

  it("starts with no project and no selection", () => {
    const s = useJrdmStore.getState();
    expect(s.project).toBeNull();
    expect(s.selectedEntity).toBeNull();
    expect(s.issues).toEqual([]);
  });

  it("setImport stores project, relationships, issues", () => {
    useJrdmStore.getState().setImport({ project, relationships: rels, issues: [] });
    const s = useJrdmStore.getState();
    expect(s.project?.name).toBe("imported");
    expect(s.relationships).toEqual([]);
  });

  it("selectEntity sets the selection; clearing works", () => {
    useJrdmStore.getState().selectEntity("orders");
    expect(useJrdmStore.getState().selectedEntity).toBe("orders");
    useJrdmStore.getState().selectEntity(null);
    expect(useJrdmStore.getState().selectedEntity).toBeNull();
  });

  it("setConnection merges connection fields", () => {
    useJrdmStore.getState().setConnection({ user: "scott" });
    expect(useJrdmStore.getState().connection.user).toBe("scott");
    useJrdmStore.getState().setConnection({ connectString: "h:1521/FREEPDB1" });
    expect(useJrdmStore.getState().connection.user).toBe("scott");
    expect(useJrdmStore.getState().connection.connectString).toBe("h:1521/FREEPDB1");
  });
});
