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

it("the tree container has NO drag-drop handlers (per-column quick-drag retired)", () => {
  useJrdmStore.getState().startNewView("orders");
  render(<DocumentTree />);
  const dz = screen.getByTestId("doctree");
  // A column-shaped payload dropped on the tree must NOT bind a scalar — the
  // quick-bind onDrop handler is removed; the modal is the authoring path now.
  const payload = JSON.stringify({ table: "orders", column: "order_status" });
  fireEvent.drop(dz, {
    dataTransfer: { getData: (t: string) => (t === "application/x-jrdm-column" ? payload : "") },
  });
  const v = useJrdmStore.getState().editingView!;
  expect(v.fields).toHaveLength(1); // only the _id seeded by startNewView — unchanged
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
