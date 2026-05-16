import { useJrdmStore } from "../state/store";

export function Inspector() {
  const project = useJrdmStore((s) => s.project);
  const selected = useJrdmStore((s) => s.selectedEntity);

  const entity =
    project && selected
      ? project.entities.find((e) => `${e.schema}.${e.name}` === selected)
      : undefined;

  if (!entity) {
    return (
      <div data-testid="inspector-empty" className="p-4 text-jrdm-muted text-sm">
        Select an entity to inspect it.
      </div>
    );
  }

  return (
    <div className="p-4 text-sm text-jrdm-text overflow-auto h-full">
      <h2 className="font-semibold mb-2">
        {entity.schema}.{entity.name}
      </h2>
      <table className="w-full mb-3">
        <tbody>
          {entity.columns.map((c) => (
            <tr key={c.name} className="border-t border-jrdm-border">
              <td className="py-0.5">{c.name}</td>
              <td className="py-0.5 text-jrdm-muted">
                {c.type}
                {c.length ? `(${c.length})` : ""} {c.nullable ? "NULL" : "NOT NULL"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p data-testid="inspector-pk" className="mb-1">
        <strong>PK:</strong> <span>{entity.primaryKey.join(", ") || "(none)"}</span>
      </p>
      {entity.uniqueKeys && entity.uniqueKeys.length > 0 && (
        <p className="mb-1">
          <strong>Unique:</strong>{" "}
          <span>{entity.uniqueKeys.map((uk) => `(${uk.join(", ")})`).join("  ")}</span>
        </p>
      )}
      <div data-testid="inspector-fk">
        <strong>FKs:</strong>
        {(entity.foreignKeys ?? []).length === 0 ? (
          " (none)"
        ) : (
          <ul className="list-disc ml-5">
            {(entity.foreignKeys ?? []).map((fk) => (
              <li key={fk.name}>
                {fk.name}: ({fk.columns.join(", ")}) → {fk.references.table}(
                {fk.references.columns.join(", ")})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
