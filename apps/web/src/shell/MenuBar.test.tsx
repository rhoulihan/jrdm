import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MenuBar, type MenuBarItem } from "./MenuBar";

function makeItems(overrides: Partial<MenuBarItem>[] = []): MenuBarItem[] {
  return [
    {
      id: "project",
      label: "Project",
      children: [
        { id: "new", label: "New", onSelect: vi.fn() },
        { id: "open", label: "Open", onSelect: vi.fn() },
      ],
      ...overrides[0],
    },
    {
      id: "connection",
      label: "Connection",
      children: [{ id: "connect", label: "Connect…", onSelect: vi.fn() }],
      ...overrides[1],
    },
  ];
}

describe("MenuBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Basic structure ──────────────────────────────────────────────────────

  it("renders with data-testid=menubar", () => {
    render(<MenuBar items={makeItems()} />);
    expect(screen.getByTestId("menubar")).toBeInTheDocument();
  });

  it("has role=menubar", () => {
    render(<MenuBar items={makeItems()} />);
    expect(screen.getByRole("menubar")).toBeInTheDocument();
  });

  it("renders top-level items as role=menuitem buttons", () => {
    render(<MenuBar items={makeItems()} />);
    const menubar = screen.getByRole("menubar");
    const items = within(menubar).getAllByRole("menuitem");
    expect(items).toHaveLength(2);
  });

  it("renders top-level labels", () => {
    render(<MenuBar items={makeItems()} />);
    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("Connection")).toBeInTheDocument();
  });

  // ── Submenu closed by default ────────────────────────────────────────────

  it("submenu is not visible initially", () => {
    render(<MenuBar items={makeItems()} />);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("clicking a top-level item opens its submenu (role=menu)", () => {
    render(<MenuBar items={makeItems()} />);
    fireEvent.click(screen.getByText("Project"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("open submenu contains its children as role=menuitem", () => {
    render(<MenuBar items={makeItems()} />);
    fireEvent.click(screen.getByText("Project"));
    const menu = screen.getByRole("menu");
    const children = within(menu).getAllByRole("menuitem");
    expect(children).toHaveLength(2);
    expect(within(menu).getByText("New")).toBeInTheDocument();
    expect(within(menu).getByText("Open")).toBeInTheDocument();
  });

  it("clicking a submenu item invokes its onSelect callback", () => {
    const items = makeItems();
    render(<MenuBar items={items} />);
    fireEvent.click(screen.getByText("Project"));
    const newItem = screen.getByText("New");
    fireEvent.click(newItem);
    expect(items[0]!.children![0]!.onSelect).toHaveBeenCalledTimes(1);
  });

  it("clicking a submenu item closes the menu", () => {
    render(<MenuBar items={makeItems()} />);
    fireEvent.click(screen.getByText("Project"));
    fireEvent.click(screen.getByText("New"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  // ── Keyboard: Escape closes menu ──────────────────────────────────────────

  it("Escape key closes open submenu", () => {
    render(<MenuBar items={makeItems()} />);
    fireEvent.click(screen.getByText("Project"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  // ── Keyboard: ArrowDown moves focus into menu ─────────────────────────────

  it("ArrowDown on open top-level menuitem focuses first child", () => {
    render(<MenuBar items={makeItems()} />);
    const projectBtn = screen.getByText("Project");
    fireEvent.click(projectBtn);
    // Menu is open; ArrowDown on the trigger should move focus to first menuitem
    fireEvent.keyDown(projectBtn, { key: "ArrowDown" });
    const menu = screen.getByRole("menu");
    const firstChild = within(menu).getAllByRole("menuitem")[0]!;
    expect(document.activeElement).toBe(firstChild);
  });

  // ── Clicking elsewhere closes menu ───────────────────────────────────────

  it("clicking outside the menubar closes an open menu", () => {
    const { container } = render(
      <div>
        <MenuBar items={makeItems()} />
        <button type="button" data-testid="outside">
          Outside
        </button>
      </div>,
    );
    fireEvent.click(screen.getByText("Project"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.mouseDown(container);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  // ── No store import ───────────────────────────────────────────────────────

  it("is pure/controlled with no store coupling", () => {
    expect(() => render(<MenuBar items={makeItems()} />)).not.toThrow();
  });
});
