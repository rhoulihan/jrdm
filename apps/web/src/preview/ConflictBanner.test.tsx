import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConflictBanner } from "./ConflictBanner";
import { useJrdmStore } from "../state/store";

describe("ConflictBanner", () => {
  beforeEach(() => {
    useJrdmStore.getState().reset();
    vi.clearAllMocks();
  });

  it("does not render when store.conflict is null", () => {
    render(<ConflictBanner />);
    expect(screen.queryByTestId("conflict-banner")).not.toBeInTheDocument();
  });

  it("renders conflict-banner when store.conflict is truthy", () => {
    useJrdmStore.getState().setConflict({ message: "ORA-42699: etag mismatch" });
    render(<ConflictBanner />);
    expect(screen.getByTestId("conflict-banner")).toBeInTheDocument();
  });

  it("displays the conflict message from store.conflict", () => {
    useJrdmStore.getState().setConflict({ message: "ORA-42699: etag mismatch on view orders_dv" });
    render(<ConflictBanner />);
    expect(screen.getByTestId("conflict-banner")).toHaveTextContent(
      "ORA-42699: etag mismatch on view orders_dv",
    );
  });

  it("calls setConflict(null) when Dismiss is clicked", async () => {
    useJrdmStore.getState().setConflict({ message: "ORA-42699: conflict" });
    render(<ConflictBanner />);

    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(useJrdmStore.getState().conflict).toBeNull();
  });

  it("removes the banner from DOM after Dismiss is clicked", async () => {
    useJrdmStore.getState().setConflict({ message: "ORA-42699: conflict" });
    render(<ConflictBanner />);

    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(screen.queryByTestId("conflict-banner")).not.toBeInTheDocument();
  });
});
