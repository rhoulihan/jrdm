import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViewInspector } from "./ViewInspector";
import { useJrdmStore } from "../state/store";

describe("ViewInspector", () => {
  beforeEach(() => {
    useJrdmStore.getState().reset();
    useJrdmStore.getState().startNewView("orders");
  });

  it("empty hint when no editingView", () => {
    useJrdmStore.getState().reset();
    render(<ViewInspector />);
    expect(screen.getByTestId("viewinspector-empty")).toBeInTheDocument();
  });

  it("edits view name through to the store", async () => {
    render(<ViewInspector />);
    const name = screen.getByLabelText(/view name/i);
    await userEvent.clear(name);
    await userEvent.type(name, "ord_dv");
    expect(useJrdmStore.getState().editingView!.name).toBe("ord_dv");
  });

  it("toggles a root permission and createMode", async () => {
    render(<ViewInspector />);
    await userEvent.click(screen.getByLabelText(/root insert/i));
    await userEvent.selectOptions(screen.getByLabelText(/create mode/i), "create");
    const v = useJrdmStore.getState().editingView!;
    expect(v.root.permissions.insert).toBe(true);
    expect(v.createMode).toBe("create");
  });

  it("sets replication", async () => {
    render(<ViewInspector />);
    await userEvent.selectOptions(screen.getByLabelText(/replication/i), "enable");
    expect(useJrdmStore.getState().editingView!.replication).toBe("enable");
  });
});
