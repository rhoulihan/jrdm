import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DdlPane } from "./DdlPane";
import { useJrdmStore } from "../state/store";

describe("DdlPane", () => {
  beforeEach(() => useJrdmStore.getState().reset());
  afterEach(() => vi.restoreAllMocks());

  it("empty state when no editingView", () => {
    render(<DdlPane />);
    expect(screen.getByTestId("ddl-empty")).toBeInTheDocument();
  });

  it("renders generated SQL for the editing view", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              sql: "CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW app.orders_dv AS",
            }),
            {
              status: 200,
            },
          ),
        ),
      ),
    );
    render(<DdlPane />);
    useJrdmStore.getState().startNewView("orders");
    await waitFor(() =>
      expect(screen.getByTestId("ddl-output")).toHaveTextContent(
        "CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW",
      ),
    );
  });

  it("shows a friendly error on 422 unsupported_view", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: "unsupported_view",
              message: "MissingLinkError: nested field 'x'",
            }),
            {
              status: 422,
            },
          ),
        ),
      ),
    );
    render(<DdlPane />);
    useJrdmStore.getState().startNewView("orders");
    await waitFor(() =>
      expect(screen.getByTestId("ddl-error")).toHaveTextContent("MissingLinkError"),
    );
  });

  it("toggling syntax to GraphQL re-fetches", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ sql: "CREATE X" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ graphql: "orders { }" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<DdlPane />);
    useJrdmStore.getState().startNewView("orders");
    await waitFor(() => expect(screen.getByTestId("ddl-output")).toHaveTextContent("CREATE X"));
    await userEvent.click(screen.getByRole("button", { name: /^GraphQL$/ }));
    await waitFor(() => expect(screen.getByTestId("ddl-output")).toHaveTextContent("orders { }"));
  });
});
