import { describe, it, expect, beforeEach } from "vitest";
import { useJrdmStore } from "./store";
import type { DraftProject, Relationship, DualityView } from "@jrdm/model";

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

describe("useJrdmStore — authoring state", () => {
  beforeEach(() => useJrdmStore.getState().reset());

  it("defaults: mode erd, no editingView, sql syntax, no selected field path", () => {
    const s = useJrdmStore.getState();
    expect(s.mode).toBe("erd");
    expect(s.editingView).toBeNull();
    expect(s.ddlSyntax).toBe("sql");
    expect(s.selectedFieldPath).toBeNull();
  });

  it("startNewView seeds an editingView and switches to design mode", () => {
    useJrdmStore.getState().startNewView("orders");
    const s = useJrdmStore.getState();
    expect(s.mode).toBe("design");
    expect(s.editingView).toEqual({
      name: "orders_dv",
      schema: "app",
      createMode: "orReplace",
      root: {
        table: "orders",
        permissions: { insert: false, update: false, delete: false },
        etag: "check",
      },
      fields: [{ key: "_id", source: "orders.id" }],
    });
  });

  it("setEditingView replaces the whole view; setMode toggles", () => {
    const v: DualityView = {
      name: "v_dv",
      schema: "s",
      createMode: "create",
      root: {
        table: "t",
        permissions: { insert: false, update: false, delete: false },
        etag: "check",
      },
      fields: [{ key: "_id", source: "t.id" }],
    };
    useJrdmStore.getState().setEditingView(v);
    expect(useJrdmStore.getState().editingView).toEqual(v);
    useJrdmStore.getState().setMode("erd");
    expect(useJrdmStore.getState().mode).toBe("erd");
  });

  it("selectField sets path; setDdlSyntax toggles", () => {
    useJrdmStore.getState().selectField([1]);
    expect(useJrdmStore.getState().selectedFieldPath).toEqual([1]);
    useJrdmStore.getState().setDdlSyntax("graphql");
    expect(useJrdmStore.getState().ddlSyntax).toBe("graphql");
  });

  it("reset clears authoring state too", () => {
    useJrdmStore.getState().startNewView("orders");
    useJrdmStore.getState().selectField([0]);
    useJrdmStore.getState().setDdlSyntax("graphql");
    useJrdmStore.getState().reset();
    const s = useJrdmStore.getState();
    expect(s.mode).toBe("erd");
    expect(s.editingView).toBeNull();
    expect(s.selectedFieldPath).toBeNull();
    expect(s.ddlSyntax).toBe("sql");
  });
});
