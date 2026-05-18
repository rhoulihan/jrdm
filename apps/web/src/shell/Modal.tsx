import React, { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const FOCUSABLE_SELECTORS =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("tabindex") !== "-1",
  );
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  // Remember the element that had focus before modal opened
  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement;
    }
  }, [open]);

  // Focus first focusable element when modal opens, restore on close
  useEffect(() => {
    if (open) {
      const dialog = dialogRef.current;
      if (!dialog) return;

      // Defer to next tick so DOM is ready
      const focusable = getFocusableElements(dialog);
      if (focusable.length > 0) {
        focusable[0]!.focus();
      } else {
        dialog.focus();
      }
    } else {
      // Restore focus to opener
      if (openerRef.current && "focus" in openerRef.current) {
        (openerRef.current as HTMLElement).focus();
      }
    }
  }, [open]);

  // Escape key closes the modal
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Focus trap: Tab/Shift+Tab cycles within the dialog
  const handleDialogKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = getFocusableElements(dialog);
    if (focusable.length === 0) return;

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;

    if (e.shiftKey) {
      // Shift+Tab: if on first, cycle to last
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: if on last, cycle to first
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  if (!open) return null;

  return createPortal(
    <>
      {/* Overlay */}
      <div
        data-testid="modal-overlay"
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-alt border border-jrdm-border rounded-lg shadow-xl w-full max-w-lg p-6 focus:outline-none"
        onKeyDown={handleDialogKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-jrdm-text">{title}</h2>
          <button
            type="button"
            data-testid="modal-close"
            onClick={onClose}
            className="text-jrdm-muted hover:text-jrdm-text rounded p-1 hover:bg-surface transition-colors"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div>{children}</div>
      </div>
    </>,
    document.body,
  );
}
