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

  it("importToken defaults to 0", () => {
    expect(useJrdmStore.getState().importToken).toBe(0);
  });

  it("setImport stores project, relationships, issues", () => {
    useJrdmStore.getState().setImport({ project, relationships: rels, issues: [] });
    const s = useJrdmStore.getState();
    expect(s.project?.name).toBe("imported");
    expect(s.relationships).toEqual([]);
  });

  it("setImport increments importToken", () => {
    expect(useJrdmStore.getState().importToken).toBe(0);
    useJrdmStore.getState().setImport({ project, relationships: rels, issues: [] });
    expect(useJrdmStore.getState().importToken).toBe(1);
  });

  it("two successive setImport calls yield strictly increasing importToken", () => {
    useJrdmStore.getState().setImport({ project, relationships: rels, issues: [] });
    const token1 = useJrdmStore.getState().importToken;
    useJrdmStore.getState().setImport({ project, relationships: rels, issues: [] });
    const token2 = useJrdmStore.getState().importToken;
    expect(token2).toBeGreaterThan(token1);
    expect(token1).toBe(1);
    expect(token2).toBe(2);
  });

  it("reset restores importToken to 0", () => {
    useJrdmStore.getState().setImport({ project, relationships: rels, issues: [] });
    useJrdmStore.getState().setImport({ project, relationships: rels, issues: [] });
    expect(useJrdmStore.getState().importToken).toBe(2);
    useJrdmStore.getState().reset();
    expect(useJrdmStore.getState().importToken).toBe(0);
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

  it("defaults: no editingView, sql syntax, no selected field path", () => {
    const s = useJrdmStore.getState();
    expect(s.editingView).toBeNull();
    expect(s.ddlSyntax).toBe("sql");
    expect(s.selectedFieldPath).toBeNull();
  });

  it("startNewView seeds an editingView", () => {
    useJrdmStore.getState().startNewView("orders");
    const s = useJrdmStore.getState();
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

  it("setEditingView replaces the whole view", () => {
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
    expect(s.editingView).toBeNull();
    expect(s.selectedFieldPath).toBeNull();
    expect(s.ddlSyntax).toBe("sql");
  });
});

describe("useJrdmStore — layout slice", () => {
  beforeEach(() => {
    localStorage.clear();
    // reset layout to defaults without going through persistence
    useJrdmStore.setState({
      splitRatio: 0.5,
      splitCollapsed: null,
      dockOpen: false,
      dockTab: "ddl",
      inspectorOpen: false,
      inspectorPinned: false,
      connectModalOpen: false,
    });
    useJrdmStore.getState().reset();
  });

  it("defaults: splitRatio 0.5, no collapse, dock closed on ddl, inspector closed/unpinned, connect modal closed", () => {
    const s = useJrdmStore.getState();
    expect(s.splitRatio).toBe(0.5);
    expect(s.splitCollapsed).toBeNull();
    expect(s.dockOpen).toBe(false);
    expect(s.dockTab).toBe("ddl");
    expect(s.inspectorOpen).toBe(false);
    expect(s.inspectorPinned).toBe(false);
    expect(s.connectModalOpen).toBe(false);
  });

  it("setSplitRatio / setSplitCollapsed update state", () => {
    useJrdmStore.getState().setSplitRatio(0.7);
    expect(useJrdmStore.getState().splitRatio).toBe(0.7);
    useJrdmStore.getState().setSplitCollapsed("left");
    expect(useJrdmStore.getState().splitCollapsed).toBe("left");
    useJrdmStore.getState().setSplitCollapsed(null);
    expect(useJrdmStore.getState().splitCollapsed).toBeNull();
  });

  it("toggleDock flips dockOpen; setDockTab switches tab", () => {
    expect(useJrdmStore.getState().dockOpen).toBe(false);
    useJrdmStore.getState().toggleDock();
    expect(useJrdmStore.getState().dockOpen).toBe(true);
    useJrdmStore.getState().toggleDock();
    expect(useJrdmStore.getState().dockOpen).toBe(false);
    useJrdmStore.getState().setDockTab("issues");
    expect(useJrdmStore.getState().dockTab).toBe("issues");
    useJrdmStore.getState().setDockTab("deploy");
    expect(useJrdmStore.getState().dockTab).toBe("deploy");
  });

  it("setInspectorOpen / toggleInspectorPin / setConnectModalOpen update state", () => {
    useJrdmStore.getState().setInspectorOpen(true);
    expect(useJrdmStore.getState().inspectorOpen).toBe(true);
    useJrdmStore.getState().toggleInspectorPin();
    expect(useJrdmStore.getState().inspectorPinned).toBe(true);
    useJrdmStore.getState().toggleInspectorPin();
    expect(useJrdmStore.getState().inspectorPinned).toBe(false);
    useJrdmStore.getState().setConnectModalOpen(true);
    expect(useJrdmStore.getState().connectModalOpen).toBe(true);
    useJrdmStore.getState().setConnectModalOpen(false);
    expect(useJrdmStore.getState().connectModalOpen).toBe(false);
  });

  it("persists splitRatio/splitCollapsed/dockOpen/dockTab to localStorage and round-trips", () => {
    useJrdmStore.getState().setSplitRatio(0.65);
    useJrdmStore.getState().setSplitCollapsed("right");
    useJrdmStore.getState().toggleDock();
    useJrdmStore.getState().setDockTab("deploy");

    const raw = localStorage.getItem("jrdm.layout.v1");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as {
      splitRatio: number;
      splitCollapsed: string | null;
      dockOpen: boolean;
      dockTab: string;
    };
    expect(parsed).toEqual({
      splitRatio: 0.65,
      splitCollapsed: "right",
      dockOpen: true,
      dockTab: "deploy",
    });
  });

  it("reset() does NOT wipe layout prefs but DOES clear project/editingView/etc.", () => {
    useJrdmStore.getState().setSplitRatio(0.8);
    useJrdmStore.getState().toggleDock();
    useJrdmStore.getState().setDockTab("issues");
    useJrdmStore.getState().setImport({ project, relationships: rels, issues: [] });
    useJrdmStore.getState().startNewView("orders");
    useJrdmStore.getState().selectEntity("app.orders");

    useJrdmStore.getState().reset();

    const s = useJrdmStore.getState();
    // layout survives reset (cross-project user preference)
    expect(s.splitRatio).toBe(0.8);
    expect(s.dockOpen).toBe(true);
    expect(s.dockTab).toBe("issues");
    // project/authoring state IS cleared
    expect(s.project).toBeNull();
    expect(s.editingView).toBeNull();
    expect(s.selectedEntity).toBeNull();
    expect(s.importToken).toBe(0);
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

describe("useJrdmStore — mapping slice", () => {
  beforeEach(() => useJrdmStore.getState().reset());

  it("defaults: mapping closed with null table", () => {
    const s = useJrdmStore.getState();
    expect(s.mapping).toEqual({ open: false, table: null });
  });

  it("openMapping opens the modal for a given table", () => {
    useJrdmStore.getState().openMapping("ORDER_ITEMS");
    expect(useJrdmStore.getState().mapping).toEqual({ open: true, table: "ORDER_ITEMS" });
  });

  it("closeMapping closes the modal and clears the table", () => {
    useJrdmStore.getState().openMapping("ORDER_ITEMS");
    useJrdmStore.getState().closeMapping();
    expect(useJrdmStore.getState().mapping).toEqual({ open: false, table: null });
  });

  it("reset clears the mapping slice", () => {
    useJrdmStore.getState().openMapping("ORDERS");
    useJrdmStore.getState().reset();
    expect(useJrdmStore.getState().mapping).toEqual({ open: false, table: null });
  });
});
