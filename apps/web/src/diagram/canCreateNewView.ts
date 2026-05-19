// @tested-by: apps/web/src/diagram/canCreateNewView.test.ts
import type { DualityView } from "@jrdm/model";

/** Returns true iff no duality view has been created yet — i.e. "New duality view" is allowed.
 *  This is the strict complement of canMapToDocument. */
export function canCreateNewView(editingView: DualityView | null): boolean {
  return editingView === null;
}
