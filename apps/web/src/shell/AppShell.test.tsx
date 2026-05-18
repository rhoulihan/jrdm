import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "./AppShell";
import { useJrdmStore } from "../state/store";

const importPayload = {
  project: {
    name: "imported",
    version: "0.1.0",
    entities: [
      {
        name: "orders",
        schema: "app",
        columns: [{ name: "order_id", type: "NUMBER", nullable: false }],
        primaryKey: ["order_id"],
      },
    ],
    views: [],
  },
  relationships: [],
  issues: [],
};

async function openConnectAndImport() {
  await userEvent.click(screen.getByTestId("connect-btn"));
  const dialog = await screen.findByRole("dialog");
  await userEvent.type(within(dialog).getByLabelText(/^user$/i), "scott");
  await userEvent.type(within(dialog).getByLabelText(/^password$/i), "tiger");
  await userEvent.type(within(dialog).getByLabelText(/connect string/i), "h:1521/FREEPDB1");
  await userEvent.click(within(dialog).getByTestId("connect-btn"));
  await waitFor(() => expect(within(dialog).getByLabelText(/schema/i)).toHaveValue("APP"));
  await userEvent.click(within(dialog).getByRole("button", { name: /^import$/i }));
}

describe("AppShell", () => {
  beforeEach(() => useJrdmStore.getState().reset());
  afterEach(() => vi.restoreAllMocks());

  it("mounts BOTH the ERD diagram and the document tree simultaneously (no mode)", () => {
    render(<AppShell />);
    expect(screen.getByTestId("diagram-empty")).toBeInTheDocument();
    expect(screen.getByTestId("doctree-empty")).toBeInTheDocument();
  });

  it("has NO ERD/Design mode toggle anywhere", () => {
    render(<AppShell />);
    expect(screen.queryByText(/ERD mode|Design mode/)).toBeNull();
    expect(screen.queryByRole("button", { name: /erd mode/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /design mode/i })).toBeNull();
  });

  it("bottom dock is collapsed by default and expands on the dock control", async () => {
    render(<AppShell />);
    const dock = screen.getByTestId("bottom-dock");
    // collapsed → expand affordance present, no tablist
    expect(within(dock).getByTestId("dock-expand")).toBeInTheDocument();
    expect(within(dock).queryByRole("tablist")).toBeNull();
    await userEvent.click(within(dock).getByTestId("dock-expand"));
    expect(within(screen.getByTestId("bottom-dock")).getByRole("tablist")).toBeInTheDocument();
  });

  it("inspector drawer opens via the View menu and Esc-closes when unpinned", async () => {
    render(<AppShell />);
    expect(screen.queryByTestId("inspector-drawer")).toBeNull();
    await userEvent.click(screen.getByRole("menuitem", { name: /^view$/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /toggle inspector/i }));
    expect(screen.getByTestId("inspector-drawer")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByTestId("inspector-drawer")).toBeNull();
  });

  it("opens the Connect modal from the toolbar and drives useImport on submit (success clears error)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ schemas: ["APP"] }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(importPayload), { status: 200 })),
    );
    render(<AppShell />);
    await openConnectAndImport();
    await waitFor(() => expect(screen.getByTestId("diagram-canvas")).toBeInTheDocument());
    expect(screen.queryByTestId("error-banner")).not.toBeInTheDocument();
  });

  it("renders the error-banner when the import fails (regression-preserved)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ schemas: ["APP"] }), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ message: "ORA-12541" }), { status: 502 }),
        ),
    );
    render(<AppShell />);
    await openConnectAndImport();
    await waitFor(() => expect(screen.getByTestId("error-banner")).toHaveTextContent("ORA-12541"));
  });

  it("startNewView from the selected entity is still reachable (no authoring capability lost)", async () => {
    useJrdmStore.getState().selectEntity("app.orders");
    render(<AppShell />);
    const btn = screen.getByTestId("new-view-btn");
    expect(btn).toHaveTextContent('Design view from "app.orders"');
    await userEvent.click(btn);
    expect(useJrdmStore.getState().editingView).not.toBeNull();
    expect(useJrdmStore.getState().editingView?.root.table).toBe("orders");
    // document tree now reflects the editing view, still alongside the ERD
    expect(screen.getByTestId("doctree")).toBeInTheDocument();
    expect(screen.getByTestId("diagram-empty")).toBeInTheDocument();
  });
});
