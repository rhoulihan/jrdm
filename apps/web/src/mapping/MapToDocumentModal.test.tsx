import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapToDocumentModal } from "./MapToDocumentModal";
import { useJrdmStore } from "../state/store";
import type { DraftProject, DualityView, Relationship } from "@jrdm/model";

// ── Fixtures ────────────────────────────────────────────────────────────────

const ORDERS_COLS = [
  { name: "id", type: "NUMBER" as const, nullable: false },
  { name: "status", type: "VARCHAR2" as const, nullable: false },
  { name: "created_at", type: "DATE" as const, nullable: true },
];

const ORDER_ITEMS_COLS = [
  { name: "id", type: "NUMBER" as const, nullable: false },
  { name: "order_id", type: "NUMBER" as const, nullable: false },
  { name: "sku", type: "VARCHAR2" as const, nullable: false },
  { name: "qty", type: "NUMBER" as const, nullable: false },
  { name: "price", type: "NUMBER" as const, nullable: true },
];

const PROJECT: DraftProject = {
  name: "shop",
  version: "1",
  entities: [
    {
      name: "ORDERS",
      schema: "app",
      columns: ORDERS_COLS,
      primaryKey: ["id"],
    },
    {
      name: "ORDER_ITEMS",
      schema: "app",
      columns: ORDER_ITEMS_COLS,
      primaryKey: ["id"],
    },
  ],
  views: [],
};

// ORDERS (1) → ORDER_ITEMS (N): from = PK/parent side.
const REL_1N: Relationship = {
  name: "fk_order_items_order",
  from: { schema: "app", table: "ORDERS", columns: ["id"] },
  to: { schema: "app", table: "ORDER_ITEMS", columns: ["order_id"] },
  cardinality: "1:N",
};

const ORDERS_VIEW: DualityView = {
  name: "orders_dv",
  schema: "app",
  createMode: "orReplace",
  root: {
    table: "ORDERS",
    permissions: { insert: false, update: false, delete: false },
    etag: "check",
  },
  fields: [
    { key: "_id", source: "ORDERS.id" },
    { key: "status", source: "ORDERS.status" },
  ],
};

/** Typed accessor for the single synthetic sample document the modal sets. */
function sampleDoc(): Record<string, unknown> {
  const docs = useJrdmStore.getState().sampleDocs;
  expect(docs).toHaveLength(1);
  return docs[0] as Record<string, unknown>;
}

function seedStore(opts: {
  table: string;
  editingView?: DualityView | null;
  relationships?: Relationship[];
}) {
  const st = useJrdmStore.getState();
  st.reset();
  st.setImport({
    project: PROJECT,
    relationships: opts.relationships ?? [],
    issues: [],
  });
  if (opts.editingView !== undefined) st.setEditingView(opts.editingView);
  st.openMapping(opts.table);
}

describe("MapToDocumentModal", () => {
  beforeEach(() => useJrdmStore.getState().reset());

  it("renders nothing when mapping is closed", () => {
    render(<MapToDocumentModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing when the table cannot be resolved to an entity", () => {
    const st = useJrdmStore.getState();
    st.setImport({ project: PROJECT, relationships: [], issues: [] });
    st.openMapping("NOPE");
    render(<MapToDocumentModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens with title naming the table and lists that table's columns", () => {
    seedStore({ table: "ORDER_ITEMS" });
    render(<MapToDocumentModal />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", 'Map "ORDER_ITEMS" to Document');
    for (const c of ORDER_ITEMS_COLS) {
      expect(screen.getByTestId(`field-${c.name}`)).toBeInTheDocument();
    }
  });

  it("seeds the working tree from editingView (pre-existing nodes are locked)", () => {
    seedStore({ table: "ORDER_ITEMS", editingView: ORDERS_VIEW });
    render(<MapToDocumentModal />);
    // _id and status from ORDERS_VIEW are present and locked.
    const idNode = screen.getByTestId("mnode-0");
    const statusNode = screen.getByTestId("mnode-1");
    expect(idNode).toHaveAttribute("data-locked", "true");
    expect(statusNode).toHaveAttribute("data-locked", "true");
  });

  it("Select All grays the column list", async () => {
    const user = userEvent.setup();
    seedStore({ table: "ORDER_ITEMS" });
    render(<MapToDocumentModal />);
    await user.click(screen.getByTestId("select-all"));
    expect(screen.getByTestId("field-list").className).toMatch(/pointer-events-none/);
  });

  it("Map to Path is disabled until columns AND a node are selected, then binds scalars", async () => {
    const user = userEvent.setup();
    seedStore({ table: "ORDER_ITEMS", editingView: ORDERS_VIEW, relationships: [REL_1N] });
    render(<MapToDocumentModal />);

    const mapBtn = screen.getByTestId("map-to-path-btn");
    expect(mapBtn).toBeDisabled();

    // Add a nested ORDER_ITEMS node at the document-root level.
    await user.click(screen.getByTestId("mnode-0"));
    await user.click(screen.getByTestId("add-node-btn"));
    // The new nested node is auto-selected at root index 2.
    expect(screen.getByTestId("mnode-2")).toBeInTheDocument();

    // No columns checked yet → disabled even with a node selected.
    expect(mapBtn).toBeDisabled();

    await user.click(screen.getByTestId("field-sku"));
    await user.click(screen.getByTestId("field-qty"));
    expect(mapBtn).toBeEnabled();

    await user.click(mapBtn);

    // Two scalar children appended under the ORDER_ITEMS node (scoped to tree).
    const tree = screen.getByTestId("mapping-tree");
    expect(within(tree).getByText("ORDER_ITEMS.sku")).toBeInTheDocument();
    expect(within(tree).getByText("ORDER_ITEMS.qty")).toBeInTheDocument();
  });

  it("+ add node with no prior view creates the document ROOT from PK; Save commits", async () => {
    const user = userEvent.setup();
    seedStore({ table: "ORDERS", editingView: null });
    render(<MapToDocumentModal />);

    // No prior editingView → + assigns the dropped entity as the document root.
    await user.click(screen.getByTestId("add-node-btn"));

    await user.click(screen.getByTestId("map-save"));

    const view = useJrdmStore.getState().editingView!;
    expect(view).toBeTruthy();
    expect(view.root.table).toBe("ORDERS");
    // _id source seeded from the entity's primary key.
    expect(view.fields[0]).toEqual({ key: "_id", source: "ORDERS.id" });
    // sampleDocs populated with a real synthetic document (values + etag).
    const doc = sampleDoc();
    expect(doc._id).toBe(123); // ORDERS.id NUMBER
    expect((doc._metadata as { etag: string }).etag).toBe("SAMPLE0000");
  });

  it("KEYSTONE: Save transforms editingView via toDualityView AND sets a real sample doc", async () => {
    const user = userEvent.setup();
    seedStore({ table: "ORDER_ITEMS", editingView: ORDERS_VIEW, relationships: [REL_1N] });
    render(<MapToDocumentModal />);

    // Select root, add a subnode for ORDER_ITEMS (FK ORDERS→ORDER_ITEMS 1:N → array).
    await user.click(screen.getByTestId("mnode-0"));
    await user.click(screen.getByTestId("add-node-btn"));

    // The embed checkbox should be FK-forced to array (checked + disabled).
    const embed = screen.getByTestId("embed-as-array");
    expect(embed).toBeChecked();
    expect(embed).toBeDisabled();

    // Map sku + qty under the new ORDER_ITEMS subnode (auto-selected).
    await user.click(screen.getByTestId("field-sku"));
    await user.click(screen.getByTestId("field-qty"));
    await user.click(screen.getByTestId("map-to-path-btn"));

    await user.click(screen.getByTestId("map-save"));

    const view = useJrdmStore.getState().editingView!;
    // Root preserved.
    expect(view.root.table).toBe("ORDERS");
    expect(view.fields[0]).toEqual({ key: "_id", source: "ORDERS.id" });
    expect(view.fields[1]).toEqual({ key: "status", source: "ORDERS.status" });
    // New nested ORDER_ITEMS node appended as the 3rd field, as an array, with FK link.
    const nested = view.fields[2] as {
      key: string;
      kind: string;
      table: string;
      link: { from: string[]; to: string[] };
      fields: { key: string; source: string }[];
    };
    expect(nested.key).toBe("ORDER_ITEMS");
    expect(nested.kind).toBe("array");
    expect(nested.table).toBe("ORDER_ITEMS");
    expect(nested.link).toEqual({ from: ["id"], to: ["order_id"] });
    expect(nested.fields).toEqual([
      { key: "sku", source: "ORDER_ITEMS.sku" },
      { key: "qty", source: "ORDER_ITEMS.qty" },
    ]);

    // Sample doc: real values + 2-element array of the child shape + etag.
    const doc = sampleDoc();
    expect(doc._id).toBe(123); // ORDERS.id NUMBER
    expect(doc.status).toBe("sample"); // ORDERS.status VARCHAR2
    const arr = doc.ORDER_ITEMS as Record<string, unknown>[];
    expect(arr).toHaveLength(2);
    expect(arr[0]).toEqual({ sku: "sample", qty: 123 });
    expect(arr[1]).toEqual({ sku: "sample", qty: 123 });
    expect((doc._metadata as { etag: string }).etag).toBe("SAMPLE0000");
  });

  it("KEYSTONE: Cancel discards the working copy — editingView untouched, no sample docs", async () => {
    const user = userEvent.setup();
    seedStore({ table: "ORDER_ITEMS", editingView: ORDERS_VIEW, relationships: [REL_1N] });
    render(<MapToDocumentModal />);

    const before = structuredClone(useJrdmStore.getState().editingView);

    // Make structural changes that would otherwise be saved.
    await user.click(screen.getByTestId("mnode-0"));
    await user.click(screen.getByTestId("add-node-btn"));
    await user.click(screen.getByTestId("field-sku"));
    await user.click(screen.getByTestId("map-to-path-btn"));

    await user.click(screen.getByTestId("map-cancel"));

    // editingView is exactly what it was — provably unchanged.
    expect(useJrdmStore.getState().editingView).toEqual(before);
    expect(useJrdmStore.getState().sampleDocs).toEqual([]);
    expect(useJrdmStore.getState().mapping).toEqual({ open: false, table: null });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("embed checkbox is user-toggleable when no FK decides it", async () => {
    const user = userEvent.setup();
    // No relationships → not FK-driven.
    seedStore({ table: "ORDER_ITEMS", editingView: ORDERS_VIEW, relationships: [] });
    render(<MapToDocumentModal />);

    await user.click(screen.getByTestId("mnode-0"));
    await user.click(screen.getByTestId("add-node-btn"));

    const embed = screen.getByTestId("embed-as-array");
    expect(embed).toBeEnabled();
    expect(embed).not.toBeChecked(); // default object

    await user.click(embed);
    expect(screen.getByTestId("embed-as-array")).toBeChecked();

    await user.click(screen.getByTestId("map-save"));
    const view = useJrdmStore.getState().editingView!;
    const nested = view.fields[2]!;
    expect("kind" in nested && nested.kind).toBe("array");
  });

  it("embed checkbox is hidden when the entity node is placed at root", async () => {
    const user = userEvent.setup();
    seedStore({ table: "ORDERS", editingView: null });
    render(<MapToDocumentModal />);
    await user.click(screen.getByTestId("add-node-btn"));
    expect(screen.queryByTestId("embed-as-array")).not.toBeInTheDocument();
  });

  it("locked pre-existing nodes cannot be deleted (M.T1 guard surfaced)", async () => {
    const user = userEvent.setup();
    seedStore({ table: "ORDER_ITEMS", editingView: ORDERS_VIEW });
    render(<MapToDocumentModal />);

    await user.click(screen.getByTestId("mnode-1")); // status — locked
    const del = screen.getByTestId("delete-node-btn");
    expect(del).toBeDisabled();

    // Even if invoked, the working copy op no-ops on locked → node remains.
    expect(screen.getByTestId("mnode-1")).toBeInTheDocument();
  });

  it("delete removes a session-created node", async () => {
    const user = userEvent.setup();
    seedStore({ table: "ORDER_ITEMS", editingView: ORDERS_VIEW, relationships: [REL_1N] });
    render(<MapToDocumentModal />);

    await user.click(screen.getByTestId("mnode-0"));
    await user.click(screen.getByTestId("add-node-btn"));
    // New node at path 0.2 (3rd child of root) — exists & selected.
    expect(screen.getByTestId("mnode-2")).toBeInTheDocument();

    const del = screen.getByTestId("delete-node-btn");
    expect(del).toBeEnabled();
    await user.click(del);
    expect(screen.queryByTestId("mnode-2")).not.toBeInTheDocument();
  });

  it("Cancel via the Modal overlay/Esc also closes without mutating editingView", async () => {
    const user = userEvent.setup();
    seedStore({ table: "ORDER_ITEMS", editingView: ORDERS_VIEW });
    render(<MapToDocumentModal />);
    const before = structuredClone(useJrdmStore.getState().editingView);
    await user.keyboard("{Escape}");
    expect(useJrdmStore.getState().editingView).toEqual(before);
    expect(useJrdmStore.getState().mapping.open).toBe(false);
  });

  it("scopes its tree query (no markup contortion — single dialog, single tree)", () => {
    seedStore({ table: "ORDER_ITEMS", editingView: ORDERS_VIEW });
    render(<MapToDocumentModal />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByTestId("mapping-tree")).toBeInTheDocument();
    expect(within(dialog).getByTestId("field-list")).toBeInTheDocument();
  });
});
