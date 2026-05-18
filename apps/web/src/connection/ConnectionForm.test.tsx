import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectionForm } from "./ConnectionForm";
import { useJrdmStore } from "../state/store";
vi.mock("../api/client", () => ({
  listSchemas: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
}));

import { listSchemas, ApiError } from "../api/client";
const mockListSchemas = vi.mocked(listSchemas);

describe("ConnectionForm", () => {
  beforeEach(() => {
    useJrdmStore.getState().reset();
    vi.clearAllMocks();
  });

  /** Helper: fill in the three connection fields */
  async function fillConnection() {
    await userEvent.type(screen.getByLabelText(/^user$/i), "scott");
    await userEvent.type(screen.getByLabelText(/^password$/i), "tiger");
    await userEvent.type(screen.getByLabelText(/connect string/i), "h:1521/FREEPDB1");
  }

  // ──────────────────────────────────────────────────────────────────────
  // Connect button disabled states
  // ──────────────────────────────────────────────────────────────────────

  it("Connect button is disabled when connection fields are empty", () => {
    render(<ConnectionForm onSubmit={vi.fn()} busy={false} />);
    expect(screen.getByTestId("connect-btn")).toBeDisabled();
  });

  it("Connect button is enabled once user/password/connectString are filled", async () => {
    render(<ConnectionForm onSubmit={vi.fn()} busy={false} />);
    await fillConnection();
    expect(screen.getByTestId("connect-btn")).toBeEnabled();
  });

  it("Connect button is disabled while schemaLoad is 'loading'", async () => {
    // Set up listSchemas to never resolve (simulates in-flight)
    mockListSchemas.mockReturnValue(new Promise(() => {}));
    render(<ConnectionForm onSubmit={vi.fn()} busy={false} />);
    await fillConnection();
    await userEvent.click(screen.getByTestId("connect-btn"));
    expect(screen.getByTestId("connect-btn")).toBeDisabled();
  });

  // ──────────────────────────────────────────────────────────────────────
  // Connect → populates schema select
  // ──────────────────────────────────────────────────────────────────────

  it("clicking Connect calls listSchemas and populates the schema select with results", async () => {
    mockListSchemas.mockResolvedValue(["APP", "SALES", "HR"]);
    render(<ConnectionForm onSubmit={vi.fn()} busy={false} />);
    await fillConnection();
    await userEvent.click(screen.getByTestId("connect-btn"));

    await waitFor(() => {
      expect(mockListSchemas).toHaveBeenCalledWith({
        user: "scott",
        password: "tiger",
        connectString: "h:1521/FREEPDB1",
      });
    });

    await waitFor(() => {
      const optionEls = screen.getByTestId("schema-select").querySelectorAll("option");
      const options = Array.from(optionEls).map((o) => o.value);
      expect(options).toEqual(["APP", "SALES", "HR"]);
    });
  });

  it("auto-selects the first schema returned by listSchemas", async () => {
    mockListSchemas.mockResolvedValue(["APP", "SALES"]);
    render(<ConnectionForm onSubmit={vi.fn()} busy={false} />);
    await fillConnection();
    await userEvent.click(screen.getByTestId("connect-btn"));

    await waitFor(() => {
      expect(screen.getByLabelText(/schema/i)).toHaveValue("APP");
    });
    expect(useJrdmStore.getState().selectedSchema).toBe("APP");
  });

  it("sets schemaLoad to 'loading' then back to 'idle' on success", async () => {
    let resolve: (v: string[]) => void = () => {};
    mockListSchemas.mockReturnValue(
      new Promise<string[]>((r) => {
        resolve = r;
      }),
    );
    render(<ConnectionForm onSubmit={vi.fn()} busy={false} />);
    await fillConnection();
    await userEvent.click(screen.getByTestId("connect-btn"));

    expect(useJrdmStore.getState().schemaLoad).toBe("loading");

    resolve(["APP"]);
    await waitFor(() => expect(useJrdmStore.getState().schemaLoad).toBe("idle"));
  });

  // ──────────────────────────────────────────────────────────────────────
  // Connect → error path
  // ──────────────────────────────────────────────────────────────────────

  it("shows connect-error message and sets schemaLoad to 'error' on ApiError", async () => {
    mockListSchemas.mockRejectedValue(new ApiError(502, "Oracle connection refused"));
    render(<ConnectionForm onSubmit={vi.fn()} busy={false} />);
    await fillConnection();
    await userEvent.click(screen.getByTestId("connect-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("connect-error")).toHaveTextContent("Oracle connection refused");
    });
    expect(useJrdmStore.getState().schemaLoad).toBe("error");
  });

  it("Import button is disabled when connect-error occurred (no schema selected)", async () => {
    mockListSchemas.mockRejectedValue(new ApiError(500, "fail"));
    render(<ConnectionForm onSubmit={vi.fn()} busy={false} />);
    await fillConnection();
    await userEvent.click(screen.getByTestId("connect-btn"));

    await waitFor(() => screen.getByTestId("connect-error"));
    expect(screen.getByRole("button", { name: /import/i })).toBeDisabled();
  });

  // ──────────────────────────────────────────────────────────────────────
  // Schema select — free-text Schema Owner field is gone
  // ──────────────────────────────────────────────────────────────────────

  it("renders a labelled schema-select dropdown, not a free-text Schema Owner input", () => {
    render(<ConnectionForm onSubmit={vi.fn()} busy={false} />);
    // Select must exist
    expect(screen.getByTestId("schema-select")).toBeInTheDocument();
    // The old free-text field must NOT exist
    expect(screen.queryByLabelText(/schema owner/i)).toBeNull();
  });

  it("schema-select has an accessible label", () => {
    render(<ConnectionForm onSubmit={vi.fn()} busy={false} />);
    // getByLabelText finds the select by its associated label
    expect(screen.getByLabelText(/schema/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/schema/i).tagName).toBe("SELECT");
  });

  // ──────────────────────────────────────────────────────────────────────
  // Import button gating and submit
  // ──────────────────────────────────────────────────────────────────────

  it("Import button is disabled until a schema is selected", async () => {
    mockListSchemas.mockResolvedValue(["APP"]);
    render(<ConnectionForm onSubmit={vi.fn()} busy={false} />);

    // Before Connect — no schema selected
    expect(screen.getByRole("button", { name: /import/i })).toBeDisabled();

    await fillConnection();
    // Still disabled — schema not yet selected
    expect(screen.getByRole("button", { name: /import/i })).toBeDisabled();

    await userEvent.click(screen.getByTestId("connect-btn"));
    await waitFor(() => expect(useJrdmStore.getState().selectedSchema).toBe("APP"));

    expect(screen.getByRole("button", { name: /import/i })).toBeEnabled();
  });

  it("submitting calls onSubmit with selectedSchema as schemaOwner and writes to the store", async () => {
    mockListSchemas.mockResolvedValue(["APP", "SALES"]);
    const onSubmit = vi.fn();
    render(<ConnectionForm onSubmit={onSubmit} busy={false} />);

    await fillConnection();
    await userEvent.click(screen.getByTestId("connect-btn"));

    await waitFor(() => expect(useJrdmStore.getState().selectedSchema).toBe("APP"));

    // Pick a different schema
    await userEvent.selectOptions(screen.getByTestId("schema-select"), "SALES");
    await waitFor(() => expect(useJrdmStore.getState().selectedSchema).toBe("SALES"));

    await userEvent.click(screen.getByRole("button", { name: /import/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      connection: { user: "scott", password: "tiger", connectString: "h:1521/FREEPDB1" },
      schemaOwner: "SALES",
      projectName: "imported",
    });
    expect(useJrdmStore.getState().connection.user).toBe("scott");
  });

  it("shows a busy state and disables the Import button when busy", () => {
    render(<ConnectionForm onSubmit={vi.fn()} busy={true} />);
    expect(screen.getByRole("button", { name: /importing/i })).toBeDisabled();
  });
});
