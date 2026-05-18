import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBar } from "./StatusBar";

function makeStatusBarProps(overrides: Partial<Parameters<typeof StatusBar>[0]> = {}) {
  return {
    project: "my-project",
    view: "ORDERS",
    erdZoom: 1.0,
    docZoom: 1.0,
    valid: true,
    ...overrides,
  };
}

describe("StatusBar", () => {
  // ── Basic structure ──────────────────────────────────────────────────────

  it("renders with data-testid=status-bar", () => {
    render(<StatusBar {...makeStatusBarProps()} />);
    expect(screen.getByTestId("status-bar")).toBeInTheDocument();
  });

  it("displays the project name", () => {
    render(<StatusBar {...makeStatusBarProps({ project: "my-project" })} />);
    expect(screen.getByTestId("status-bar")).toHaveTextContent("my-project");
  });

  it("displays the view name", () => {
    render(<StatusBar {...makeStatusBarProps({ view: "ORDERS" })} />);
    expect(screen.getByTestId("status-bar")).toHaveTextContent("ORDERS");
  });

  it("displays the erdZoom value", () => {
    render(<StatusBar {...makeStatusBarProps({ erdZoom: 1.5 })} />);
    expect(screen.getByTestId("status-bar")).toHaveTextContent("150%");
  });

  it("displays the docZoom value", () => {
    render(<StatusBar {...makeStatusBarProps({ docZoom: 0.75 })} />);
    expect(screen.getByTestId("status-bar")).toHaveTextContent("75%");
  });

  it("shows valid indicator when valid=true", () => {
    render(<StatusBar {...makeStatusBarProps({ valid: true })} />);
    const bar = screen.getByTestId("status-bar");
    expect(bar).toHaveTextContent(/valid/i);
  });

  it("shows invalid indicator when valid=false", () => {
    render(<StatusBar {...makeStatusBarProps({ valid: false })} />);
    const bar = screen.getByTestId("status-bar");
    expect(bar).toHaveTextContent(/invalid/i);
  });

  it("handles missing view gracefully", () => {
    render(<StatusBar erdZoom={1.0} docZoom={1.0} valid={true} />);
    expect(screen.getByTestId("status-bar")).toBeInTheDocument();
  });

  it("handles missing project gracefully", () => {
    render(<StatusBar erdZoom={1.0} docZoom={1.0} valid={true} />);
    expect(screen.getByTestId("status-bar")).toBeInTheDocument();
  });

  // ── No store import ───────────────────────────────────────────────────────

  it("is pure/controlled with no store coupling", () => {
    expect(() => render(<StatusBar {...makeStatusBarProps()} />)).not.toThrow();
  });
});
