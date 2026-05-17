import { useJrdmStore } from "../state/store";
import type { DualityView } from "@jrdm/model";

export function ViewInspector() {
  const view = useJrdmStore((s) => s.editingView);
  const setEditingView = useJrdmStore((s) => s.setEditingView);

  if (!view) {
    return (
      <div data-testid="viewinspector-empty" className="p-4 text-sm text-jrdm-muted">
        No view being edited.
      </div>
    );
  }

  const set = (patch: Partial<DualityView>) => setEditingView({ ...view, ...patch });
  const setRoot = (patch: Partial<DualityView["root"]>) =>
    setEditingView({ ...view, root: { ...view.root, ...patch } });

  return (
    <div className="p-4 text-sm flex flex-col gap-2" data-testid="viewinspector">
      <label className="flex flex-col gap-1">
        View name
        <input
          className="border border-jrdm-border rounded px-2 py-1"
          value={view.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1">
        Schema
        <input
          className="border border-jrdm-border rounded px-2 py-1"
          value={view.schema}
          onChange={(e) => set({ schema: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1">
        Create mode
        <select
          className="border border-jrdm-border rounded px-2 py-1"
          value={view.createMode}
          onChange={(e) => set({ createMode: e.target.value as DualityView["createMode"] })}
        >
          <option value="create">create</option>
          <option value="orReplace">orReplace</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Root table
        <input
          className="border border-jrdm-border rounded px-2 py-1"
          value={view.root.table}
          onChange={(e) => setRoot({ table: e.target.value })}
        />
      </label>
      {(["insert", "update", "delete"] as const).map((perm) => (
        <label key={perm} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={view.root.permissions[perm]}
            onChange={(e) =>
              setRoot({ permissions: { ...view.root.permissions, [perm]: e.target.checked } })
            }
          />
          root {perm}
        </label>
      ))}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={view.root.etag === "nocheck"}
          onChange={(e) => setRoot({ etag: e.target.checked ? "nocheck" : "check" })}
        />
        root etag nocheck
      </label>
      <label className="flex flex-col gap-1">
        Replication
        <select
          className="border border-jrdm-border rounded px-2 py-1"
          value={view.replication ?? ""}
          onChange={(e) =>
            set({
              replication:
                e.target.value === "" ? undefined : (e.target.value as "enable" | "disable"),
            })
          }
        >
          <option value="">(none)</option>
          <option value="enable">enable</option>
          <option value="disable">disable</option>
        </select>
      </label>
    </div>
  );
}
