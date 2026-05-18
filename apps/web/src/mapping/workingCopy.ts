import type { DualityView, NestedField } from "@jrdm/model";
import {
  addField,
  removeField,
  patchField,
  getField,
  nestedField,
  scalarField,
  flattenPaths,
} from "../document/documentModel";

/**
 * Immutable working copy for the Map-to-Document modal.
 *
 * Correctness invariant — the LOCKED-NODE BOUNDARY:
 *  `lockedPaths` is the set of every field path that existed in `editingView`
 *  at seed time, recorded as a stable path-string ("0.2.0"). Pre-existing
 *  nodes are seeded first in each sibling array and session-created nodes are
 *  only ever *appended* after them (documentModel.addField appends to the end
 *  of a sibling list), so a pre-existing node's path-string never changes for
 *  the life of a session. Any structural op (deleteNode / setEmbed) consults
 *  `isLocked` and no-ops on a locked path. Therefore a pre-existing node can
 *  never be deleted or structurally mutated by any op — only session-created
 *  nodes are mutable/deletable. `toDualityView` simply returns the working
 *  view, which is built exclusively via the immutable documentModel ops with
 *  the pre-existing subtree carried through unchanged.
 */
export interface WorkingCopy {
  readonly view: DualityView;
  readonly lockedPaths: ReadonlySet<string>;
}

const EMPTY_ROOT: DualityView = {
  name: "v_dv",
  schema: "app",
  createMode: "orReplace",
  root: {
    table: "",
    permissions: { insert: false, update: false, delete: false },
    etag: "check",
  },
  fields: [{ key: "_id", source: "" }],
};

const keyOf = (path: number[]): string => path.join(".");

export function seedWorkingCopy(editingView: DualityView | null): WorkingCopy {
  // Deep-clone so the working copy never aliases (and so cannot mutate) input.
  const view: DualityView = editingView
    ? structuredClone(editingView)
    : structuredClone(EMPTY_ROOT);
  const locked = new Set<string>();
  if (editingView) {
    for (const p of flattenPaths(view)) locked.add(keyOf(p));
  }
  return { view, lockedPaths: locked };
}

export function isLocked(wc: WorkingCopy, path: number[]): boolean {
  return wc.lockedPaths.has(keyOf(path));
}

export function addNode(
  wc: WorkingCopy,
  parentPath: number[] | null,
  spec: { key: string; kind: NestedField["kind"]; table: string },
): WorkingCopy {
  const node = nestedField(spec.key, spec.kind, spec.table);
  const view = addField(wc.view, parentPath ?? [], node);
  return { view, lockedPaths: wc.lockedPaths };
}

export function deleteNode(wc: WorkingCopy, path: number[]): WorkingCopy {
  // Locked-node boundary: pre-existing nodes cannot be deleted (no-op).
  if (isLocked(wc, path)) return wc;
  if (getField(wc.view, path) === undefined) return wc;
  return { view: removeField(wc.view, path), lockedPaths: wc.lockedPaths };
}

export function mapColumns(
  wc: WorkingCopy,
  targetPath: number[],
  table: string,
  columns: string[],
): WorkingCopy {
  // Locked-node boundary: pre-existing nodes cannot receive new children (no-op).
  if (isLocked(wc, targetPath)) return wc;
  let view = wc.view;
  for (const col of columns) {
    view = addField(view, targetPath, scalarField(col, table, col));
  }
  return { view, lockedPaths: wc.lockedPaths };
}

export function setEmbed(
  wc: WorkingCopy,
  path: number[],
  kind: NestedField["kind"],
  link: { from: string[]; to: string[] },
): WorkingCopy {
  // Locked-node boundary: pre-existing nodes cannot be structurally mutated.
  if (isLocked(wc, path)) return wc;
  if (getField(wc.view, path) === undefined) return wc;
  return {
    view: patchField(wc.view, path, { kind, link }),
    lockedPaths: wc.lockedPaths,
  };
}

export function toDualityView(wc: WorkingCopy): DualityView {
  return wc.view;
}
