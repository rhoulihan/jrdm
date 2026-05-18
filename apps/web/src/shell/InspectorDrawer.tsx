import React, { useEffect } from "react";

export interface InspectorDrawerProps {
  open: boolean;
  pinned: boolean;
  onClose: () => void;
  onTogglePin: () => void;
  children: React.ReactNode;
}

export function InspectorDrawer({
  open,
  pinned,
  onClose,
  onTogglePin,
  children,
}: InspectorDrawerProps) {
  // Escape closes the drawer when open and not pinned
  useEffect(() => {
    if (!open || pinned) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, pinned, onClose]);

  // Closed + unpinned: not in DOM
  if (!open && !pinned) {
    return null;
  }

  // Closed + pinned: in DOM but hidden
  if (!open && pinned) {
    return <div data-testid="inspector-drawer" aria-hidden="true" className="hidden" />;
  }

  // Open: slide in
  return (
    <div
      data-testid="inspector-drawer"
      className="flex flex-col bg-surface-alt border-l border-jrdm-border w-72 overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-row items-center justify-between px-3 py-2 border-b border-jrdm-border">
        <span className="text-sm font-medium text-jrdm-text">Inspector</span>
        <div className="flex flex-row gap-1">
          <button
            type="button"
            data-testid="drawer-pin"
            aria-pressed={pinned}
            aria-label={pinned ? "Unpin inspector" : "Pin inspector"}
            onClick={onTogglePin}
            className={`p-1 rounded text-xs focus:outline-none focus:ring-1 focus:ring-accent ${
              pinned
                ? "text-accent bg-accent/10"
                : "text-jrdm-muted hover:text-jrdm-text hover:bg-surface"
            }`}
          >
            📌
          </button>
          <button
            type="button"
            data-testid="drawer-close"
            aria-label="Close inspector"
            onClick={onClose}
            className="p-1 rounded text-xs text-jrdm-muted hover:text-jrdm-text hover:bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">{children}</div>
    </div>
  );
}
