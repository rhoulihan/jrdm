import { useJrdmStore } from "../state/store";

export function IssuesPanel() {
  const issues = useJrdmStore((s) => s.issues);
  const project = useJrdmStore((s) => s.project);
  const select = useJrdmStore((s) => s.selectEntity);

  if (issues.length === 0) {
    return (
      <div data-testid="issues-clean" className="p-3 text-sm text-jrdm-muted">
        No validation issues.
      </div>
    );
  }

  function focus(path: (string | number)[]) {
    if (path[0] !== "entities" || typeof path[1] !== "string") return;
    const name = path[1];
    const found = project?.entities.find((e) => e.name === name);
    select(`${found?.schema ?? "app"}.${name}`);
  }

  return (
    <ul className="text-sm divide-y divide-jrdm-border" data-testid="issues-list">
      {issues.map((iss, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => focus(iss.path)}
            className="w-full text-left px-3 py-2 hover:bg-surface"
          >
            <span
              className={
                iss.severity === "error"
                  ? "font-semibold text-[color:var(--danger,#B00020)]"
                  : "font-semibold text-[color:var(--warning,#8A6D00)]"
              }
            >
              {iss.code}
            </span>{" "}
            <span className="text-jrdm-text">{iss.message}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
