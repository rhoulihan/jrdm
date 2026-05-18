import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Toolbar, type ConnectionStatus } from "./Toolbar";

function makeToolbarProps(overrides: Partial<Parameters<typeof Toolbar>[0]> = {}) {
  return {
    connection: "disconnected" as ConnectionStatus,
    onConnect: vi.fn(),
    onImport: vi.fn(),
    onDeploy: vi.fn(),
    onResetSplit: vi.fn(),
    onFit: vi.fn(),
    ...overrides,
  };
}

describe("Toolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Basic structure ──────────────────────────────────────────────────────

  it("renders with data-testid=toolbar", () => {
    render(<Toolbar {...makeToolbarProps()} />);
    expect(screen.getByTestId("toolbar")).toBeInTheDocument();
  });

  // ── Connection status chip ────────────────────────────────────────────────

  it("renders conn-status chip", () => {
    render(<Toolbar {...makeToolbarProps()} />);
    expect(screen.getByTestId("conn-status")).toBeInTheDocument();
  });

  it("conn-status shows disconnected state", () => {
    render(<Toolbar {...makeToolbarProps({ connection: "disconnected" })} />);
    const chip = screen.getByTestId("conn-status");
    expect(chip).toHaveAttribute("data-status", "disconnected");
  });

  it("conn-status shows connected state", () => {
    render(<Toolbar {...makeToolbarProps({ connection: "connected" })} />);
    const chip = screen.getByTestId("conn-status");
    expect(chip).toHaveAttribute("data-status", "connected");
  });

  it("conn-status shows error state", () => {
    render(<Toolbar {...makeToolbarProps({ connection: "error" })} />);
    const chip = screen.getByTestId("conn-status");
    expect(chip).toHaveAttribute("data-status", "error");
  });

  it("conn-status has aria-label reflecting its state", () => {
    render(<Toolbar {...makeToolbarProps({ connection: "connected" })} />);
    const chip = screen.getByTestId("conn-status");
    expect(chip).toHaveAttribute("aria-label", expect.stringContaining("connected"));
  });

  it("conn-status has aria-label reflecting disconnected", () => {
    render(<Toolbar {...makeToolbarProps({ connection: "disconnected" })} />);
    const chip = screen.getByTestId("conn-status");
    expect(chip).toHaveAttribute("aria-label", expect.stringContaining("disconnected"));
  });

  it("conn-status has aria-label reflecting error", () => {
    render(<Toolbar {...makeToolbarProps({ connection: "error" })} />);
    const chip = screen.getByTestId("conn-status");
    expect(chip).toHaveAttribute("aria-label", expect.stringContaining("error"));
  });

  // ── Action buttons ────────────────────────────────────────────────────────

  it("renders connect-btn", () => {
    render(<Toolbar {...makeToolbarProps()} />);
    expect(screen.getByTestId("connect-btn")).toBeInTheDocument();
  });

  it("renders import-btn", () => {
    render(<Toolbar {...makeToolbarProps()} />);
    expect(screen.getByTestId("import-btn")).toBeInTheDocument();
  });

  it("renders deploy-btn", () => {
    render(<Toolbar {...makeToolbarProps()} />);
    expect(screen.getByTestId("deploy-btn")).toBeInTheDocument();
  });

  it("connect-btn calls onConnect", () => {
    const onConnect = vi.fn();
    render(<Toolbar {...makeToolbarProps({ onConnect })} />);
    fireEvent.click(screen.getByTestId("connect-btn"));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("import-btn calls onImport", () => {
    const onImport = vi.fn();
    render(<Toolbar {...makeToolbarProps({ onImport })} />);
    fireEvent.click(screen.getByTestId("import-btn"));
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it("deploy-btn calls onDeploy", () => {
    const onDeploy = vi.fn();
    render(<Toolbar {...makeToolbarProps({ onDeploy })} />);
    fireEvent.click(screen.getByTestId("deploy-btn"));
    expect(onDeploy).toHaveBeenCalledTimes(1);
  });

  // ── Canvas/split controls ─────────────────────────────────────────────────

  it("renders reset-split-btn calling onResetSplit", () => {
    const onResetSplit = vi.fn();
    render(<Toolbar {...makeToolbarProps({ onResetSplit })} />);
    const btn = screen.getByTestId("reset-split-btn");
    fireEvent.click(btn);
    expect(onResetSplit).toHaveBeenCalledTimes(1);
  });

  it("renders fit-btn calling onFit", () => {
    const onFit = vi.fn();
    render(<Toolbar {...makeToolbarProps({ onFit })} />);
    const btn = screen.getByTestId("fit-btn");
    fireEvent.click(btn);
    expect(onFit).toHaveBeenCalledTimes(1);
  });

  // ── No store import ───────────────────────────────────────────────────────

  it("is pure/controlled with no store coupling", () => {
    expect(() => render(<Toolbar {...makeToolbarProps()} />)).not.toThrow();
  });
});
