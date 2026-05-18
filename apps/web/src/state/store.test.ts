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

describe("useJrdmStore — preview slice", () => {
  beforeEach(() => useJrdmStore.getState().reset());

  it("defaults: deployState idle, deployMessage null, sampleDocs [], selectedDocId null, conflict null", () => {
    const s = useJrdmStore.getState();
    expect(s.deployState).toBe("idle");
    expect(s.deployMessage).toBeNull();
    expect(s.sampleDocs).toEqual([]);
    expect(s.selectedDocId).toBeNull();
    expect(s.conflict).toBeNull();
  });

  it("setDeployState updates deployState and deployMessage", () => {
    useJrdmStore.getState().setDeployState("deploying");
    expect(useJrdmStore.getState().deployState).toBe("deploying");
    expect(useJrdmStore.getState().deployMessage).toBeNull();

    useJrdmStore.getState().setDeployState("deployed", "3 statements");
    expect(useJrdmStore.getState().deployState).toBe("deployed");
    expect(useJrdmStore.getState().deployMessage).toBe("3 statements");

    useJrdmStore.getState().setDeployState("error", "ORA-00942");
    expect(useJrdmStore.getState().deployState).toBe("error");
    expect(useJrdmStore.getState().deployMessage).toBe("ORA-00942");
  });

  it("setSampleDocs stores documents array", () => {
    const docs = [
      { _id: 1, name: "foo" },
      { _id: 2, name: "bar" },
    ];
    useJrdmStore.getState().setSampleDocs(docs);
    expect(useJrdmStore.getState().sampleDocs).toEqual(docs);
  });

  it("selectDoc sets selectedDocId; clearing works", () => {
    useJrdmStore.getState().selectDoc(42);
    expect(useJrdmStore.getState().selectedDocId).toBe(42);
    useJrdmStore.getState().selectDoc("abc");
    expect(useJrdmStore.getState().selectedDocId).toBe("abc");
    useJrdmStore.getState().selectDoc(null);
    expect(useJrdmStore.getState().selectedDocId).toBeNull();
  });

  it("setConflict sets conflict message; clearing works", () => {
    useJrdmStore.getState().setConflict({ message: "ORA-42699: ETag mismatch" });
    expect(useJrdmStore.getState().conflict).toEqual({ message: "ORA-42699: ETag mismatch" });
    useJrdmStore.getState().setConflict(null);
    expect(useJrdmStore.getState().conflict).toBeNull();
  });

  it("reset clears schema slice", () => {
    useJrdmStore.getState().setSchemas(["APP", "SALES"]);
    useJrdmStore.getState().selectSchema("APP");
    useJrdmStore.getState().setSchemaLoad("loading");
    useJrdmStore.getState().reset();
    const s = useJrdmStore.getState();
    expect(s.schemas).toEqual([]);
    expect(s.selectedSchema).toBeNull();
    expect(s.schemaLoad).toBe("idle");
  });

  it("reset clears preview slice (no stale conflict across projects)", () => {
    useJrdmStore.getState().setDeployState("deployed", "2 statements");
    useJrdmStore.getState().setSampleDocs([{ _id: 1 }]);
    useJrdmStore.getState().selectDoc(1);
    useJrdmStore.getState().setConflict({ message: "ORA-42699" });

    useJrdmStore.getState().reset();

    const s = useJrdmStore.getState();
    expect(s.deployState).toBe("idle");
    expect(s.deployMessage).toBeNull();
    expect(s.sampleDocs).toEqual([]);
    expect(s.selectedDocId).toBeNull();
    expect(s.conflict).toBeNull();
  });
});

describe("useJrdmStore — schema slice", () => {
  beforeEach(() => useJrdmStore.getState().reset());

  it("defaults: schemas [], selectedSchema null, schemaLoad idle", () => {
    const s = useJrdmStore.getState();
    expect(s.schemas).toEqual([]);
    expect(s.selectedSchema).toBeNull();
    expect(s.schemaLoad).toBe("idle");
  });

  it("setSchemas stores the array", () => {
    useJrdmStore.getState().setSchemas(["APP", "SALES"]);
    expect(useJrdmStore.getState().schemas).toEqual(["APP", "SALES"]);
  });

  it("selectSchema sets selectedSchema; clearing works", () => {
    useJrdmStore.getState().selectSchema("APP");
    expect(useJrdmStore.getState().selectedSchema).toBe("APP");
    useJrdmStore.getState().selectSchema(null);
    expect(useJrdmStore.getState().selectedSchema).toBeNull();
  });

  it("setSchemaLoad transitions through loading/error/idle", () => {
    useJrdmStore.getState().setSchemaLoad("loading");
    expect(useJrdmStore.getState().schemaLoad).toBe("loading");
    useJrdmStore.getState().setSchemaLoad("error");
    expect(useJrdmStore.getState().schemaLoad).toBe("error");
    useJrdmStore.getState().setSchemaLoad("idle");
    expect(useJrdmStore.getState().schemaLoad).toBe("idle");
  });

  it("reset clears schema slice to SCHEMA_DEFAULTS", () => {
    useJrdmStore.getState().setSchemas(["APP", "SALES"]);
    useJrdmStore.getState().selectSchema("APP");
    useJrdmStore.getState().setSchemaLoad("error");
    useJrdmStore.getState().reset();
    const s = useJrdmStore.getState();
    expect(s.schemas).toEqual([]);
    expect(s.selectedSchema).toBeNull();
    expect(s.schemaLoad).toBe("idle");
  });
});
