import React from "react";

export interface DockTab {
  id: string;
  label: string;
  node: React.ReactNode;
}

export interface BottomDockProps {
  open: boolean;
  tab: string;
  onToggle: () => void;
  onTab: (id: string) => void;
  tabs: DockTab[];
}

export function BottomDock({ open, tab, onToggle, onTab, tabs }: BottomDockProps) {
  const activeTab = tabs.find((t) => t.id === tab) ?? tabs[0];

  if (!open) {
    return (
      <div
        data-testid="bottom-dock"
        className="flex flex-row items-center h-8 bg-surface border-t border-jrdm-border px-2 gap-2"
      >
        {/* Tab label strip */}
        <div className="flex flex-row gap-1 items-center">
          {tabs.map((t) => (
            <span key={t.id} className="px-2 text-xs text-jrdm-muted">
              {t.label}
            </span>
          ))}
        </div>

        <div className="flex-1" />

        <button
          type="button"
          data-testid="dock-expand"
          onClick={onToggle}
          className="px-2 py-0.5 rounded text-xs text-jrdm-muted hover:text-jrdm-text hover:bg-surface-alt focus:outline-none focus:ring-1 focus:ring-accent"
          aria-label="Expand bottom dock"
        >
          ▲
        </button>
      </div>
    );
  }

  return (
    <div data-testid="bottom-dock" className="flex flex-col bg-surface border-t border-jrdm-border">
      {/* Tab bar */}
      <div className="flex flex-row items-center border-b border-jrdm-border">
        <div role="tablist" aria-label="Bottom dock tabs" className="flex flex-row">
          {tabs.map((t) => {
            const isActive = t.id === (activeTab?.id ?? "");
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`dock-panel-${t.id}`}
                id={`dock-tab-${t.id}`}
                onClick={() => onTab(t.id)}
                className={`px-3 py-1.5 text-sm border-b-2 focus:outline-none focus:ring-1 focus:ring-accent ${
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-jrdm-muted hover:text-jrdm-text hover:border-jrdm-border"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        <button
          type="button"
          data-testid="dock-collapse"
          onClick={onToggle}
          className="px-2 py-1 text-xs text-jrdm-muted hover:text-jrdm-text hover:bg-surface-alt focus:outline-none focus:ring-1 focus:ring-accent mr-2"
          aria-label="Collapse bottom dock"
        >
          ▼
        </button>
      </div>

      {/* Active tab panel */}
      {activeTab && (
        <div
          role="tabpanel"
          id={`dock-panel-${activeTab.id}`}
          aria-labelledby={`dock-tab-${activeTab.id}`}
          className="flex-1 overflow-auto p-2"
        >
          {activeTab.node}
        </div>
      )}
    </div>
  );
}
