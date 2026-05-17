import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeployDialog } from "./DeployDialog";
import { useJrdmStore } from "../state/store";
import type { DualityView } from "@jrdm/model";

vi.mock("../api/client", () => ({
  deployView: vi.fn(),
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

describe("DeployDialog", () => {
  beforeEach(() => {
    useJrdmStore.getState().reset();
    vi.clearAllMocks();
  });

  it("renders connection inputs prefilled from store.connection", () => {
    useJrdmStore.getState().setConnection({
      user: "scott",
      password: "tiger",
      connectString: "host:1521/FREEPDB1",
    });
    render(<DeployDialog />);
    expect(screen.getByLabelText(/^user$/i)).toHaveValue("scott");
    expect(screen.getByLabelText(/^password$/i)).toHaveValue("tiger");
    expect(screen.getByLabelText(/connect string/i)).toHaveValue("host:1521/FREEPDB1");
  });

  it("renders a deploy button", () => {
    render(<DeployDialog />);
    expect(screen.getByTestId("deploy-btn")).toBeInTheDocument();
  });

  it("disables the deploy button when editingView is null", () => {
    useJrdmStore.getState().setEditingView(null);
    render(<DeployDialog />);
    expect(screen.getByTestId("deploy-btn")).toBeDisabled();
  });

  it("disables the deploy button while deploying", () => {
    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);
    useJrdmStore.getState().setDeployState("deploying");
    render(<DeployDialog />);
    expect(screen.getByTestId("deploy-btn")).toBeDisabled();
  });

  it("calls deployView and shows deploy-success with statement count on success", async () => {
    vi.mocked(client.deployView).mockResolvedValue({
      deployed: true,
      statements: 3,
      view: "orders_dv",
    });

    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);
    useJrdmStore.getState().setConnection({
      user: "scott",
      password: "tiger",
      connectString: "host:1521/FREEPDB1",
    });

    render(<DeployDialog />);
    await userEvent.click(screen.getByTestId("deploy-btn"));

    expect(client.deployView).toHaveBeenCalledWith(
      SAMPLE_VIEW,
      { user: "scott", password: "tiger", connectString: "host:1521/FREEPDB1" },
      undefined,
    );

    await waitFor(() => {
      expect(screen.getByTestId("deploy-success")).toBeInTheDocument();
    });
    expect(screen.getByTestId("deploy-success")).toHaveTextContent("3 statements");
    expect(useJrdmStore.getState().deployState).toBe("deployed");
  });

  it("shows deploy-error with message on ApiError", async () => {
    const { ApiError } = await import("../api/client");
    vi.mocked(client.deployView).mockRejectedValue(new ApiError(502, "Oracle connect failed"));

    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);
    useJrdmStore.getState().setConnection({
      user: "scott",
      password: "tiger",
      connectString: "bad:1521/FREEPDB1",
    });

    render(<DeployDialog />);
    await userEvent.click(screen.getByTestId("deploy-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("deploy-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("deploy-error")).toHaveTextContent("Oracle connect failed");
    expect(useJrdmStore.getState().deployState).toBe("error");
  });

  it("writes connection changes back to the store", async () => {
    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);
    render(<DeployDialog />);

    await userEvent.clear(screen.getByLabelText(/^user$/i));
    await userEvent.type(screen.getByLabelText(/^user$/i), "newuser");

    expect(useJrdmStore.getState().connection.user).toBe("newuser");
  });

  it("sets deployState to deploying immediately on click", async () => {
    type DeployResult = {
      deployed: boolean;
      statements?: number;
      view?: string;
      errors?: unknown[];
    };
    let resolveDeployView!: (v: DeployResult) => void;
    vi.mocked(client.deployView).mockReturnValue(
      new Promise<DeployResult>((resolve) => {
        resolveDeployView = resolve;
      }),
    );

    useJrdmStore.getState().setEditingView(SAMPLE_VIEW);
    render(<DeployDialog />);

    await userEvent.click(screen.getByTestId("deploy-btn"));

    expect(useJrdmStore.getState().deployState).toBe("deploying");

    resolveDeployView({ deployed: true, statements: 1 });
    await waitFor(() => expect(useJrdmStore.getState().deployState).toBe("deployed"));
  });
});
