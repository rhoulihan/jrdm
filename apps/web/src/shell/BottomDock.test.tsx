import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BottomDock, type DockTab } from "./BottomDock";

function makeTabs(): DockTab[] {
  return [
    { id: "ddl", label: "DDL", node: <div>DDL content</div> },
    { id: "issues", label: "Issues", node: <div>Issues content</div> },
    { id: "deploy", label: "Deploy", node: <div>Deploy content</div> },
  ];
}

function makeDockProps(overrides: Partial<Parameters<typeof BottomDock>[0]> = {}) {
  return {
    open: false,
    tab: "ddl" as string,
    onToggle: vi.fn(),
    onTab: vi.fn(),
    tabs: makeTabs(),
    ...overrides,
  };
}

describe("BottomDock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Basic structure ──────────────────────────────────────────────────────

  it("renders with data-testid=bottom-dock", () => {
    render(<BottomDock {...makeDockProps()} />);
    expect(screen.getByTestId("bottom-dock")).toBeInTheDocument();
  });

  // ── Collapsed state ───────────────────────────────────────────────────────

  it("when collapsed (open=false) renders expand affordance", () => {
    render(<BottomDock {...makeDockProps({ open: false })} />);
    expect(screen.getByTestId("dock-expand")).toBeInTheDocument();
  });

  it("when collapsed renders tab labels as strip", () => {
    render(<BottomDock {...makeDockProps({ open: false })} />);
    expect(screen.getByText("DDL")).toBeInTheDocument();
    expect(screen.getByText("Issues")).toBeInTheDocument();
    expect(screen.getByText("Deploy")).toBeInTheDocument();
  });

  it("dock-expand calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(<BottomDock {...makeDockProps({ open: false, onToggle })} />);
    fireEvent.click(screen.getByTestId("dock-expand"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("when collapsed, tab panel content is not rendered", () => {
    render(<BottomDock {...makeDockProps({ open: false })} />);
    expect(screen.queryByText("DDL content")).toBeNull();
  });

  // ── Open state ────────────────────────────────────────────────────────────

  it("when open=true renders the active tab's content", () => {
    render(<BottomDock {...makeDockProps({ open: true, tab: "ddl" })} />);
    expect(screen.getByText("DDL content")).toBeInTheDocument();
  });

  it("when open=true with tab=issues renders issues content", () => {
    render(<BottomDock {...makeDockProps({ open: true, tab: "issues" })} />);
    expect(screen.getByText("Issues content")).toBeInTheDocument();
  });

  it("when open=true does not render inactive tab content", () => {
    render(<BottomDock {...makeDockProps({ open: true, tab: "ddl" })} />);
    expect(screen.queryByText("Issues content")).toBeNull();
  });

  // ── ARIA roles ────────────────────────────────────────────────────────────

  it("has role=tablist", () => {
    render(<BottomDock {...makeDockProps({ open: true })} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("tab buttons have role=tab", () => {
    render(<BottomDock {...makeDockProps({ open: true })} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBeGreaterThanOrEqual(3);
  });

  it("active tab panel has role=tabpanel", () => {
    render(<BottomDock {...makeDockProps({ open: true, tab: "ddl" })} />);
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
  });

  it("clicking a tab calls onTab with the tab id", () => {
    const onTab = vi.fn();
    render(<BottomDock {...makeDockProps({ open: true, onTab })} />);
    const tabs = screen.getAllByRole("tab");
    const issuesTab = tabs.find((t) => t.textContent?.includes("Issues"))!;
    fireEvent.click(issuesTab);
    expect(onTab).toHaveBeenCalledWith("issues");
  });

  it("active tab has aria-selected=true", () => {
    render(<BottomDock {...makeDockProps({ open: true, tab: "ddl" })} />);
    const tabs = screen.getAllByRole("tab");
    const ddlTab = tabs.find((t) => t.textContent?.includes("DDL"))!;
    expect(ddlTab).toHaveAttribute("aria-selected", "true");
  });

  it("inactive tab has aria-selected=false", () => {
    render(<BottomDock {...makeDockProps({ open: true, tab: "ddl" })} />);
    const tabs = screen.getAllByRole("tab");
    const issuesTab = tabs.find((t) => t.textContent?.includes("Issues"))!;
    expect(issuesTab).toHaveAttribute("aria-selected", "false");
  });

  // ── Collapse from open state ──────────────────────────────────────────────

  it("when open renders a collapse affordance that calls onToggle", () => {
    const onToggle = vi.fn();
    render(<BottomDock {...makeDockProps({ open: true, onToggle })} />);
    const collapseBtn = screen.getByTestId("dock-collapse");
    fireEvent.click(collapseBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  // ── No store import ───────────────────────────────────────────────────────

  it("is pure/controlled with no store coupling", () => {
    expect(() => render(<BottomDock {...makeDockProps()} />)).not.toThrow();
  });
});
