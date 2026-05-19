// @tested-by: apps/web/src/diagram/canMapToDocument.test.ts
import type { DualityView } from "@jrdm/model";

/** Returns true iff a started duality view (with a root entity) exists to embed into. */
export function canMapToDocument(editingView: DualityView | null): boolean {
  return editingView !== null;
}
