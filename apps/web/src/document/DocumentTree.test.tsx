import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentTree } from "./DocumentTree";
import { useJrdmStore } from "../state/store";

describe("DocumentTree", () => {
  beforeEach(() => useJrdmStore.getState().reset());

  it("shows an empty hint when there is no editingView", () => {
    render(<DocumentTree />);
    expect(screen.getByTestId("doctree-empty")).toBeInTheDocument();
  });

  it("renders the root header and the field tree", () => {
    useJrdmStore.getState().startNewView("orders");
    render(<DocumentTree />);
    expect(screen.getByTestId("doctree-root")).toHaveTextContent("app.orders_dv");
    expect(screen.getByTestId("doctree-root")).toHaveTextContent("orders");
    expect(screen.getByTestId("field-0")).toHaveTextContent("_id");
  });
});

it("dropping a column payload onto the tree appends a scalar field", () => {
  useJrdmStore.getState().startNewView("orders");
  render(<DocumentTree />);
  const dz = screen.getByTestId("doctree");
  const payload = JSON.stringify({ table: "orders", column: "order_status" });
  fireEvent.drop(dz, {
    dataTransfer: { getData: (t: string) => (t === "application/x-jrdm-column" ? payload : "") },
  });
  const v = useJrdmStore.getState().editingView!;
  expect(v.fields).toHaveLength(2);
  expect(v.fields[1]).toEqual({ key: "order_status", source: "orders.order_status" });
});

it("toolbar '+ array' appends a nested array field at root and selects it", async () => {
  useJrdmStore.getState().startNewView("orders");
  render(<DocumentTree />);
  await userEvent.click(screen.getByRole("button", { name: "+ array" }));
  const v = useJrdmStore.getState().editingView!;
  expect(v.fields).toHaveLength(2);
  expect(v.fields[1]).toEqual({
    key: "new_array",
    kind: "array",
    table: "orders",
    fields: [],
  });
  expect(useJrdmStore.getState().selectedFieldPath).toEqual([1]);
});

it("toolbar '+ object' adds INTO the selected nested field", async () => {
  useJrdmStore.getState().startNewView("orders");
  // add an array at root and select it
  const store = useJrdmStore.getState();
  const { addField, nestedField } = await import("./documentModel");
  store.setEditingView(
    addField(store.editingView!, [], nestedField("items", "array", "order_items")),
  );
  store.selectField([1]);
  render(<DocumentTree />);
  await userEvent.click(screen.getByRole("button", { name: "+ object" }));
  const items = useJrdmStore.getState().editingView!.fields[1];
  expect(items && "fields" in items && items.fields).toEqual([
    { key: "new_object", kind: "object", table: "orders", fields: [] },
  ]);
  expect(useJrdmStore.getState().selectedFieldPath).toEqual([1, 0]);
});

it("toolbar is absent when there is no editingView", () => {
  useJrdmStore.getState().reset();
  render(<DocumentTree />);
  expect(screen.queryByRole("button", { name: "+ array" })).not.toBeInTheDocument();
});

it("the field tree container is role=tree", () => {
  useJrdmStore.getState().startNewView("orders");
  render(<DocumentTree />);
  expect(screen.getByRole("tree")).toBeInTheDocument();
});

it("drop on a nested FieldNode adds the child into that node only (stopPropagation prevents root double-add)", async () => {
  // Arrange: view with one scalar at root and one nested array at root
  useJrdmStore.getState().reset();
  useJrdmStore.getState().startNewView("orders");
  const store = useJrdmStore.getState();
  const { addField, nestedField } = await import("./documentModel");
  store.setEditingView(
    addField(store.editingView!, [], nestedField("items", "array", "order_items")),
  );
  // view.fields: [{ key: "_id", source: "orders.order_id" }, { key: "items", kind: "array", ... fields: [] }]
  render(<DocumentTree />);

  // Act: drop a column payload onto the nested FieldNode (field-1)
  const nestedNode = screen.getByTestId("field-1");
  const payload = JSON.stringify({ table: "order_items", column: "qty" });
  fireEvent.drop(nestedNode, {
    dataTransfer: { getData: (t: string) => (t === "application/x-jrdm-column" ? payload : "") },
  });

  // Assert: the nested field has exactly 1 child
  const updatedView = useJrdmStore.getState().editingView!;
  const nestedField_ = updatedView.fields[1];
  expect(nestedField_ && "fields" in nestedField_ && nestedField_.fields).toHaveLength(1);
  expect(nestedField_ && "fields" in nestedField_ && nestedField_.fields[0]).toEqual({
    key: "qty",
    source: "order_items.qty",
  });

  // Assert: root still has exactly 2 fields (the scalar _id + the nested items) — no double-add at root
  // If stopPropagation were missing, the root onDrop would also fire and add a third scalar at root.
  expect(updatedView.fields).toHaveLength(2);
});

// ── Entity drop → openMapping (M.T5) ────────────────────────────────────────

it("dropping application/x-jrdm-entity onto the tree opens the mapping modal", () => {
  useJrdmStore.getState().reset();
  useJrdmStore.getState().startNewView("orders");
  render(<DocumentTree />);
  const dz = screen.getByTestId("doctree");
  // Simulate the entity drag payload (table name only, no JSON wrapping)
  fireEvent.drop(dz, {
    dataTransfer: {
      getData: (t: string) => (t === "application/x-jrdm-entity" ? "order_items" : ""),
    },
  });
  // openMapping should have set mapping.open=true, mapping.table="order_items"
  const { mapping } = useJrdmStore.getState();
  expect(mapping.open).toBe(true);
  expect(mapping.table).toBe("order_items");
  // The existing editingView must be unchanged (entity drop doesn't mutate it)
  const view = useJrdmStore.getState().editingView!;
  expect(view.fields).toHaveLength(1); // only _id seeded by startNewView
});

it("entity drop does NOT trigger the column quick-bind path (view unchanged, modal opens)", () => {
  useJrdmStore.getState().reset();
  useJrdmStore.getState().startNewView("orders");
  const fieldCountBefore = useJrdmStore.getState().editingView!.fields.length;
  render(<DocumentTree />);
  const dz = screen.getByTestId("doctree");
  fireEvent.drop(dz, {
    dataTransfer: {
      // Entity MIME set; column MIME would also parse if it ran — ensure it doesn't
      getData: (t: string) => {
        if (t === "application/x-jrdm-entity") return "orders";
        if (t === "application/x-jrdm-column")
          return JSON.stringify({ table: "orders", column: "extra_col" });
        return "";
      },
    },
  });
  // Field count must NOT change (column path was short-circuited)
  expect(useJrdmStore.getState().editingView!.fields).toHaveLength(fieldCountBefore);
  // Modal must be open
  expect(useJrdmStore.getState().mapping.open).toBe(true);
});

it("column drop still works after the entity-drop path is added (quick-bind unchanged)", () => {
  useJrdmStore.getState().reset();
  useJrdmStore.getState().startNewView("orders");
  render(<DocumentTree />);
  const dz = screen.getByTestId("doctree");
  const payload = JSON.stringify({ table: "orders", column: "order_status" });
  fireEvent.drop(dz, {
    dataTransfer: {
      getData: (t: string) => {
        if (t === "application/x-jrdm-entity") return ""; // no entity payload
        if (t === "application/x-jrdm-column") return payload;
        return "";
      },
    },
  });
  const v = useJrdmStore.getState().editingView!;
  expect(v.fields).toHaveLength(2);
  expect(v.fields[1]).toEqual({ key: "order_status", source: "orders.order_status" });
  // Modal must NOT open for a column drop
  expect(useJrdmStore.getState().mapping.open).toBe(false);
});

it("ArrowDown selects the first field when none selected, then the next", () => {
  useJrdmStore.getState().startNewView("orders"); // fields: [_id]
  const store = useJrdmStore.getState();
  store.setEditingView({
    ...store.editingView!,
    fields: [
      { key: "_id", source: "orders.id" },
      { key: "status", source: "orders.order_status" },
    ],
  });
  render(<DocumentTree />);
  const tree = screen.getByRole("tree");
  fireEvent.keyDown(tree, { key: "ArrowDown" });
  expect(useJrdmStore.getState().selectedFieldPath).toEqual([0]);
  fireEvent.keyDown(tree, { key: "ArrowDown" });
  expect(useJrdmStore.getState().selectedFieldPath).toEqual([1]);
  fireEvent.keyDown(tree, { key: "ArrowUp" });
  expect(useJrdmStore.getState().selectedFieldPath).toEqual([0]);
});
