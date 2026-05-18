import React, { useRef, useCallback } from "react";

export interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  ratio: number;
  onRatioChange: (r: number) => void;
  minRatio?: number;
  collapsed?: "left" | "right" | null;
  onCollapsedChange: (c: "left" | "right" | null) => void;
}

const NUDGE_STEP = 0.02;
const RAIL_WIDTH = 4; // px — thin rail when collapsed

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function SplitPane({
  left,
  right,
  ratio,
  onRatioChange,
  minRatio = 0.15,
  collapsed = null,
  onCollapsedChange,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      draggingRef.current = true;

      const onMove = (moveEvent: PointerEvent) => {
        if (!draggingRef.current) return;
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const newRatio = clamp(
          (moveEvent.clientX - rect.left) / rect.width,
          minRatio,
          1 - minRatio,
        );
        onRatioChange(newRatio);
      };

      const onUp = (upEvent: PointerEvent) => {
        draggingRef.current = false;
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const newRatio = clamp(
            (upEvent.clientX - rect.left) / rect.width,
            minRatio,
            1 - minRatio,
          );
          onRatioChange(newRatio);
        }
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [minRatio, onRatioChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case "ArrowRight": {
          e.preventDefault();
          onRatioChange(clamp(ratio + NUDGE_STEP, minRatio, 1 - minRatio));
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          onRatioChange(clamp(ratio - NUDGE_STEP, minRatio, 1 - minRatio));
          break;
        }
        case "Home": {
          e.preventDefault();
          onCollapsedChange("left");
          break;
        }
        case "End": {
          e.preventDefault();
          onCollapsedChange("right");
          break;
        }
      }
    },
    [ratio, minRatio, onRatioChange, onCollapsedChange],
  );

  const handleDoubleClick = useCallback(() => {
    onRatioChange(0.5);
  }, [onRatioChange]);

  const isLeftCollapsed = collapsed === "left";
  const isRightCollapsed = collapsed === "right";

  // Compute flex-basis for each pane
  const leftBasis = isLeftCollapsed
    ? `${RAIL_WIDTH}px`
    : isRightCollapsed
      ? `calc(100% - ${RAIL_WIDTH}px)`
      : `${ratio * 100}%`;

  const rightBasis = isRightCollapsed
    ? `${RAIL_WIDTH}px`
    : isLeftCollapsed
      ? `calc(100% - ${RAIL_WIDTH}px)`
      : undefined; // auto-fill remainder

  return (
    <div ref={containerRef} className="flex flex-row h-full w-full overflow-hidden">
      {/* Left pane */}
      <div
        className="flex flex-col overflow-hidden min-w-0"
        style={{ flexBasis: leftBasis, flexShrink: 0, flexGrow: 0 }}
      >
        {isLeftCollapsed ? (
          <div className="flex flex-col items-center h-full py-2">
            <button
              type="button"
              data-testid="restore-left"
              onClick={() => onCollapsedChange(null)}
              className="text-jrdm-muted hover:text-jrdm-text p-1 rounded"
              aria-label="Restore left pane"
            >
              ›
            </button>
            <div className="overflow-hidden flex-1 w-full">{left}</div>
          </div>
        ) : (
          <div className="h-full w-full overflow-auto">{left}</div>
        )}
      </div>

      {/* Divider */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={Math.round(minRatio * 100)}
        aria-valuemax={Math.round((1 - minRatio) * 100)}
        tabIndex={0}
        className="flex flex-col items-center justify-center flex-none w-5 bg-surface border-x border-jrdm-border cursor-col-resize select-none hover:bg-surface-alt focus:outline-none focus:ring-1 focus:ring-accent"
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        onDoubleClick={handleDoubleClick}
      >
        <button
          type="button"
          data-testid="collapse-left"
          onClick={() => onCollapsedChange("left")}
          className="text-jrdm-muted hover:text-jrdm-text text-xs leading-none py-0.5"
          aria-label="Collapse left pane"
          tabIndex={-1}
        >
          ‹
        </button>
        <div className="flex flex-col gap-0.5 my-1">
          <span className="w-0.5 h-3 bg-jrdm-border rounded-full block" />
          <span className="w-0.5 h-3 bg-jrdm-border rounded-full block" />
          <span className="w-0.5 h-3 bg-jrdm-border rounded-full block" />
        </div>
        <button
          type="button"
          data-testid="collapse-right"
          onClick={() => onCollapsedChange("right")}
          className="text-jrdm-muted hover:text-jrdm-text text-xs leading-none py-0.5"
          aria-label="Collapse right pane"
          tabIndex={-1}
        >
          ›
        </button>
      </div>

      {/* Right pane */}
      <div
        className="flex flex-col overflow-hidden min-w-0 flex-1"
        style={rightBasis ? { flexBasis: rightBasis, flexShrink: 0, flexGrow: 0 } : undefined}
      >
        {isRightCollapsed ? (
          <div className="flex flex-col items-center h-full py-2">
            <button
              type="button"
              data-testid="restore-right"
              onClick={() => onCollapsedChange(null)}
              className="text-jrdm-muted hover:text-jrdm-text p-1 rounded"
              aria-label="Restore right pane"
            >
              ‹
            </button>
            <div className="overflow-hidden flex-1 w-full">{right}</div>
          </div>
        ) : (
          <div className="h-full w-full overflow-auto">{right}</div>
        )}
      </div>
    </div>
  );
}
