import React, { useEffect, useMemo, useState } from "react";
import type { DualityView } from "@jrdm/model";
import { Modal } from "../shell/Modal";
import { useJrdmStore } from "../state/store";
import { FieldChecklist } from "./FieldChecklist";
import { MappingTree } from "./MappingTree";
import {
  type WorkingCopy,
  seedWorkingCopy,
  isLocked,
  addNode,
  deleteNode,
  mapColumns,
  setEmbed,
  toDualityView,
} from "./workingCopy";
import { decideEmbed } from "./fkEmbed";
import { sampleDocument } from "./sampleDocument";
import { getField } from "../document/documentModel";

/**
 * §6 — `MapToDocumentModal`: composes FieldChecklist (left) + "Map to Path"
 * (middle) + MappingTree (right) + Save/Cancel footer on the shell `Modal`.
 *
 * Owns ALL in-modal working state with React state (NOT the global store):
 *  - the immutable `WorkingCopy` seeded from `editingView` on open,
 *  - `selectedPath`, the checked-columns Set + `selectAll`,
 *  - the current `embedAsArray` toggle for the placed entity node.
 *
 * Only `Save` mutates the store (`setEditingView` + `setSampleDocs`); `Cancel`
 * discards the working state entirely (main pane unchanged).
 */
export function MapToDocumentModal() {
  const mapping = useJrdmStore((s) => s.mapping);
  const project = useJrdmStore((s) => s.project);
  const relationships = useJrdmStore((s) => s.relationships);
  const setEditingView = useJrdmStore((s) => s.setEditingView);
  const setSampleDocs = useJrdmStore((s) => s.setSampleDocs);
  const closeMapping = useJrdmStore((s) => s.closeMapping);

  const table = mapping.table;
  const entity = useMemo(
    () => (table ? (project?.entities.find((e) => e.name === table) ?? null) : null),
    [project, table],
  );

  // ── In-modal working state ────────────────────────────────────────────────
  const [wc, setWc] = useState<WorkingCopy>(() => seedWorkingCopy(null));
  const [selectedPath, setSelectedPath] = useState<number[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [embedAsArray, setEmbedAsArray] = useState(false);
  // Path of the placed dropped-entity node + the table of its parent (for the
  // FK-aware embed checkbox). null until the entity node is created.
  const [placedPath, setPlacedPath] = useState<number[] | null>(null);
  const [parentTable, setParentTable] = useState<string | null>(null);

  // Re-seed whenever the modal (re)opens for a resolvable entity.
  useEffect(() => {
    if (!mapping.open || !entity) return;
    // Read editingView once via the store at open time so later store changes
    // during the session never stomp the in-modal working copy (and so it is
    // not a reactive effect dependency).
    setWc(seedWorkingCopy(useJrdmStore.getState().editingView));
    setSelectedPath(null);
    setChecked(new Set());
    setSelectAll(false);
    setEmbedAsArray(false);
    setPlacedPath(null);
    setParentTable(null);
  }, [mapping.open, entity]);

  if (!mapping.open || !entity || !table) return null;

  const columns = entity.columns.map((c) => ({ name: c.name, type: c.type }));

  // The columns currently bound by "Map to Path".
  const checkedColumns = selectAll ? columns.map((c) => c.name) : [...checked];
  const canMap = checkedColumns.length > 0 && selectedPath !== null && !isLocked(wc, selectedPath);

  // ── Left: Field checklist handlers ────────────────────────────────────────
  function onToggleColumn(name: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }
  function onToggleSelectAll() {
    setSelectAll((v) => !v);
  }

  // ── Middle: Map to Path ───────────────────────────────────────────────────
  function onMapToPath() {
    if (!canMap || selectedPath === null) return;
    setWc((prev) => mapColumns(prev, selectedPath, table!, checkedColumns));
    // Clear the cherry-picked selection after binding (Select-All is sticky).
    setChecked(new Set());
    setSelectAll(false);
  }

  // ── Right: tree handlers ──────────────────────────────────────────────────
  function onSelect(path: number[] | null) {
    setSelectedPath(path);
  }

  function onAddNode() {
    const view0 = toDualityView(wc);
    const rootIdField = view0.fields[0];
    const rootIdSeeded =
      rootIdField !== undefined && "source" in rootIdField && rootIdField.source !== "";
    const hasRoot = Boolean(view0.root.table) && rootIdSeeded;

    // Resolve where the entity node attaches.
    //  - selected nested node       → subnode under it (parent = its table)
    //  - selected scalar / nothing  → child of the document root (parent = root.table)
    //  - no usable root yet         → the dropped entity BECOMES the document root
    let parentPath: number[] = [];
    let pTable: string | null = null;
    let createRoot = false;

    if (!hasRoot) {
      createRoot = true;
    } else if (selectedPath !== null) {
      const f = getField(view0, selectedPath);
      if (f && "kind" in f) {
        parentPath = selectedPath;
        pTable = f.table;
      } else {
        parentPath = [];
        pTable = view0.root.table || null;
      }
    } else {
      parentPath = [];
      pTable = view0.root.table || null;
    }

    if (createRoot) {
      // Root assignment is the modal's responsibility (M.T1 note): set
      // root.table + _id source from the entity's primary key. The dropped
      // entity is the document root — no nested node is added.
      const pk = entity!.primaryKey[0] ?? "id";
      setWc((prev) => {
        const v = toDualityView(prev);
        const fields = v.fields.map((f, i) =>
          i === 0 ? { ...f, key: "_id", source: `${table}.${pk}` } : f,
        );
        const view: DualityView = {
          ...v,
          root: { ...v.root, table: table! },
          fields,
        };
        return { ...prev, view };
      });
      // Select the root _id node so "Map to Path" can bind more root scalars.
      setSelectedPath([0]);
      setPlacedPath(null);
      setParentTable(null);
      return;
    }

    const decision = pTable ? decideEmbed(relationships, pTable, table!) : null;
    const kind = decision ? decision.kind : embedAsArray ? "array" : "object";

    setWc((prev) => {
      let next = addNode(prev, parentPath, { key: table!, kind, table: table! });
      if (decision) {
        const np = newChildPath(toDualityView(next), parentPath);
        if (np) next = setEmbed(next, np, decision.kind, decision.link);
      }
      return next;
    });

    // Deterministic path of the just-appended node (addField appends).
    const newPath =
      parentPath.length === 0
        ? [view0.fields.length]
        : (() => {
            const p = getField(view0, parentPath);
            const len = p && "kind" in p ? p.fields.length : 0;
            return [...parentPath, len];
          })();

    setSelectedPath(newPath);
    setPlacedPath(newPath);
    setParentTable(pTable);
    if (decision) setEmbedAsArray(decision.kind === "array");
  }

  function onDeleteNode() {
    if (selectedPath === null) return;
    setWc((prev) => deleteNode(prev, selectedPath));
    setSelectedPath(null);
    setPlacedPath(null);
    setParentTable(null);
  }

  function onToggleEmbed() {
    setEmbedAsArray((prev) => {
      const nextVal = !prev;
      if (placedPath) {
        setWc((w) => setEmbed(w, placedPath, nextVal ? "array" : "object", { from: [], to: [] }));
      }
      return nextVal;
    });
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  function onCancel() {
    closeMapping();
  }

  function onSave() {
    const savedView = toDualityView(wc);
    setEditingView(savedView);
    setSampleDocs([sampleDocument(savedView, project?.entities ?? [])]);
    closeMapping();
  }

  return (
    <Modal open title={`Map "${table}" to Document`} onClose={onCancel}>
      <div data-testid="map-to-document" className="flex flex-col gap-4">
        <div className="flex gap-4 items-stretch">
          {/* Left — Fields */}
          <div className="w-56 shrink-0">
            <FieldChecklist
              columns={columns}
              selected={checked}
              selectAll={selectAll}
              onToggleColumn={onToggleColumn}
              onToggleSelectAll={onToggleSelectAll}
            />
          </div>

          {/* Middle — Map to Path */}
          <div className="flex flex-col justify-center shrink-0">
            <button
              type="button"
              data-testid="map-to-path-btn"
              onClick={onMapToPath}
              disabled={!canMap}
              className={[
                "text-sm border border-jrdm-border rounded px-3 py-2",
                canMap
                  ? "bg-accent text-white hover:opacity-90 cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
                  : "bg-surface-alt opacity-40 cursor-not-allowed",
              ].join(" ")}
              title={
                canMap
                  ? "Bind checked columns under the selected node"
                  : selectedPath !== null && isLocked(wc, selectedPath)
                    ? "Can't map into a pre-existing (locked) node"
                    : "Check columns and select a node first"
              }
            >
              Map to Path ▶
            </button>
          </div>

          {/* Right — Document tree */}
          <div className="flex-1 min-w-0 border border-jrdm-border rounded">
            <MappingTree
              workingCopy={wc}
              selectedPath={selectedPath}
              droppedTable={table}
              relationships={relationships}
              embedAsArray={embedAsArray}
              parentTable={parentTable}
              onSelect={onSelect}
              onAddNode={onAddNode}
              onDeleteNode={onDeleteNode}
              onToggleEmbed={onToggleEmbed}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-jrdm-border">
          <button
            type="button"
            data-testid="map-cancel"
            onClick={onCancel}
            className="text-sm border border-jrdm-border rounded px-4 py-2 bg-surface-alt hover:bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="map-save"
            onClick={onSave}
            className="text-sm border border-jrdm-border rounded px-4 py-2 bg-accent text-white hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-accent"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Path of the just-appended child of `parentPath` (documentModel.addField
 * always appends to the end of the sibling list).
 */
function newChildPath(view: DualityView, parentPath: number[] | null): number[] | null {
  if (parentPath === null || parentPath.length === 0) {
    return view.fields.length > 0 ? [view.fields.length - 1] : null;
  }
  const parent = getField(view, parentPath);
  if (parent && "kind" in parent && parent.fields.length > 0) {
    return [...parentPath, parent.fields.length - 1];
  }
  return null;
}
