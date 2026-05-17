import { useJrdmStore } from "../state/store";

export function SyntaxToggle() {
  const syntax = useJrdmStore((s) => s.ddlSyntax);
  const setSyntax = useJrdmStore((s) => s.setDdlSyntax);

  return (
    <div className="inline-flex border border-jrdm-border rounded overflow-hidden text-xs">
      <button
        type="button"
        aria-pressed={syntax === "sql"}
        onClick={() => setSyntax("sql")}
        className={`px-2 py-1 ${syntax === "sql" ? "bg-accent text-white" : "bg-surface-alt"}`}
      >
        SQL/JSON
      </button>
      <button
        type="button"
        aria-pressed={syntax === "graphql"}
        onClick={() => setSyntax("graphql")}
        className={`px-2 py-1 ${syntax === "graphql" ? "bg-accent text-white" : "bg-surface-alt"}`}
      >
        GraphQL
      </button>
    </div>
  );
}
