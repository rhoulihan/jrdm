import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { useJrdmStore } from "./state/store";

describe("App (new workspace shell)", () => {
  beforeEach(() => useJrdmStore.getState().reset());
  afterEach(() => vi.restoreAllMocks());

  it("renders the workspace shell with both panes and no mode toggle", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /JRDM/ })).toBeInTheDocument();
    // both panes always mounted simultaneously
    expect(screen.getByTestId("diagram-empty")).toBeInTheDocument();
    expect(screen.getByTestId("doctree-empty")).toBeInTheDocument();
    // no ERD/Design mode toggle survives
    expect(screen.queryByText(/ERD mode|Design mode/)).toBeNull();
  });

  it("hosts the connection/import flow in a modal opened from the toolbar", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ schemas: ["APP"] }), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
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
            }),
            { status: 200 },
          ),
        ),
    );
    render(<App />);
    // no connection form until the modal is opened
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByTestId("connect-btn"));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/^user$/i), "scott");
    await userEvent.type(within(dialog).getByLabelText(/^password$/i), "tiger");
    await userEvent.type(within(dialog).getByLabelText(/connect string/i), "h:1521/FREEPDB1");
    await userEvent.click(within(dialog).getByTestId("form-connect-btn"));
    await waitFor(() => expect(within(dialog).getByLabelText(/schema/i)).toHaveValue("APP"));
    await userEvent.click(within(dialog).getByRole("button", { name: /^import$/i }));
    await waitFor(() => expect(screen.getByTestId("diagram-canvas")).toBeInTheDocument());
    expect(screen.queryByTestId("error-banner")).not.toBeInTheDocument();
  });

  it("shows an error banner when the modal-hosted import fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ schemas: ["APP"] }), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ message: "ORA-12541" }), { status: 502 }),
        ),
    );
    render(<App />);
    await userEvent.click(screen.getByTestId("connect-btn"));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/^user$/i), "scott");
    await userEvent.type(within(dialog).getByLabelText(/^password$/i), "tiger");
    await userEvent.type(within(dialog).getByLabelText(/connect string/i), "h:1521/FREEPDB1");
    await userEvent.click(within(dialog).getByTestId("form-connect-btn"));
    await waitFor(() => expect(within(dialog).getByLabelText(/schema/i)).toHaveValue("APP"));
    await userEvent.click(within(dialog).getByRole("button", { name: /^import$/i }));
    await waitFor(() => expect(screen.getByTestId("error-banner")).toHaveTextContent("ORA-12541"));
  });
});
