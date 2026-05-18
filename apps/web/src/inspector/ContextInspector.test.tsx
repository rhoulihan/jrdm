import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContextInspector } from "./ContextInspector";
import { useJrdmStore } from "../state/store";

describe("ContextInspector", () => {
  beforeEach(() => useJrdmStore.getState().reset());

  it("no editingView → entity Inspector", () => {
    render(<ContextInspector />);
    expect(screen.getByTestId("inspector-empty")).toBeInTheDocument();
  });

  it("editingView + no field selected → ViewInspector", () => {
    useJrdmStore.getState().startNewView("orders");
    render(<ContextInspector />);
    expect(screen.getByTestId("viewinspector")).toBeInTheDocument();
  });

  it("editingView + field selected → FieldInspector", () => {
    useJrdmStore.getState().startNewView("orders");
    useJrdmStore.getState().selectField([0]);
    render(<ContextInspector />);
    expect(screen.getByTestId("fieldinspector")).toBeInTheDocument();
  });
});
