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
});
