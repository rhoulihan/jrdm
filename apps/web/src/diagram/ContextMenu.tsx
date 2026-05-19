// @tested-by: apps/web/src/diagram/ContextMenu.test.tsx
import React, { useEffect, useRef, useCallback } from "react";

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  title?: string;
}

export interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/** Convert a label string to a slug usable in data-testid */
function labelToSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Accessible context menu popover. Controlled/presentational — no store import.
 *
 * a11y: role=menu / menuitem, aria-disabled on gated items, Esc/outside-click close,
 * ArrowUp/Down navigation among enabled items, Enter/Space activation, opens with
 * focus on the first enabled item.
 */
export function ContextMenu({ open, x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus first enabled item when menu opens
  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    if (!menu) return;
    const enabledItems = Array.from(
      menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([aria-disabled="true"])'),
    );
    enabledItems[0]?.focus();
  }, [open]);

  // Escape closes the menu
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleItemKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, item: ContextMenuItem) => {
      if (e.key === "Enter" || e.key === " ") {
        if (!item.disabled) {
          e.preventDefault();
          item.onSelect();
          onClose();
        }
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const menu = menuRef.current;
        if (!menu) return;
        const enabledItems = Array.from(
          menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([aria-disabled="true"])'),
        );
        const currentIndex = enabledItems.indexOf(e.currentTarget);
        if (currentIndex === -1) return;
        const nextIndex =
          e.key === "ArrowDown"
            ? (currentIndex + 1) % enabledItems.length
            : (currentIndex - 1 + enabledItems.length) % enabledItems.length;
        enabledItems[nextIndex]?.focus();
      }
    },
    [onClose],
  );

  const handleItemClick = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled) return;
      item.onSelect();
      onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <>
      {/* Invisible overlay to catch outside clicks */}
      <div
        data-testid="ctx-overlay"
        className="fixed inset-0 z-40"
        onMouseDown={onClose}
        aria-hidden="true"
      />

      {/* Menu popover */}
      <div
        ref={menuRef}
        role="menu"
        data-testid="entity-context-menu"
        style={{ position: "fixed", left: x, top: y }}
        className="z-50 min-w-[200px] bg-surface-alt border border-jrdm-border rounded shadow-lg py-1"
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item) => {
          const slug = labelToSlug(item.label);
          const isDisabled = item.disabled === true;
          return (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              data-testid={`ctxitem-${slug}`}
              aria-disabled={isDisabled ? "true" : undefined}
              title={item.title}
              className={[
                "block w-full text-left px-3 py-1.5 text-sm",
                isDisabled
                  ? "text-jrdm-muted cursor-default"
                  : "text-jrdm-text hover:bg-surface focus:outline-none focus:bg-surface cursor-pointer",
              ].join(" ")}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => handleItemClick(item)}
              onKeyDown={(e) => handleItemKeyDown(e, item)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
