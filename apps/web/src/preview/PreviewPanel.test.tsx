import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PreviewPanel } from "./PreviewPanel";
import { useJrdmStore } from "../state/store";

// Mock all four sub-components so the test focuses on composition/layout
vi.mock("./DeployDialog", () => ({
  DeployDialog: () => <div data-testid="deploy-dialog-mock">DeployDialog</div>,
}));
vi.mock("./ResultsPane", () => ({
  ResultsPane: () => <div data-testid="results-pane-mock">ResultsPane</div>,
}));
vi.mock("./DocumentEditModal", () => ({
  DocumentEditModal: () => <div data-testid="document-edit-modal-mock">DocumentEditModal</div>,
}));
vi.mock("./ConflictBanner", () => ({
  ConflictBanner: () => <div data-testid="conflict-banner-mock">ConflictBanner</div>,
}));

describe("PreviewPanel", () => {
  beforeEach(() => useJrdmStore.getState().reset());

  it("renders the preview-panel wrapper", () => {
    render(<PreviewPanel />);
    expect(screen.getByTestId("preview-panel")).toBeInTheDocument();
  });

  it("renders ConflictBanner as first child (pinned at top)", () => {
    render(<PreviewPanel />);
    const panel = screen.getByTestId("preview-panel");
    const children = Array.from(panel.children);
    expect(children[0]).toHaveAttribute("data-testid", "conflict-banner-mock");
  });

  it("renders all four sub-components", () => {
    render(<PreviewPanel />);
    expect(screen.getByTestId("deploy-dialog-mock")).toBeInTheDocument();
    expect(screen.getByTestId("results-pane-mock")).toBeInTheDocument();
    expect(screen.getByTestId("document-edit-modal-mock")).toBeInTheDocument();
    expect(screen.getByTestId("conflict-banner-mock")).toBeInTheDocument();
  });
});
