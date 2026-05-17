import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { useJrdmStore } from "./state/store";

describe("App shell", () => {
  beforeEach(() => useJrdmStore.getState().reset());
  afterEach(() => vi.restoreAllMocks());

  it("renders the connection form and an empty diagram initially", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /import/i })).toBeInTheDocument();
    expect(screen.getByTestId("diagram-empty")).toBeInTheDocument();
  });

  it("after a successful import, renders the diagram canvas and clears any error", async () => {
    const payload = {
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
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }))),
    );
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^user$/i), "scott");
    await userEvent.type(screen.getByLabelText(/^password$/i), "tiger");
    await userEvent.type(screen.getByLabelText(/connect string/i), "h:1521/FREEPDB1");
    await userEvent.type(screen.getByLabelText(/schema owner/i), "APP");
    await userEvent.click(screen.getByRole("button", { name: /^import$/i }));
    await waitFor(() => expect(screen.getByTestId("diagram-canvas")).toBeInTheDocument());
    expect(screen.queryByTestId("error-banner")).not.toBeInTheDocument();
  });

  it("shows an error banner when the import fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ message: "ORA-12541" }), { status: 502 })),
      ),
    );
    render(<App />);
    await userEvent.type(screen.getByLabelText(/^user$/i), "scott");
    await userEvent.type(screen.getByLabelText(/^password$/i), "tiger");
    await userEvent.type(screen.getByLabelText(/connect string/i), "h:1521/FREEPDB1");
    await userEvent.type(screen.getByLabelText(/schema owner/i), "APP");
    await userEvent.click(screen.getByRole("button", { name: /^import$/i }));
    await waitFor(() => expect(screen.getByTestId("error-banner")).toHaveTextContent("ORA-12541"));
  });

  it("toggles ERD/Design mode and shows the document editor surface", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    useJrdmStore.getState().reset();
    render(<App />);
    // ERD mode by default — diagram empty-state visible
    expect(screen.getByTestId("diagram-empty")).toBeInTheDocument();
    // switch to Design mode
    await userEvent.click(screen.getByRole("button", { name: /design mode/i }));
    expect(screen.getByTestId("doctree-empty")).toBeInTheDocument();
    expect(screen.getByTestId("ddl-empty")).toBeInTheDocument();
  });

  it("shows preview-panel in design mode and not in erd mode", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    useJrdmStore.getState().reset();
    render(<App />);
    // ERD mode by default — no preview-panel
    expect(screen.queryByTestId("preview-panel")).not.toBeInTheDocument();
    // switch to Design mode — preview-panel appears
    await userEvent.click(screen.getByRole("button", { name: /design mode/i }));
    expect(screen.getByTestId("preview-panel")).toBeInTheDocument();
    // switch back to ERD — preview-panel gone
    await userEvent.click(screen.getByRole("button", { name: /erd mode/i }));
    expect(screen.queryByTestId("preview-panel")).not.toBeInTheDocument();
  });

  it("preview-panel appears outside the main document-tree/ddl column in design mode", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    useJrdmStore.getState().reset();
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /design mode/i }));
    // PreviewPanel is in the right-rail aside, not inside the main flex-column
    const panel = screen.getByTestId("preview-panel");
    const ddlEmpty = screen.getByTestId("ddl-empty");
    // panel and ddl-empty must NOT share the same parent (different regions)
    expect(panel.parentElement).not.toBe(ddlEmpty.parentElement);
  });
});
