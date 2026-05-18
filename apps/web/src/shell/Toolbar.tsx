import React from "react";

export type ConnectionStatus = "disconnected" | "connected" | "error";

export interface ToolbarProps {
  connection: ConnectionStatus;
  onConnect: () => void;
  onImport: () => void;
  onDeploy: () => void;
  onResetSplit: () => void;
  onFit: () => void;
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  disconnected: "Connection status: disconnected",
  connected: "Connection status: connected",
  error: "Connection status: error",
};

const STATUS_CLASSES: Record<ConnectionStatus, string> = {
  disconnected: "bg-jrdm-muted/30 text-jrdm-muted border-jrdm-border",
  connected: "bg-green-900/40 text-green-400 border-green-700",
  error: "bg-red-900/40 text-accent border-red-700",
};

export function Toolbar({
  connection,
  onConnect,
  onImport,
  onDeploy,
  onResetSplit,
  onFit,
}: ToolbarProps) {
  return (
    <div
      data-testid="toolbar"
      className="flex flex-row items-center h-10 bg-surface border-b border-jrdm-border px-3 gap-2"
    >
      {/* Connection status chip */}
      <span
        data-testid="conn-status"
        data-status={connection}
        aria-label={STATUS_LABELS[connection]}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${STATUS_CLASSES[connection]}`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            connection === "connected"
              ? "bg-green-400"
              : connection === "error"
                ? "bg-accent"
                : "bg-jrdm-muted"
          }`}
          aria-hidden="true"
        />
        {connection}
      </span>

      <div className="w-px h-5 bg-jrdm-border mx-1" aria-hidden="true" />

      {/* Action buttons */}
      <button
        type="button"
        data-testid="connect-btn"
        onClick={onConnect}
        className="px-2 py-1 rounded text-sm text-jrdm-text hover:bg-surface-alt focus:outline-none focus:ring-1 focus:ring-accent"
        aria-label="Connect to database"
      >
        Connect…
      </button>

      <button
        type="button"
        data-testid="import-btn"
        onClick={onImport}
        className="px-2 py-1 rounded text-sm text-jrdm-text hover:bg-surface-alt focus:outline-none focus:ring-1 focus:ring-accent"
        aria-label="Import schema"
      >
        Import
      </button>

      <button
        type="button"
        data-testid="deploy-btn"
        onClick={onDeploy}
        className="px-2 py-1 rounded text-sm text-jrdm-text hover:bg-surface-alt focus:outline-none focus:ring-1 focus:ring-accent"
        aria-label="Deploy view"
      >
        Deploy
      </button>

      <div className="flex-1" />

      {/* Canvas/split controls */}
      <button
        type="button"
        data-testid="reset-split-btn"
        onClick={onResetSplit}
        className="px-2 py-1 rounded text-xs text-jrdm-muted hover:text-jrdm-text hover:bg-surface-alt focus:outline-none focus:ring-1 focus:ring-accent"
        aria-label="Reset split to 50/50"
      >
        ⊞ Reset split
      </button>

      <button
        type="button"
        data-testid="fit-btn"
        onClick={onFit}
        className="px-2 py-1 rounded text-xs text-jrdm-muted hover:text-jrdm-text hover:bg-surface-alt focus:outline-none focus:ring-1 focus:ring-accent"
        aria-label="Fit diagram to view"
      >
        ⊡ Fit
      </button>
    </div>
  );
}
