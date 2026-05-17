import { useJrdmStore } from "../state/store";

export function ConflictBanner() {
  const conflict = useJrdmStore((s) => s.conflict);
  const setConflict = useJrdmStore((s) => s.setConflict);

  if (!conflict) return null;

  return (
    <div
      data-testid="conflict-banner"
      className="flex items-center justify-between gap-3 p-3 bg-red-50 border border-red-300 rounded text-sm text-red-800"
    >
      <span className="font-mono">{conflict.message}</span>
      <button
        type="button"
        onClick={() => setConflict(null)}
        className="shrink-0 text-xs underline text-red-700 hover:text-red-900"
      >
        Dismiss
      </button>
    </div>
  );
}
