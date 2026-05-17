import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
