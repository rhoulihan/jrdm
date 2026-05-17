import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContextInspector } from "./ContextInspector";
import { useJrdmStore } from "../state/store";

describe("ContextInspector", () => {
  beforeEach(() => useJrdmStore.getState().reset());

  it("ERD mode → entity Inspector", () => {
    render(<ContextInspector />);
    expect(screen.getByTestId("inspector-empty")).toBeInTheDocument();
  });

  it("Design mode + no field selected → ViewInspector", () => {
    useJrdmStore.getState().startNewView("orders");
    render(<ContextInspector />);
    expect(screen.getByTestId("viewinspector")).toBeInTheDocument();
  });

  it("Design mode + field selected → FieldInspector", () => {
    useJrdmStore.getState().startNewView("orders");
    useJrdmStore.getState().selectField([0]);
    render(<ContextInspector />);
    expect(screen.getByTestId("fieldinspector")).toBeInTheDocument();
  });
});
