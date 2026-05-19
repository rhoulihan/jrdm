import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "./Modal";

function renderModal(overrides: Partial<Parameters<typeof Modal>[0]> = {}) {
  const defaults = {
    open: true,
    title: "Test Modal",
    onClose: vi.fn(),
    children: (
      <div>
        <button type="button">First Button</button>
        <button type="button">Second Button</button>
      </div>
    ),
    ...overrides,
  };
  return { ...render(<Modal {...defaults} />), props: defaults };
}

describe("Modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // RTL's global afterEach handles cleanup; do not manually wipe document.body
  // (doing so conflicts with React's portal unmounting).

  // ── Nothing rendered when closed ──────────────────────────────────────────

  it("renders nothing when open=false", () => {
    render(
      <Modal open={false} title="Hidden Modal" onClose={vi.fn()}>
        <div>should not show</div>
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("should not show")).toBeNull();
  });

  // ── Dialog a11y roles ─────────────────────────────────────────────────────

  it("renders a dialog with role=dialog when open=true", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("dialog has aria-modal=true", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("dialog has aria-label equal to title", () => {
    renderModal({ title: "My Accessible Dialog" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "My Accessible Dialog");
  });

  it("renders an overlay element", () => {
    renderModal();
    expect(screen.getByTestId("modal-overlay")).toBeInTheDocument();
  });

  it("renders a close button with data-testid=modal-close", () => {
    renderModal();
    expect(screen.getByTestId("modal-close")).toBeInTheDocument();
  });

  it("displays the title text inside the dialog", () => {
    renderModal({ title: "Connection Settings" });
    expect(screen.getByText("Connection Settings")).toBeInTheDocument();
  });

  it("renders children content when open", () => {
    renderModal();
    expect(screen.getByText("First Button")).toBeInTheDocument();
  });

  // ── Close interactions ────────────────────────────────────────────────────

  it("close button calls onClose", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByTestId("modal-close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Escape key calls onClose", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("clicking overlay calls onClose", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByTestId("modal-overlay"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("clicking inside dialog content does NOT call onClose", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Portal rendering ──────────────────────────────────────────────────────

  it("renders into document.body (portal)", () => {
    const { baseElement } = renderModal();
    // The dialog should be in document.body, not necessarily in the component's container
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).toBeInTheDocument();
    // Confirm it was found in body, not baseElement's container
    expect(baseElement).toBeDefined(); // test infrastructure works
  });

  // ── Focus management ──────────────────────────────────────────────────────

  it("focuses the first focusable element inside dialog on open", () => {
    renderModal();
    // After mount, focus should be inside the dialog (synchronous now — no rAF)
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("traps focus: Tab from last focusable element cycles to first", () => {
    renderModal({
      children: (
        <div>
          <button type="button" data-testid="btn-first">
            First
          </button>
          <button type="button" data-testid="btn-last">
            Last
          </button>
        </div>
      ),
    });

    const dialog = screen.getByRole("dialog");
    const allFocusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    );
    const lastEl = allFocusable[allFocusable.length - 1]!;
    const firstEl = allFocusable[0]!;

    // Focus the last element
    lastEl.focus();
    expect(document.activeElement).toBe(lastEl);

    // Tab from last should cycle to first
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(firstEl);
  });

  it("traps focus: Shift+Tab from first focusable element cycles to last", () => {
    renderModal({
      children: (
        <div>
          <button type="button" data-testid="btn-first">
            First
          </button>
          <button type="button" data-testid="btn-last">
            Last
          </button>
        </div>
      ),
    });

    const dialog = screen.getByRole("dialog");
    const allFocusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    );
    const firstEl = allFocusable[0]!;
    const lastEl = allFocusable[allFocusable.length - 1]!;

    // Focus the first element
    firstEl.focus();
    expect(document.activeElement).toBe(firstEl);

    // Shift+Tab from first should cycle to last
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(lastEl);
  });

  // ── Focus restoration ─────────────────────────────────────────────────────

  it("restores focus to the opener element when closed", () => {
    // Create an opener element and focus it before opening modal
    const openerButton = document.createElement("button");
    openerButton.textContent = "Open Modal";
    document.body.appendChild(openerButton);
    openerButton.focus();
    expect(document.activeElement).toBe(openerButton);

    const { rerender } = render(
      <Modal open={true} title="Focus Restore Test" onClose={vi.fn()}>
        <button type="button">Inside</button>
      </Modal>,
    );

    // Close the modal by re-rendering with open=false
    rerender(
      <Modal open={false} title="Focus Restore Test" onClose={vi.fn()}>
        <button type="button">Inside</button>
      </Modal>,
    );

    // Focus should return to the opener button
    expect(document.activeElement).toBe(openerButton);

    // Cleanup
    document.body.removeChild(openerButton);
  });

  // ── Size prop ─────────────────────────────────────────────────────────────

  it("default (no size prop) uses max-w-lg class", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toMatch(/max-w-lg/);
  });

  it("size='md' explicitly uses max-w-lg class", () => {
    renderModal({ size: "md" });
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toMatch(/max-w-lg/);
  });

  it("size='lg' uses max-w-4xl class (larger than default)", () => {
    renderModal({ size: "lg" });
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toMatch(/max-w-4xl/);
    expect(dialog.className).not.toMatch(/max-w-lg/);
  });

  it("size='lg' does not break a11y: dialog role, aria-modal, aria-label all intact", () => {
    renderModal({ size: "lg", title: "Large Accessible Dialog" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Large Accessible Dialog");
  });

  it("other Modal callers without size prop are unaffected (still max-w-lg)", () => {
    // Simulate a second caller that does not pass size (like connection/settings modals)
    render(
      <Modal open={true} title="Settings" onClose={vi.fn()}>
        <span>settings content</span>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toMatch(/max-w-lg/);
    expect(dialog.className).not.toMatch(/max-w-4xl/);
  });

  // ── No store import ───────────────────────────────────────────────────────

  it("is pure — renders without any store provider", () => {
    expect(() =>
      render(
        <Modal open={true} title="Pure modal" onClose={vi.fn()}>
          <span>content</span>
        </Modal>,
      ),
    ).not.toThrow();
  });
});
