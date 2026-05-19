// @tested-by: apps/web/src/diagram/ContextMenu.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ContextMenu } from "./ContextMenu";

const ITEMS = [
  { label: "Map to document…", onSelect: vi.fn(), disabled: false },
  { label: "New duality view from this table", onSelect: vi.fn() },
  {
    label: "Gated action",
    onSelect: vi.fn(),
    disabled: true,
    title: "Create a root view first",
  },
];

function renderMenu(overrides: Partial<Parameters<typeof ContextMenu>[0]> = {}) {
  const props = {
    open: true,
    x: 120,
    y: 200,
    items: ITEMS,
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<ContextMenu {...props} />), props };
}

describe("ContextMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Nothing rendered when closed ─────────────────────────────────────────

  it("renders nothing when open=false", () => {
    renderMenu({ open: false });
    expect(screen.queryByTestId("entity-context-menu")).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  // ── Basic structure when open ────────────────────────────────────────────

  it("renders a popover with role=menu when open=true", () => {
    renderMenu();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("has data-testid=entity-context-menu", () => {
    renderMenu();
    expect(screen.getByTestId("entity-context-menu")).toBeInTheDocument();
  });

  it("is positioned fixed at the given (x, y)", () => {
    renderMenu({ x: 150, y: 300 });
    const menu = screen.getByTestId("entity-context-menu");
    expect(menu).toHaveStyle({ position: "fixed", left: "150px", top: "300px" });
  });

  // ── Items rendered ───────────────────────────────────────────────────────

  it("renders each item as role=menuitem", () => {
    renderMenu();
    const menu = screen.getByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items).toHaveLength(ITEMS.length);
  });

  it("each item has data-testid=ctxitem-<label-slug>", () => {
    renderMenu();
    // "Map to document…" → "map-to-document"
    expect(screen.getByTestId("ctxitem-map-to-document")).toBeInTheDocument();
    // "New duality view from this table" → "new-duality-view-from-this-table"
    expect(screen.getByTestId("ctxitem-new-duality-view-from-this-table")).toBeInTheDocument();
    // "Gated action" → "gated-action"
    expect(screen.getByTestId("ctxitem-gated-action")).toBeInTheDocument();
  });

  // ── Enabled item click ───────────────────────────────────────────────────

  it("clicking an enabled item calls its onSelect then onClose", () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    renderMenu({
      onClose,
      items: [{ label: "Do something", onSelect }],
    });
    fireEvent.click(screen.getByTestId("ctxitem-do-something"));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("onSelect is called before onClose", () => {
    const callOrder: string[] = [];
    const onClose = vi.fn(() => callOrder.push("close"));
    const onSelect = vi.fn(() => callOrder.push("select"));
    renderMenu({
      onClose,
      items: [{ label: "Action", onSelect }],
    });
    fireEvent.click(screen.getByTestId("ctxitem-action"));
    expect(callOrder).toEqual(["select", "close"]);
  });

  // ── Disabled item ────────────────────────────────────────────────────────

  it("disabled item has aria-disabled=true", () => {
    renderMenu();
    const disabledItem = screen.getByTestId("ctxitem-gated-action");
    expect(disabledItem).toHaveAttribute("aria-disabled", "true");
  });

  it("disabled item renders its title as tooltip (title attr)", () => {
    renderMenu();
    const disabledItem = screen.getByTestId("ctxitem-gated-action");
    expect(disabledItem).toHaveAttribute("title", "Create a root view first");
  });

  it("clicking a disabled item does NOT call onSelect", () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    renderMenu({
      onClose,
      items: [
        {
          label: "Gated",
          onSelect,
          disabled: true,
          title: "Not yet",
        },
      ],
    });
    fireEvent.click(screen.getByTestId("ctxitem-gated"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("clicking a disabled item does NOT call onClose", () => {
    const onClose = vi.fn();
    renderMenu({
      onClose,
      items: [{ label: "Blocked", onSelect: vi.fn(), disabled: true }],
    });
    fireEvent.click(screen.getByTestId("ctxitem-blocked"));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Escape closes ────────────────────────────────────────────────────────

  it("Escape key calls onClose", () => {
    const onClose = vi.fn();
    renderMenu({ onClose });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  // ── Outside/overlay click closes ─────────────────────────────────────────

  it("clicking the overlay calls onClose", () => {
    const onClose = vi.fn();
    renderMenu({ onClose });
    const overlay = screen.getByTestId("ctx-overlay");
    fireEvent.mouseDown(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  // ── Focus management ─────────────────────────────────────────────────────

  it("focuses the first enabled item when the menu opens", () => {
    // First item is enabled, so it should receive focus
    renderMenu({
      items: [
        { label: "First enabled", onSelect: vi.fn() },
        { label: "Second item", onSelect: vi.fn() },
      ],
    });
    expect(document.activeElement).toBe(screen.getByTestId("ctxitem-first-enabled"));
  });

  it("focuses the first ENABLED item when first item is disabled", () => {
    renderMenu({
      items: [
        { label: "Disabled first", onSelect: vi.fn(), disabled: true },
        { label: "Enabled second", onSelect: vi.fn() },
      ],
    });
    expect(document.activeElement).toBe(screen.getByTestId("ctxitem-enabled-second"));
  });

  // ── Keyboard navigation ──────────────────────────────────────────────────

  it("ArrowDown moves focus to the next enabled item", () => {
    renderMenu({
      items: [
        { label: "Item one", onSelect: vi.fn() },
        { label: "Item two", onSelect: vi.fn() },
      ],
    });
    const itemOne = screen.getByTestId("ctxitem-item-one");
    const itemTwo = screen.getByTestId("ctxitem-item-two");
    itemOne.focus();
    fireEvent.keyDown(itemOne, { key: "ArrowDown" });
    expect(document.activeElement).toBe(itemTwo);
  });

  it("ArrowUp moves focus to the previous enabled item", () => {
    renderMenu({
      items: [
        { label: "Item one", onSelect: vi.fn() },
        { label: "Item two", onSelect: vi.fn() },
      ],
    });
    const itemOne = screen.getByTestId("ctxitem-item-one");
    const itemTwo = screen.getByTestId("ctxitem-item-two");
    itemTwo.focus();
    fireEvent.keyDown(itemTwo, { key: "ArrowUp" });
    expect(document.activeElement).toBe(itemOne);
  });

  it("ArrowDown skips disabled items", () => {
    renderMenu({
      items: [
        { label: "First", onSelect: vi.fn() },
        { label: "Skipped", onSelect: vi.fn(), disabled: true },
        { label: "Third", onSelect: vi.fn() },
      ],
    });
    const first = screen.getByTestId("ctxitem-first");
    const third = screen.getByTestId("ctxitem-third");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(third);
  });

  it("Enter activates the focused item", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderMenu({
      onClose,
      items: [{ label: "Enter action", onSelect }],
    });
    const item = screen.getByTestId("ctxitem-enter-action");
    item.focus();
    fireEvent.keyDown(item, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Space activates the focused item", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderMenu({
      onClose,
      items: [{ label: "Space action", onSelect }],
    });
    const item = screen.getByTestId("ctxitem-space-action");
    item.focus();
    fireEvent.keyDown(item, { key: " " });
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  // ── Pure / no store ──────────────────────────────────────────────────────

  it("renders without a store provider (pure presentational component)", () => {
    expect(() =>
      render(
        <ContextMenu
          open={true}
          x={0}
          y={0}
          items={[{ label: "Test", onSelect: vi.fn() }]}
          onClose={vi.fn()}
        />,
      ),
    ).not.toThrow();
  });
});
