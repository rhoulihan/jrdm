import React, { useState, useEffect, useRef, useCallback } from "react";

export interface MenuBarChild {
  id: string;
  label: string;
  onSelect: () => void;
}

export interface MenuBarItem {
  id: string;
  label: string;
  children?: MenuBarChild[];
}

export interface MenuBarProps {
  items: MenuBarItem[];
}

export function MenuBar({ items }: MenuBarProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpenId(null), []);

  // Escape closes the menu
  useEffect(() => {
    if (!openId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [openId, close]);

  // Click outside closes the menu
  useEffect(() => {
    if (!openId) return;
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openId, close]);

  return (
    <div
      ref={barRef}
      role="menubar"
      aria-label="Application menu"
      data-testid="menubar"
      className="flex flex-row items-center h-8 bg-surface border-b border-jrdm-border px-2 gap-1 select-none"
    >
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id} className="relative">
            <button
              type="button"
              role="menuitem"
              aria-haspopup={item.children ? "menu" : undefined}
              aria-expanded={item.children ? isOpen : undefined}
              className="px-2 py-0.5 rounded text-sm text-jrdm-text hover:bg-surface-alt focus:outline-none focus:ring-1 focus:ring-accent"
              onClick={() => setOpenId(isOpen ? null : item.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" && isOpen && item.children) {
                  e.preventDefault();
                  // Focus first child menuitem
                  const menu = barRef.current?.querySelector(
                    `[data-menu-id="${item.id}"] [role="menuitem"]`,
                  ) as HTMLElement | null;
                  menu?.focus();
                }
              }}
            >
              {item.label}
            </button>

            {isOpen && item.children && (
              <div
                role="menu"
                data-menu-id={item.id}
                aria-label={item.label}
                className="absolute top-full left-0 z-50 mt-0.5 min-w-[140px] bg-surface-alt border border-jrdm-border rounded shadow-lg py-1"
              >
                {item.children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    role="menuitem"
                    className="block w-full text-left px-3 py-1 text-sm text-jrdm-text hover:bg-surface focus:outline-none focus:bg-surface"
                    onClick={() => {
                      child.onSelect();
                      close();
                    }}
                  >
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
