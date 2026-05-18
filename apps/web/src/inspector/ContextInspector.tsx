import { useJrdmStore } from "../state/store";
import { Inspector } from "./Inspector";
import { FieldInspector } from "./FieldInspector";
import { ViewInspector } from "./ViewInspector";

export function ContextInspector() {
  const editingView = useJrdmStore((s) => s.editingView);
  const selectedFieldPath = useJrdmStore((s) => s.selectedFieldPath);

  // No mode toggle: context is derived from authoring state.
  // - Authoring a view + a field selected → FieldInspector
  // - Authoring a view (no field)         → ViewInspector
  // - Otherwise (ERD focus)               → entity Inspector
  if (editingView) {
    if (selectedFieldPath) return <FieldInspector />;
    return <ViewInspector />;
  }
  return <Inspector />;
}
