import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SplitPane } from "./SplitPane";

// Helper: create controlled wrapper
function makeSplitPane(overrides: Partial<Parameters<typeof SplitPane>[0]> = {}) {
  const defaults = {
    left: <div>Left content</div>,
    right: <div>Right content</div>,
    ratio: 0.5,
    onRatioChange: vi.fn(),
    onCollapsedChange: vi.fn(),
    minRatio: 0.15,
    collapsed: null as "left" | "right" | null,
    ...overrides,
  };
  return defaults;
}

describe("SplitPane", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Renders both children ─────────────────────────────────────────────────

  it("renders left child content", () => {
    const props = makeSplitPane();
    render(<SplitPane {...props} />);
    expect(screen.getByText("Left content")).toBeInTheDocument();
  });

  it("renders right child content", () => {
    const props = makeSplitPane();
    render(<SplitPane {...props} />);
    expect(screen.getByText("Right content")).toBeInTheDocument();
  });

  // ── Divider accessibility ─────────────────────────────────────────────────

  it("divider has role=separator", () => {
    const props = makeSplitPane({ ratio: 0.4 });
    render(<SplitPane {...props} />);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("divider has aria-orientation=vertical", () => {
    const props = makeSplitPane();
    render(<SplitPane {...props} />);
    const sep = screen.getByRole("separator");
    expect(sep).toHaveAttribute("aria-orientation", "vertical");
  });

  it("divider aria-valuenow reflects ratio*100 rounded", () => {
    const props = makeSplitPane({ ratio: 0.4 });
    render(<SplitPane {...props} />);
    const sep = screen.getByRole("separator");
    expect(sep).toHaveAttribute("aria-valuenow", "40");
  });

  it("divider is focusable (tabIndex=0)", () => {
    const props = makeSplitPane();
    render(<SplitPane {...props} />);
    const sep = screen.getByRole("separator");
    expect(sep).toHaveAttribute("tabindex", "0");
  });

  // ── Collapse chevron buttons ──────────────────────────────────────────────

  it("renders collapse-left and collapse-right buttons", () => {
    const props = makeSplitPane();
    render(<SplitPane {...props} />);
    expect(screen.getByTestId("collapse-left")).toBeInTheDocument();
    expect(screen.getByTestId("collapse-right")).toBeInTheDocument();
  });

  it("collapse-left button calls onCollapsedChange('left')", () => {
    const onCollapsedChange = vi.fn();
    const props = makeSplitPane({ onCollapsedChange });
    render(<SplitPane {...props} />);
    fireEvent.click(screen.getByTestId("collapse-left"));
    expect(onCollapsedChange).toHaveBeenCalledWith("left");
  });

  it("collapse-right button calls onCollapsedChange('right')", () => {
    const onCollapsedChange = vi.fn();
    const props = makeSplitPane({ onCollapsedChange });
    render(<SplitPane {...props} />);
    fireEvent.click(screen.getByTestId("collapse-right"));
    expect(onCollapsedChange).toHaveBeenCalledWith("right");
  });

  // ── Collapsed state ───────────────────────────────────────────────────────

  it("when collapsed='left', shows restore control with testid restore-left", () => {
    const props = makeSplitPane({ collapsed: "left" });
    render(<SplitPane {...props} />);
    expect(screen.getByTestId("restore-left")).toBeInTheDocument();
  });

  it("when collapsed='right', shows restore control with testid restore-right", () => {
    const props = makeSplitPane({ collapsed: "right" });
    render(<SplitPane {...props} />);
    expect(screen.getByTestId("restore-right")).toBeInTheDocument();
  });

  it("clicking restore-left calls onCollapsedChange(null)", () => {
    const onCollapsedChange = vi.fn();
    const props = makeSplitPane({ collapsed: "left", onCollapsedChange });
    render(<SplitPane {...props} />);
    fireEvent.click(screen.getByTestId("restore-left"));
    expect(onCollapsedChange).toHaveBeenCalledWith(null);
  });

  it("clicking restore-right calls onCollapsedChange(null)", () => {
    const onCollapsedChange = vi.fn();
    const props = makeSplitPane({ collapsed: "right", onCollapsedChange });
    render(<SplitPane {...props} />);
    fireEvent.click(screen.getByTestId("restore-right"));
    expect(onCollapsedChange).toHaveBeenCalledWith(null);
  });

  it("when collapsed='left', left content is still in the DOM (thin rail)", () => {
    const props = makeSplitPane({ collapsed: "left" });
    render(<SplitPane {...props} />);
    expect(screen.getByText("Left content")).toBeInTheDocument();
  });

  it("when collapsed='right', right content is still in the DOM (thin rail)", () => {
    const props = makeSplitPane({ collapsed: "right" });
    render(<SplitPane {...props} />);
    expect(screen.getByText("Right content")).toBeInTheDocument();
  });

  // ── Double-click resets ratio to 0.5 ─────────────────────────────────────

  it("double-click on divider calls onRatioChange(0.5)", () => {
    const onRatioChange = vi.fn();
    const props = makeSplitPane({ onRatioChange, ratio: 0.3 });
    render(<SplitPane {...props} />);
    const sep = screen.getByRole("separator");
    fireEvent.dblClick(sep);
    expect(onRatioChange).toHaveBeenCalledWith(0.5);
  });

  // ── Keyboard interactions ─────────────────────────────────────────────────

  it("ArrowRight on divider nudges ratio up by a step", () => {
    const onRatioChange = vi.fn();
    const props = makeSplitPane({ onRatioChange, ratio: 0.5 });
    render(<SplitPane {...props} />);
    const sep = screen.getByRole("separator");
    fireEvent.keyDown(sep, { key: "ArrowRight" });
    expect(onRatioChange).toHaveBeenCalledWith(expect.any(Number));
    const newRatio = onRatioChange.mock.calls[0]![0] as number;
    expect(newRatio).toBeGreaterThan(0.5);
  });

  it("ArrowLeft on divider nudges ratio down by a step", () => {
    const onRatioChange = vi.fn();
    const props = makeSplitPane({ onRatioChange, ratio: 0.5 });
    render(<SplitPane {...props} />);
    const sep = screen.getByRole("separator");
    fireEvent.keyDown(sep, { key: "ArrowLeft" });
    expect(onRatioChange).toHaveBeenCalledWith(expect.any(Number));
    const newRatio = onRatioChange.mock.calls[0]![0] as number;
    expect(newRatio).toBeLessThan(0.5);
  });

  it("ArrowRight clamps at 1 - minRatio", () => {
    const onRatioChange = vi.fn();
    const props = makeSplitPane({ onRatioChange, ratio: 0.84, minRatio: 0.15 });
    render(<SplitPane {...props} />);
    const sep = screen.getByRole("separator");
    fireEvent.keyDown(sep, { key: "ArrowRight" });
    const newRatio = onRatioChange.mock.calls[0]![0] as number;
    expect(newRatio).toBeLessThanOrEqual(0.85);
  });

  it("ArrowLeft clamps at minRatio", () => {
    const onRatioChange = vi.fn();
    const props = makeSplitPane({ onRatioChange, ratio: 0.16, minRatio: 0.15 });
    render(<SplitPane {...props} />);
    const sep = screen.getByRole("separator");
    fireEvent.keyDown(sep, { key: "ArrowLeft" });
    const newRatio = onRatioChange.mock.calls[0]![0] as number;
    expect(newRatio).toBeGreaterThanOrEqual(0.15);
  });

  it("Home key calls onCollapsedChange('left')", () => {
    const onCollapsedChange = vi.fn();
    const props = makeSplitPane({ onCollapsedChange });
    render(<SplitPane {...props} />);
    const sep = screen.getByRole("separator");
    fireEvent.keyDown(sep, { key: "Home" });
    expect(onCollapsedChange).toHaveBeenCalledWith("left");
  });

  it("End key calls onCollapsedChange('right')", () => {
    const onCollapsedChange = vi.fn();
    const props = makeSplitPane({ onCollapsedChange });
    render(<SplitPane {...props} />);
    const sep = screen.getByRole("separator");
    fireEvent.keyDown(sep, { key: "End" });
    expect(onCollapsedChange).toHaveBeenCalledWith("right");
  });

  // ── Pointer drag ──────────────────────────────────────────────────────────

  it("pointer drag calls onRatioChange with clamped value", () => {
    const onRatioChange = vi.fn();
    const props = makeSplitPane({ onRatioChange, ratio: 0.5, minRatio: 0.15 });
    const { container } = render(<SplitPane {...props} />);

    // Stub the container's getBoundingClientRect so we know total width = 1000px
    const outerEl = container.firstElementChild as HTMLElement;
    vi.spyOn(outerEl, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 800,
      width: 1000,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const sep = screen.getByRole("separator");

    // Drag: start at x=500, move to x=300 → ratio should be 0.3
    fireEvent.pointerDown(sep, { clientX: 500, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 300, clientY: 400, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 300, clientY: 400, pointerId: 1 });

    expect(onRatioChange).toHaveBeenCalledWith(expect.any(Number));
    const call = onRatioChange.mock.calls[onRatioChange.mock.calls.length - 1]![0] as number;
    expect(call).toBeGreaterThanOrEqual(0.15);
    expect(call).toBeLessThanOrEqual(0.85);
    // Moving left from center should reduce ratio
    expect(call).toBeLessThan(0.5);
  });

  it("pointer drag clamps to minRatio at the low end", () => {
    const onRatioChange = vi.fn();
    const props = makeSplitPane({ onRatioChange, ratio: 0.5, minRatio: 0.15 });
    const { container } = render(<SplitPane {...props} />);

    const outerEl = container.firstElementChild as HTMLElement;
    vi.spyOn(outerEl, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 800,
      width: 1000,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const sep = screen.getByRole("separator");

    // Drag all the way to x=0 — should clamp at minRatio
    fireEvent.pointerDown(sep, { clientX: 500, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 0, clientY: 400, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 0, clientY: 400, pointerId: 1 });

    const calls = onRatioChange.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1]![0] as number;
    expect(lastCall).toBeGreaterThanOrEqual(0.15);
  });

  it("pointer drag clamps to 1-minRatio at the high end", () => {
    const onRatioChange = vi.fn();
    const props = makeSplitPane({ onRatioChange, ratio: 0.5, minRatio: 0.15 });
    const { container } = render(<SplitPane {...props} />);

    const outerEl = container.firstElementChild as HTMLElement;
    vi.spyOn(outerEl, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 800,
      width: 1000,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const sep = screen.getByRole("separator");

    // Drag all the way to x=1000 — should clamp at 1-minRatio
    fireEvent.pointerDown(sep, { clientX: 500, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 1000, clientY: 400, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 1000, clientY: 400, pointerId: 1 });

    const calls = onRatioChange.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1]![0] as number;
    expect(lastCall).toBeLessThanOrEqual(0.85);
  });

  // ── No store import ───────────────────────────────────────────────────────

  it("is a pure presentational component with no store coupling (renders without store provider)", () => {
    // If SplitPane imports the store, it would throw or produce unexpected behavior
    // without a store provider. A pure component should render fine.
    const props = makeSplitPane();
    expect(() => render(<SplitPane {...props} />)).not.toThrow();
  });
});
