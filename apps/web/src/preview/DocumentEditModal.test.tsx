import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentEditModal } from "./DocumentEditModal";
import { useJrdmStore } from "../state/store";
import type { DualityView } from "@jrdm/model";

vi.mock("../api/client", () => ({
  readDocument: vi.fn(),
  writeDocument: vi.fn(),
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

const SAMPLE_DOC: Record<string, unknown> = {
  _id: 1,
  status: "open",
  _metadata: { etag: "AABBCC" },
};

const SAMPLE_DOCS = [
  { _id: 1, status: "open", _metadata: { etag: "AABBCC" } },
  { _id: 2, status: "closed", _metadata: { etag: "DDEEFF" } },
];

describe("DocumentEditModal", () => {
  beforeEach(() => {
    useJrdmStore.getState().reset();
    vi.clearAllMocks();
  });

  it("renders nothing when selectedDocId is null", () => {
    render(<DocumentEditModal />);
    expect(screen.queryByTestId("edit-field")).not.toBeInTheDocument();
  });

  it("calls readDocument when selectedDocId is set", async () => {
    vi.mocked(client.readDocument).mockResolvedValue({ document: SAMPLE_DOC });
    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);
    useJrdmStore.getState().setConnection({
      user: "scott",
      password: "tiger",
      connectString: "host:1521/FREEPDB1",
    });
    useJrdmStore.getState().selectDoc(1);

    render(<DocumentEditModal />);

    await waitFor(() => {
      expect(client.readDocument).toHaveBeenCalledWith(
        SAMPLE_VIEW,
        { user: "scott", password: "tiger", connectString: "host:1521/FREEPDB1" },
        1,
      );
    });
  });

  it("shows an editable field prefilled with a leaf scalar value", async () => {
    vi.mocked(client.readDocument).mockResolvedValue({ document: SAMPLE_DOC });
    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);
    useJrdmStore.getState().selectDoc(1);

    render(<DocumentEditModal />);

    await waitFor(() => {
      expect(screen.getByTestId("edit-field")).toBeInTheDocument();
    });
    // The field should be prefilled with a scalar value from the doc (e.g. status="open")
    expect(screen.getByTestId("edit-field")).toHaveValue("open");
  });

  it("calls writeDocument with the whole doc including original _metadata on Save", async () => {
    vi.mocked(client.readDocument).mockResolvedValue({ document: SAMPLE_DOC });
    vi.mocked(client.writeDocument).mockResolvedValue({
      document: { _id: 1, status: "updated", _metadata: { etag: "ZZYYXX" } },
    });

    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);
    useJrdmStore.getState().setConnection({
      user: "scott",
      password: "tiger",
      connectString: "host:1521/FREEPDB1",
    });
    useJrdmStore.getState().selectDoc(1);
    useJrdmStore.getState().setSampleDocs(SAMPLE_DOCS);

    render(<DocumentEditModal />);

    await waitFor(() => {
      expect(screen.getByTestId("edit-field")).toBeInTheDocument();
    });

    await userEvent.clear(screen.getByTestId("edit-field"));
    await userEvent.type(screen.getByTestId("edit-field"), "updated");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(client.writeDocument).toHaveBeenCalledWith(
        SAMPLE_VIEW,
        { user: "scott", password: "tiger", connectString: "host:1521/FREEPDB1" },
        1,
        expect.objectContaining({
          // Must include original _metadata (ETag contract)
          _metadata: { etag: "AABBCC" },
          status: "updated",
        }),
      );
    });
  });

  it("shows the new etag after a successful save", async () => {
    vi.mocked(client.readDocument).mockResolvedValue({ document: SAMPLE_DOC });
    vi.mocked(client.writeDocument).mockResolvedValue({
      document: { _id: 1, status: "updated", _metadata: { etag: "ZZYYXX" } },
    });

    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);
    useJrdmStore.getState().selectDoc(1);
    useJrdmStore.getState().setSampleDocs(SAMPLE_DOCS);

    render(<DocumentEditModal />);

    await waitFor(() => {
      expect(screen.getByTestId("edit-field")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByTestId("edit-new-etag")).toBeInTheDocument();
    });
    expect(screen.getByTestId("edit-new-etag")).toHaveTextContent("ZZYYXX");
  });

  it("refreshes that doc in sampleDocs after a successful save", async () => {
    vi.mocked(client.readDocument).mockResolvedValue({ document: SAMPLE_DOC });
    const updatedDoc = { _id: 1, status: "updated", _metadata: { etag: "ZZYYXX" } };
    vi.mocked(client.writeDocument).mockResolvedValue({ document: updatedDoc });

    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);
    useJrdmStore.getState().selectDoc(1);
    useJrdmStore.getState().setSampleDocs(SAMPLE_DOCS);

    render(<DocumentEditModal />);

    await waitFor(() => {
      expect(screen.getByTestId("edit-field")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      const docs = useJrdmStore.getState().sampleDocs as Array<Record<string, unknown>>;
      expect(docs.find((d) => d["_id"] === 1)).toEqual(updatedDoc);
    });
    // Doc 2 should be unchanged
    const docs = useJrdmStore.getState().sampleDocs as Array<Record<string, unknown>>;
    expect(docs.find((d) => d["_id"] === 2)).toEqual(SAMPLE_DOCS[1]);
  });

  it("calls setConflict on ApiError with status 409", async () => {
    vi.mocked(client.readDocument).mockResolvedValue({ document: SAMPLE_DOC });
    const { ApiError } = await import("../api/client");
    vi.mocked(client.writeDocument).mockRejectedValue(
      new ApiError(409, "ORA-42699: etag conflict"),
    );

    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);
    useJrdmStore.getState().selectDoc(1);
    useJrdmStore.getState().setSampleDocs(SAMPLE_DOCS);

    render(<DocumentEditModal />);

    await waitFor(() => {
      expect(screen.getByTestId("edit-field")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(useJrdmStore.getState().conflict).toEqual({
        message: "ORA-42699: etag conflict",
      });
    });
  });

  it("closes/clears selectedDocId on a 409 conflict", async () => {
    vi.mocked(client.readDocument).mockResolvedValue({ document: SAMPLE_DOC });
    const { ApiError } = await import("../api/client");
    vi.mocked(client.writeDocument).mockRejectedValue(
      new ApiError(409, "ORA-42699: etag conflict"),
    );

    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);
    useJrdmStore.getState().selectDoc(1);
    useJrdmStore.getState().setSampleDocs(SAMPLE_DOCS);

    render(<DocumentEditModal />);

    await waitFor(() => {
      expect(screen.getByTestId("edit-field")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(useJrdmStore.getState().selectedDocId).toBeNull();
    });
  });

  it("does not route non-409 ApiError to setConflict", async () => {
    vi.mocked(client.readDocument).mockResolvedValue({ document: SAMPLE_DOC });
    const { ApiError } = await import("../api/client");
    vi.mocked(client.writeDocument).mockRejectedValue(new ApiError(502, "Oracle down"));

    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);
    useJrdmStore.getState().selectDoc(1);
    useJrdmStore.getState().setSampleDocs(SAMPLE_DOCS);

    render(<DocumentEditModal />);

    await waitFor(() => {
      expect(screen.getByTestId("edit-field")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      // Error message shown, but conflict not set
      expect(screen.queryByTestId("edit-write-error")).toBeInTheDocument();
    });
    expect(useJrdmStore.getState().conflict).toBeNull();
  });
});
