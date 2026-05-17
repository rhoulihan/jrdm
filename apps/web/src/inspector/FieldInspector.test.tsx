import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FieldInspector } from "./FieldInspector";
import { useJrdmStore } from "../state/store";

function seedNested() {
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
}

describe("FieldInspector", () => {
  beforeEach(() => useJrdmStore.getState().reset());

  it("empty hint when no field selected", () => {
    render(<FieldInspector />);
    expect(screen.getByTestId("fieldinspector-empty")).toBeInTheDocument();
  });

  it("edits a scalar source and writes through to the store", async () => {
    useJrdmStore.getState().setEditingView({
      name: "v_dv",
      schema: "app",
      createMode: "orReplace",
      root: {
        table: "orders",
        permissions: { insert: false, update: false, delete: false },
        etag: "check",
      },
      fields: [{ key: "_id", source: "orders.id" }],
    });
    useJrdmStore.getState().selectField([0]);
    render(<FieldInspector />);
    const src = screen.getByLabelText(/source/i);
    await userEvent.clear(src);
    await userEvent.type(src, "orders.order_id");
    expect(useJrdmStore.getState().editingView!.fields[0]).toEqual({
      key: "_id",
      source: "orders.order_id",
    });
  });

  it("nested: edits asymmetric link.from/link.to and toggles a permission", async () => {
    seedNested();
    useJrdmStore.getState().selectField([1]);
    render(<FieldInspector />);
    const from = screen.getByTestId("link-from");
    const to = screen.getByTestId("link-to");
    await userEvent.clear(from);
    await userEvent.type(from, "id");
    await userEvent.clear(to);
    await userEvent.type(to, "order_id");
    await userEvent.click(screen.getByLabelText(/insert/i));
    const f = useJrdmStore.getState().editingView!.fields[1];
    expect(f).toMatchObject({
      link: { from: ["id"], to: ["order_id"] },
      permissions: { insert: true },
    });
  });

  it("Remove field deletes it and clears selection", async () => {
    seedNested();
    useJrdmStore.getState().selectField([1]);
    render(<FieldInspector />);
    await userEvent.click(screen.getByRole("button", { name: /remove field/i }));
    expect(useJrdmStore.getState().editingView!.fields).toHaveLength(1);
    expect(useJrdmStore.getState().selectedFieldPath).toBeNull();
  });
});
