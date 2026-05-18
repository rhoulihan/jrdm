import React from "react";

export interface StatusBarProps {
  project?: string;
  view?: string;
  erdZoom: number;
  docZoom: number;
  valid: boolean;
}

export function StatusBar({ project, view, erdZoom, docZoom, valid }: StatusBarProps) {
  const erdZoomPct = Math.round(erdZoom * 100);
  const docZoomPct = Math.round(docZoom * 100);

  return (
    <div
      data-testid="status-bar"
      className="flex flex-row items-center h-6 bg-surface border-t border-jrdm-border px-3 gap-4 text-xs text-jrdm-muted"
    >
      {project && (
        <span>
          Project: <span className="text-jrdm-text">{project}</span>
        </span>
      )}
      {view && (
        <span>
          View: <span className="text-jrdm-text">{view}</span>
        </span>
      )}
      <span>
        ERD: <span className="text-jrdm-text">{erdZoomPct}%</span>
      </span>
      <span>
        Doc: <span className="text-jrdm-text">{docZoomPct}%</span>
      </span>
      <span
        className={valid ? "text-green-400" : "text-accent"}
        aria-label={valid ? "Schema valid" : "Schema invalid"}
      >
        {valid ? "✓ valid" : "✗ invalid"}
      </span>
    </div>
  );
}
