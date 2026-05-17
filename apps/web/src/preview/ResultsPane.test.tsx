import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultsPane } from "./ResultsPane";
import { useJrdmStore } from "../state/store";
import type { DualityView } from "@jrdm/model";

vi.mock("../api/client", () => ({
  sampleDocuments: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
}));

import * as client from "../api/client";

const SAMPLE_VIEW: DualityView = {
  name: "orders_dv",
  schema: "app",
  createMode: "orReplace",
  root: {
    table: "orders",
    permissions: { insert: false, update: false, delete: false },
    etag: "check",
  },
  fields: [{ key: "_id", source: "orders.id" }],
};

const SAMPLE_DOCS = [
  {
    _id: 1,
    status: "open",
    _metadata: { etag: "AABBCC" },
  },
  {
    _id: 2,
    status: "closed",
    _metadata: { etag: "DDEEFF" },
  },
];

describe("ResultsPane", () => {
  beforeEach(() => {
    useJrdmStore.getState().reset();
    vi.clearAllMocks();
  });

  it("renders a sample button", () => {
    render(<ResultsPane />);
    expect(screen.getByTestId("sample-btn")).toBeInTheDocument();
  });

  it("shows sample-empty when sampleDocs is empty and no error", () => {
    render(<ResultsPane />);
    expect(screen.getByTestId("sample-empty")).toBeInTheDocument();
  });

  it("calls sampleDocuments with editingView, connection, and 5 on button click", async () => {
    vi.mocked(client.sampleDocuments).mockResolvedValue({ documents: [] });
    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);
    useJrdmStore.getState().setConnection({
      user: "scott",
      password: "tiger",
      connectString: "host:1521/FREEPDB1",
    });

    render(<ResultsPane />);
    await userEvent.click(screen.getByTestId("sample-btn"));

    expect(client.sampleDocuments).toHaveBeenCalledWith(
      SAMPLE_VIEW,
      { user: "scott", password: "tiger", connectString: "host:1521/FREEPDB1" },
      5,
    );
  });

  it("calls setSampleDocs with returned documents", async () => {
    vi.mocked(client.sampleDocuments).mockResolvedValue({ documents: SAMPLE_DOCS });
    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);

    render(<ResultsPane />);
    await userEvent.click(screen.getByTestId("sample-btn"));

    await waitFor(() => {
      expect(useJrdmStore.getState().sampleDocs).toEqual(SAMPLE_DOCS);
    });
  });

  it("renders doc rows for each sampled document", () => {
    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);
    useJrdmStore.getState().setSampleDocs(SAMPLE_DOCS);

    render(<ResultsPane />);

    expect(screen.getByTestId("doc-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("doc-row-2")).toBeInTheDocument();
  });

  it("renders etag for each doc at data-testid doc-etag-<_id>", () => {
    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);
    useJrdmStore.getState().setSampleDocs(SAMPLE_DOCS);

    render(<ResultsPane />);

    expect(screen.getByTestId("doc-etag-1")).toHaveTextContent("AABBCC");
    expect(screen.getByTestId("doc-etag-2")).toHaveTextContent("DDEEFF");
  });

  it("calls selectDoc with the doc _id when a doc row is clicked", async () => {
    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);
    useJrdmStore.getState().setSampleDocs(SAMPLE_DOCS);

    render(<ResultsPane />);
    await userEvent.click(screen.getByTestId("doc-row-1"));

    expect(useJrdmStore.getState().selectedDocId).toBe(1);
  });

  it("does not show sample-empty when docs are loaded", () => {
    useJrdmStore.getState().setSampleDocs(SAMPLE_DOCS);
    render(<ResultsPane />);
    expect(screen.queryByTestId("sample-empty")).not.toBeInTheDocument();
  });

  it("shows sample-error with the ApiError message on fetch failure", async () => {
    const { ApiError } = await import("../api/client");
    vi.mocked(client.sampleDocuments).mockRejectedValue(new ApiError(502, "Oracle connect failed"));
    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);

    render(<ResultsPane />);
    await userEvent.click(screen.getByTestId("sample-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("sample-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("sample-error")).toHaveTextContent("Oracle connect failed");
  });

  it("shows sample-error for non-ApiError failures", async () => {
    vi.mocked(client.sampleDocuments).mockRejectedValue(new Error("network error"));
    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);

    render(<ResultsPane />);
    await userEvent.click(screen.getByTestId("sample-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("sample-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("sample-error")).toHaveTextContent("network error");
  });

  it("renders JSON tree nodes inside a doc row", () => {
    useJrdmStore.getState().setSampleDocs([{ _id: 1, status: "open", _metadata: { etag: "AB" } }]);
    render(<ResultsPane />);
    const row = screen.getByTestId("doc-row-1");
    // The doc key "status" should appear somewhere in the tree
    expect(within(row).getByText(/status/)).toBeInTheDocument();
  });

  it("renders collapsible object nodes (initially expanded)", () => {
    useJrdmStore
      .getState()
      .setSampleDocs([{ _id: 1, nested: { a: 1 }, _metadata: { etag: "AB" } }]);
    render(<ResultsPane />);
    const row = screen.getByTestId("doc-row-1");
    expect(within(row).getByText(/nested/)).toBeInTheDocument();
  });

  it("renders up to 5 docs", () => {
    const docs = Array.from({ length: 5 }, (_, i) => ({
      _id: i + 1,
      _metadata: { etag: `E${i}` },
    }));
    useJrdmStore.getState().setSampleDocs(docs);
    render(<ResultsPane />);
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`doc-row-${i}`)).toBeInTheDocument();
    }
  });
});
