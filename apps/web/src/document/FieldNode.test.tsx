import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FieldNode } from "./FieldNode";
import { useJrdmStore } from "../state/store";
import type { AnyField } from "@jrdm/model";

describe("FieldNode", () => {
  beforeEach(() => useJrdmStore.getState().reset());

  it("renders a scalar as key : source", () => {
    const f: AnyField = { key: "status", source: "orders.order_status" };
    render(<FieldNode field={f} path={[1]} />);
    const node = screen.getByTestId("field-1");
    expect(within(node).getByText("status")).toBeInTheDocument();
    expect(within(node).getByText("orders.order_status")).toBeInTheDocument();
  });

  it("renders a nested array with kind+table and its children recursively", () => {
    const f: AnyField = {
      key: "items",
      kind: "array",
      table: "order_items",
      fields: [{ key: "qty", source: "order_items.quantity" }],
    };
    render(<FieldNode field={f} path={[1]} />);
    const node = screen.getByTestId("field-1");
    expect(within(node).getByText(/items/)).toBeInTheDocument();
    expect(within(node).getByText(/array/)).toBeInTheDocument();
    expect(within(node).getByText(/order_items/)).toBeInTheDocument();
    expect(screen.getByTestId("field-1.0")).toBeInTheDocument(); // child
  });

  it("clicking selects its path in the store", async () => {
    const f: AnyField = { key: "status", source: "orders.order_status" };
    render(<FieldNode field={f} path={[2]} />);
    await userEvent.click(screen.getByTestId("field-2"));
    expect(useJrdmStore.getState().selectedFieldPath).toEqual([2]);
  });

  it("marks the node selected when its path matches the store", () => {
    useJrdmStore.getState().selectField([1]);
    const f: AnyField = { key: "status", source: "orders.order_status" };
    render(<FieldNode field={f} path={[1]} />);
    expect(screen.getByTestId("field-1")).toHaveAttribute("data-selected", "true");
  });
});

it("a nested FieldNode has NO drop handler (column nested-drop authoring retired)", () => {
  useJrdmStore.getState().reset();
  useJrdmStore.getState().setEditingView({
    name: "v_dv",
    schema: "app",
    createMode: "orReplace",
    root: {
      table: "orders",
      permissions: { insert: false, update: false, delete: false },
      etag: "check",
    },
    fields: [
      { key: "_id", source: "orders.id" },
      { key: "items", kind: "array", table: "order_items", fields: [] },
    ],
  });
  const f = useJrdmStore.getState().editingView!.fields[1]!;
  render(<FieldNode field={f} path={[1]} />);
  const node = screen.getByTestId("field-1");
  // Dropping a column-shaped payload onto a nested node must NOT add a child —
  // the v0.3b.1 nested-drop authoring path is removed (the modal replaces it).
  const payload = JSON.stringify({ table: "order_items", column: "quantity" });
  fireEvent.drop(node, {
    dataTransfer: { getData: (t: string) => (t === "application/x-jrdm-column" ? payload : "") },
  });
  const items = useJrdmStore.getState().editingView!.fields[1];
  expect(items && "fields" in items && items.fields).toEqual([]); // unchanged — no drop binding
});

it("a nested field is a treeitem with aria-expanded and aria-selected", () => {
  useJrdmStore.getState().reset();
  useJrdmStore.getState().selectField([1]);
  const f: AnyField = { key: "items", kind: "array", table: "order_items", fields: [] };
  render(<FieldNode field={f} path={[1]} />);
  const node = screen.getByTestId("field-1");
  expect(node).toHaveAttribute("role", "treeitem");
  expect(node).toHaveAttribute("aria-expanded", "true");
  expect(node).toHaveAttribute("aria-selected", "true");
  expect(node).toHaveAttribute("tabindex", "0");
});

it("an unselected scalar field is a treeitem, aria-selected false, tabindex -1, no aria-expanded", () => {
  useJrdmStore.getState().reset();
  const f: AnyField = { key: "_id", source: "orders.id" };
  render(<FieldNode field={f} path={[0]} />);
  const node = screen.getByTestId("field-0");
  expect(node).toHaveAttribute("role", "treeitem");
  expect(node).toHaveAttribute("aria-selected", "false");
  expect(node).toHaveAttribute("tabindex", "-1");
  expect(node).not.toHaveAttribute("aria-expanded");
});
