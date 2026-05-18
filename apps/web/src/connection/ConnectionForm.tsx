import { useState } from "react";
import { useJrdmStore } from "../state/store";
import { listSchemas, ApiError } from "../api/client";
import type { ImportRequest } from "../api/client";

export function ConnectionForm({
  onSubmit,
  busy,
}: {
  onSubmit: (req: ImportRequest) => void;
  busy: boolean;
}) {
  const setConnection = useJrdmStore((s) => s.setConnection);
  const schemas = useJrdmStore((s) => s.schemas);
  const selectedSchema = useJrdmStore((s) => s.selectedSchema);
  const schemaLoad = useJrdmStore((s) => s.schemaLoad);
  const setSchemas = useJrdmStore((s) => s.setSchemas);
  const selectSchema = useJrdmStore((s) => s.selectSchema);
  const setSchemaLoad = useJrdmStore((s) => s.setSchemaLoad);

  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [connectString, setConnectString] = useState("");
  const [projectName, setProjectName] = useState("imported");
  const [connectError, setConnectError] = useState<string | null>(null);

  const connectionFilled =
    user.trim() !== "" && password.trim() !== "" && connectString.trim() !== "";

  const connectDisabled = !connectionFilled || schemaLoad === "loading";
  const ready = connectionFilled && selectedSchema !== null && !busy;

  async function handleConnect() {
    setConnectError(null);
    setSchemaLoad("loading");
    try {
      const result = await listSchemas({ user, password, connectString });
      setSchemas(result);
      selectSchema(result[0] ?? null);
      setSchemaLoad("idle");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
      setConnectError(msg);
      setSchemaLoad("error");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSchema) return;
    setConnection({ user, password, connectString, schemaOwner: selectedSchema, projectName });
    onSubmit({
      connection: { user, password, connectString },
      schemaOwner: selectedSchema,
      projectName,
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 p-4 bg-surface-alt border-b border-jrdm-border"
    >
      <h2 className="text-jrdm-text font-semibold">Import Oracle Schema</h2>
      <Field label="User" value={user} onChange={setUser} />
      <Field label="Password" value={password} onChange={setPassword} type="password" />
      <Field
        label="Connect String"
        value={connectString}
        onChange={setConnectString}
        placeholder="host:1521/FREEPDB1"
      />
      <button
        type="button"
        data-testid="form-connect-btn"
        disabled={connectDisabled}
        onClick={() => {
          void handleConnect();
        }}
        className="bg-secondary text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {schemaLoad === "loading" ? "Connecting…" : "Connect"}
      </button>
      {connectError && (
        <p data-testid="connect-error" className="text-red-500 text-sm">
          {connectError}
        </p>
      )}
      <label htmlFor="schema-select" className="flex flex-col gap-1 text-sm text-jrdm-text">
        Schema
        <select
          id="schema-select"
          data-testid="schema-select"
          value={selectedSchema ?? ""}
          onChange={(e) => selectSchema(e.target.value || null)}
          className="border border-jrdm-border rounded px-2 py-1"
        >
          {schemas.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <Field label="Project Name" value={projectName} onChange={setProjectName} />
      <button
        type="submit"
        disabled={!ready}
        className="bg-accent text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {busy ? "Importing…" : "Import"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const id = `f-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-sm text-jrdm-text">
      {label}
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="border border-jrdm-border rounded px-2 py-1"
      />
    </label>
  );
}
