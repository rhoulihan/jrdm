import { useState } from "react";
import { useJrdmStore } from "../state/store";
import type { ImportRequest } from "../api/client";

export function ConnectionForm({
  onSubmit,
  busy,
}: {
  onSubmit: (req: ImportRequest) => void;
  busy: boolean;
}) {
  const setConnection = useJrdmStore((s) => s.setConnection);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [connectString, setConnectString] = useState("");
  const [schemaOwner, setSchemaOwner] = useState("");
  const [projectName, setProjectName] = useState("imported");

  const ready =
    user.trim() !== "" &&
    password.trim() !== "" &&
    connectString.trim() !== "" &&
    schemaOwner.trim() !== "";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setConnection({ user, password, connectString, schemaOwner, projectName });
    onSubmit({
      connection: { user, password, connectString },
      schemaOwner,
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
      <Field label="Schema Owner" value={schemaOwner} onChange={setSchemaOwner} placeholder="APP" />
      <Field label="Project Name" value={projectName} onChange={setProjectName} />
      <button
        type="submit"
        disabled={!ready || busy}
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
