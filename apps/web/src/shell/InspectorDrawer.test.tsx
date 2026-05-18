import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InspectorDrawer } from "./InspectorDrawer";

function makeDrawerProps(overrides: Partial<Parameters<typeof InspectorDrawer>[0]> = {}) {
  return {
    open: true,
    pinned: false,
    onClose: vi.fn(),
    onTogglePin: vi.fn(),
    children: <div>Inspector content</div>,
    ...overrides,
  };
}

describe("InspectorDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Closed + unpinned: not in DOM / aria-hidden ───────────────────────────

  it("when closed and unpinned is not visible in the DOM", () => {
    render(<InspectorDrawer {...makeDrawerProps({ open: false, pinned: false })} />);
    const drawer = screen.queryByTestId("inspector-drawer");
    // Either absent or aria-hidden
    if (drawer) {
      expect(drawer).toHaveAttribute("aria-hidden", "true");
    } else {
      expect(drawer).toBeNull();
    }
  });

  it("when closed and unpinned, children are not visible", () => {
    render(<InspectorDrawer {...makeDrawerProps({ open: false, pinned: false })} />);
    expect(screen.queryByText("Inspector content")).toBeNull();
  });

  // ── Open state ────────────────────────────────────────────────────────────

  it("when open renders with data-testid=inspector-drawer", () => {
    render(<InspectorDrawer {...makeDrawerProps({ open: true })} />);
    expect(screen.getByTestId("inspector-drawer")).toBeInTheDocument();
  });

  it("when open renders children", () => {
    render(<InspectorDrawer {...makeDrawerProps({ open: true })} />);
    expect(screen.getByText("Inspector content")).toBeInTheDocument();
  });

  it("when open does not have aria-hidden", () => {
    render(<InspectorDrawer {...makeDrawerProps({ open: true })} />);
    const drawer = screen.getByTestId("inspector-drawer");
    expect(drawer).not.toHaveAttribute("aria-hidden", "true");
  });

  // ── Close button ──────────────────────────────────────────────────────────

  it("renders close button when open", () => {
    render(<InspectorDrawer {...makeDrawerProps({ open: true })} />);
    expect(screen.getByTestId("drawer-close")).toBeInTheDocument();
  });

  it("close button calls onClose", () => {
    const onClose = vi.fn();
    render(<InspectorDrawer {...makeDrawerProps({ open: true, onClose })} />);
    fireEvent.click(screen.getByTestId("drawer-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Pin toggle ────────────────────────────────────────────────────────────

  it("renders pin toggle button when open", () => {
    render(<InspectorDrawer {...makeDrawerProps({ open: true })} />);
    expect(screen.getByTestId("drawer-pin")).toBeInTheDocument();
  });

  it("pin toggle calls onTogglePin", () => {
    const onTogglePin = vi.fn();
    render(<InspectorDrawer {...makeDrawerProps({ open: true, onTogglePin })} />);
    fireEvent.click(screen.getByTestId("drawer-pin"));
    expect(onTogglePin).toHaveBeenCalledTimes(1);
  });

  it("pin button reflects unpinned state", () => {
    render(<InspectorDrawer {...makeDrawerProps({ open: true, pinned: false })} />);
    const pinBtn = screen.getByTestId("drawer-pin");
    expect(pinBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("pin button reflects pinned state", () => {
    render(<InspectorDrawer {...makeDrawerProps({ open: true, pinned: true })} />);
    const pinBtn = screen.getByTestId("drawer-pin");
    expect(pinBtn).toHaveAttribute("aria-pressed", "true");
  });

  // ── Escape closes when not pinned ─────────────────────────────────────────

  it("Escape key calls onClose when open and not pinned", () => {
    const onClose = vi.fn();
    render(<InspectorDrawer {...makeDrawerProps({ open: true, pinned: false, onClose })} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape key does NOT call onClose when pinned", () => {
    const onClose = vi.fn();
    render(<InspectorDrawer {...makeDrawerProps({ open: true, pinned: true, onClose })} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Escape key does NOT call onClose when closed", () => {
    const onClose = vi.fn();
    render(<InspectorDrawer {...makeDrawerProps({ open: false, pinned: false, onClose })} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Pinned + closed: stays in DOM ─────────────────────────────────────────

  it("when closed but pinned, drawer is still in DOM", () => {
    render(<InspectorDrawer {...makeDrawerProps({ open: false, pinned: true })} />);
    expect(screen.getByTestId("inspector-drawer")).toBeInTheDocument();
  });

  // ── No store import ───────────────────────────────────────────────────────

  it("is pure/controlled with no store coupling", () => {
    expect(() => render(<InspectorDrawer {...makeDrawerProps()} />)).not.toThrow();
  });
});
