import { useJrdmStore } from "../state/store";
import { Inspector } from "./Inspector";
import { FieldInspector } from "./FieldInspector";
import { ViewInspector } from "./ViewInspector";

export function ContextInspector() {
  const mode = useJrdmStore((s) => s.mode);
  const selectedFieldPath = useJrdmStore((s) => s.selectedFieldPath);

  if (mode === "erd") return <Inspector />;
  if (selectedFieldPath) return <FieldInspector />;
  return <ViewInspector />;
}
