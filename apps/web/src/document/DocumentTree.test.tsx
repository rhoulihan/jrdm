import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
