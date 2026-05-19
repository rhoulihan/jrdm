import React from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { AnyField, Relationship } from "@jrdm/model";
import type { WorkingCopy } from "./workingCopy";
import { isLocked, toDualityView } from "./workingCopy";
import { decideEmbed } from "./fkEmbed";
import { flattenPaths } from "../document/documentModel";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MappingTreeProps {
  /** Working copy produced by M.T1 seedWorkingCopy() */
  workingCopy: WorkingCopy;
  /** Currently-selected node path; null = nothing selected (+ creates ROOT) */
  selectedPath: number[] | null;
  /** The entity table being mapped (used for FK embed rule) */
  droppedTable: string;
  /** All relationships from the store (for decideEmbed) */
  relationships: Relationship[];
  /**
   * Whether the dropped-table node embeds as array.
   * Controlled by the parent (M.T4); this component reflects + calls onToggleEmbed.
   */
  embedAsArray: boolean;
  /**
   * The table of the PARENT node under which the dropped entity was placed.
   * Undefined/null when the entity was placed at root (no parent) → hides checkbox.
   */
  parentTable?: string | null | undefined;
  onSelect: (path: number[] | null) => void;
  /** + add node: parent calls this; root if selectedPath=null, subnode otherwise */
  onAddNode: () => void;
  /** − delete: only enabled when selected node is session-new (not locked) */
  onDeleteNode: () => void;
  /** Called when the user toggles the embed-as-array checkbox (non-FK-driven) */
  onToggleEmbed: () => void;
  /**
   * Create-root mode: when true (editingView===null), the entity IS the document
   * root — path-building via +/− is meaningless, so both buttons are disabled
   * with an explanatory tooltip.
   */
  createRootMode?: boolean;
}

// ── Internal: tree-node path helpers ─────────────────────────────────────────

function pathKey(path: number[]): string {
  return path.join(".");
}

// ── Internal: MappingNode ─────────────────────────────────────────────────────

interface MappingNodeProps {
  field: AnyField;
  path: number[];
  workingCopy: WorkingCopy;
  selectedPath: number[] | null;
  onSelect: (path: number[] | null) => void;
}

function MappingNode({ field, path, workingCopy, selectedPath, onSelect }: MappingNodeProps) {
  const pKey = pathKey(path);
  const isSelected = selectedPath !== null && pathKey(selectedPath) === pKey;
  const locked = isLocked(workingCopy, path);
  const isNested = "kind" in field;

  return (
    <>
      <div
        data-testid={`mnode-${pKey}`}
        data-locked={locked ? "true" : "false"}
        role="treeitem"
        aria-selected={isSelected ? "true" : "false"}
        tabIndex={isSelected ? 0 : -1}
        {...(isNested ? { "aria-expanded": "true" } : {})}
        className={[
          "border-l-2 pl-2 my-0.5 cursor-pointer flex items-center gap-1",
          isSelected ? "border-accent bg-surface" : "border-jrdm-border",
        ].join(" ")}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(path);
        }}
      >
        {/* Field label */}
        {isNested ? (
          <span>
            {field.key}
            <span className="text-xs text-jrdm-muted ml-1">
              ({field.kind} {field.table})
            </span>
          </span>
        ) : (
          <span>
            <span className="font-medium">{field.key}</span>
            <span className="text-jrdm-muted text-xs ml-1">{field.source}</span>
          </span>
        )}

        {/* Locked indicator */}
        {locked && (
          <span aria-label="locked" className="ml-auto text-xs text-jrdm-muted" aria-hidden="false">
            🔒
          </span>
        )}
      </div>

      {/* Children */}
      {isNested && field.fields.length > 0 && (
        <div className="ml-3">
          {field.fields.map((child, i) => (
            <MappingNode
              key={`${pKey}.${i}`}
              field={child}
              path={[...path, i]}
              workingCopy={workingCopy}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ── MappingTree ───────────────────────────────────────────────────────────────

/**
 * Right panel of the Map-to-Document modal (§2 of the spec).
 *
 * Fully controlled and presentational — no store import.
 * All state lives in the parent (M.T4). This component:
 *  - Renders the WorkingCopy document as an a11y tree
 *  - Marks pre-existing (locked) nodes visually and protects them from deletion
 *  - Provides + add node (root if nothing selected / subnode if selected)
 *  - Provides − delete (disabled when locked or nothing selected)
 *  - Shows the embed-as-array checkbox (hidden at root, disabled+tooltip when FK-driven)
 */
export function MappingTree({
  workingCopy,
  selectedPath,
  droppedTable,
  relationships,
  embedAsArray,
  parentTable,
  onSelect,
  onAddNode,
  onDeleteNode,
  onToggleEmbed,
  createRootMode = false,
}: MappingTreeProps) {
  const view = toDualityView(workingCopy);

  // ── Determine if − delete is enabled ──────────────────────────────────────
  const deleteEnabled =
    !createRootMode && selectedPath !== null && !isLocked(workingCopy, selectedPath);

  // ── + add node label / disabled state ────────────────────────────────────
  const createRootTooltip =
    "A duality view's root is the document root — add child tables later via Map to document";
  const addLabel = createRootMode
    ? createRootTooltip
    : selectedPath === null
      ? "Add root node (no node selected)"
      : "Add subnode under selected";

  // ── Embed checkbox: compute FK-driven state ────────────────────────────────
  const showEmbedCheckbox = Boolean(parentTable);
  const embedDecision =
    showEmbedCheckbox && parentTable ? decideEmbed(relationships, parentTable, droppedTable) : null;
  const fkDriven = embedDecision?.fkDriven ?? false;

  // Tooltip text when FK forces the embed setting
  const fkTooltip =
    fkDriven && embedDecision?.rel
      ? `FK: ${embedDecision.rel.from.table} → ${embedDecision.rel.to.table} (${embedDecision.rel.cardinality})`
      : undefined;

  // ── Keyboard navigation (ArrowUp/Down moves through flattened tree) ────────
  function onTreeKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const order = flattenPaths(view);
    if (order.length === 0) return;
    const cur = selectedPath ? pathKey(selectedPath) : null;
    const idx = cur === null ? -1 : order.findIndex((p) => pathKey(p) === cur);
    let next: number;
    if (e.key === "ArrowDown") {
      next = idx < 0 ? 0 : Math.min(idx + 1, order.length - 1);
    } else {
      next = idx <= 0 ? 0 : idx - 1;
    }
    onSelect(order[next]!);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div data-testid="mapping-tree" className="flex flex-col gap-2 h-full p-3 text-sm">
      {/* Deselect affordance — clicking empty tree area clears selection */}
      <div
        data-testid="mapping-tree-deselect"
        className="text-xs text-jrdm-muted cursor-pointer hover:text-jrdm-text mb-1"
        onClick={() => onSelect(null)}
        aria-label="Deselect all (click to deselect)"
      >
        {selectedPath !== null ? "▸ click to deselect" : ""}
      </div>

      {/* a11y tree */}
      <div
        role="tree"
        tabIndex={0}
        className="flex-1 overflow-auto"
        onKeyDown={onTreeKeyDown}
        onClick={(e) => {
          // If the click target is the tree background (not a node), deselect
          if (e.target === e.currentTarget) onSelect(null);
        }}
      >
        {view.fields.map((field, i) => (
          <MappingNode
            key={i}
            field={field}
            path={[i]}
            workingCopy={workingCopy}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* ── Embed-as-array checkbox (hidden when root placement) ─────────── */}
      {showEmbedCheckbox && (
        <div className="flex items-center gap-2 pt-1 border-t border-jrdm-border">
          <span title={fkTooltip}>
            <input
              id="mapping-embed-as-array"
              type="checkbox"
              data-testid="embed-as-array"
              checked={embedAsArray}
              disabled={fkDriven}
              onChange={() => {
                if (!fkDriven) onToggleEmbed();
              }}
              className="accent-accent w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
              aria-checked={embedAsArray}
              title={fkTooltip}
            />
          </span>
          <label
            htmlFor="mapping-embed-as-array"
            className="text-sm text-jrdm-text cursor-pointer select-none"
          >
            embed as array
          </label>
          {fkDriven && fkTooltip && (
            <span className="text-xs text-jrdm-muted ml-1" aria-live="polite">
              {fkTooltip}
            </span>
          )}
        </div>
      )}

      {/* ── Toolbar: + add node / − delete ──────────────────────────────── */}
      <div className="flex gap-2 pt-1 border-t border-jrdm-border">
        <button
          type="button"
          data-testid="add-node-btn"
          onClick={createRootMode ? undefined : onAddNode}
          disabled={createRootMode}
          aria-label={addLabel}
          title={addLabel}
          className={[
            "flex-1 text-xs border border-jrdm-border rounded px-2 py-1",
            createRootMode
              ? "bg-surface-alt opacity-40 cursor-not-allowed"
              : "bg-surface-alt hover:bg-surface focus:outline-none focus:ring-1 focus:ring-accent",
          ].join(" ")}
        >
          + add node
        </button>

        <button
          type="button"
          data-testid="delete-node-btn"
          onClick={deleteEnabled ? onDeleteNode : undefined}
          disabled={!deleteEnabled}
          aria-label="Delete selected node (session-new only)"
          title={
            createRootMode
              ? createRootTooltip
              : selectedPath === null
                ? "No node selected"
                : !deleteEnabled
                  ? "Locked nodes cannot be deleted"
                  : "Delete selected node"
          }
          className={[
            "flex-1 text-xs border border-jrdm-border rounded px-2 py-1",
            deleteEnabled
              ? "bg-surface-alt hover:bg-surface focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
              : "bg-surface-alt opacity-40 cursor-not-allowed",
          ].join(" ")}
        >
          − delete
        </button>
      </div>
    </div>
  );
}
