import React from "react";

export interface ColumnDef {
  name: string;
  type: string;
}

export interface FieldChecklistProps {
  /** All columns of the dropped table. */
  columns: ColumnDef[];
  /** Currently-checked column names (used when selectAll=false). */
  selected: Set<string>;
  /** When true: every column appears checked and the list is disabled/grayed. */
  selectAll: boolean;
  onToggleColumn: (name: string) => void;
  onToggleSelectAll: () => void;
}

/**
 * FieldChecklist — left panel of the Map-to-Document modal (§2).
 *
 * Fully controlled, presentational — no store import.
 * - A "Select All" checkbox above the scrollable column list.
 * - When selectAll=true: every row shows checked AND the list is
 *   disabled + grayed (pointer-events-none + opacity).
 * - When selectAll=false: individual rows reflect `selected` and are interactive.
 */
export function FieldChecklist({
  columns,
  selected,
  selectAll,
  onToggleColumn,
  onToggleSelectAll,
}: FieldChecklistProps) {
  const listMutedClass = selectAll ? "opacity-50 pointer-events-none" : "";

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* ── Select All ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-1 py-0.5">
        <input
          id="field-checklist-select-all"
          type="checkbox"
          data-testid="select-all"
          checked={selectAll}
          onChange={onToggleSelectAll}
          className="accent-accent w-4 h-4 cursor-pointer"
          aria-checked={selectAll}
        />
        <label
          htmlFor="field-checklist-select-all"
          className="text-sm font-medium text-jrdm-text cursor-pointer select-none"
        >
          Select All
        </label>
      </div>

      {/* Divider */}
      <div className="border-t border-jrdm-border" aria-hidden="true" />

      {/* ── Column list ─────────────────────────────────────────────────── */}
      <div
        data-testid="field-list"
        className={`overflow-y-auto max-h-64 flex flex-col gap-0.5 ${listMutedClass}`}
        role="list"
      >
        {columns.map((col) => {
          const checkboxId = `field-checklist-col-${col.name}`;
          const isChecked = selectAll || selected.has(col.name);

          return (
            <div
              key={col.name}
              role="listitem"
              className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-surface-alt transition-colors"
            >
              <input
                id={checkboxId}
                type="checkbox"
                data-testid={`field-${col.name}`}
                checked={isChecked}
                disabled={selectAll}
                onChange={() => {
                  if (!selectAll) onToggleColumn(col.name);
                }}
                onClick={(e) => {
                  if (selectAll) e.preventDefault();
                }}
                className="accent-accent w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                aria-checked={isChecked}
              />
              <label
                htmlFor={checkboxId}
                className="flex flex-1 items-center gap-2 text-sm cursor-pointer select-none"
              >
                <span className="text-jrdm-text">{col.name}</span>
                <span className="text-xs text-jrdm-muted font-mono">{col.type}</span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
