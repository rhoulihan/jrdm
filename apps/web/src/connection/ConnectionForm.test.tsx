import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectionForm } from "./ConnectionForm";
import { useJrdmStore } from "../state/store";

describe("ConnectionForm", () => {
  beforeEach(() => useJrdmStore.getState().reset());

  it("disables Import until required fields are filled", async () => {
    render(<ConnectionForm onSubmit={vi.fn()} busy={false} />);
    const btn = screen.getByRole("button", { name: /import/i });
    expect(btn).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/^user$/i), "scott");
    await userEvent.type(screen.getByLabelText(/^password$/i), "tiger");
    await userEvent.type(screen.getByLabelText(/connect string/i), "h:1521/FREEPDB1");
    await userEvent.type(screen.getByLabelText(/schema owner/i), "APP");
    expect(btn).toBeEnabled();
  });

  it("calls onSubmit with the connection payload and writes to the store", async () => {
    const onSubmit = vi.fn();
    render(<ConnectionForm onSubmit={onSubmit} busy={false} />);
    await userEvent.type(screen.getByLabelText(/^user$/i), "scott");
    await userEvent.type(screen.getByLabelText(/^password$/i), "tiger");
    await userEvent.type(screen.getByLabelText(/connect string/i), "h:1521/FREEPDB1");
    await userEvent.type(screen.getByLabelText(/schema owner/i), "APP");
    await userEvent.click(screen.getByRole("button", { name: /import/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      connection: { user: "scott", password: "tiger", connectString: "h:1521/FREEPDB1" },
      schemaOwner: "APP",
      projectName: "imported",
    });
    expect(useJrdmStore.getState().connection.user).toBe("scott");
  });

  it("shows a busy state and disables the button when busy", () => {
    render(<ConnectionForm onSubmit={vi.fn()} busy={true} />);
    expect(screen.getByRole("button", { name: /importing/i })).toBeDisabled();
  });
});
