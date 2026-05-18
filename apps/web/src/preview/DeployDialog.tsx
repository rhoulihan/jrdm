import { useJrdmStore } from "../state/store";
import { deployView, ApiError } from "../api/client";
import type { OracleConn } from "../api/client";

export function DeployDialog() {
  const editingView = useJrdmStore((s) => s.editingView);
  const connection = useJrdmStore((s) => s.connection);
  const setConnection = useJrdmStore((s) => s.setConnection);
  const deployState = useJrdmStore((s) => s.deployState);
  const deployMessage = useJrdmStore((s) => s.deployMessage);
  const setDeployState = useJrdmStore((s) => s.setDeployState);

  const isDeploying = deployState === "deploying";
  const isDisabled = isDeploying || editingView === null;

  function handleDeploy(e: React.FormEvent) {
    e.preventDefault();
    if (!editingView) return;

    const conn: OracleConn = {
      user: connection.user,
      password: connection.password,
      connectString: connection.connectString,
    };

    setDeployState("deploying");
    deployView(editingView, conn, undefined)
      .then((result) => {
        setDeployState("deployed", `${result.statements ?? 0} statements`);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          setDeployState("error", err.message);
        } else {
          setDeployState("error", String(err));
        }
      });
  }

  return (
    <form
      onSubmit={handleDeploy}
      className="flex flex-col gap-3 p-4 bg-surface-alt border-b border-jrdm-border"
    >
      <h2 className="text-jrdm-text font-semibold">Deploy View</h2>
      <Field label="User" value={connection.user} onChange={(v) => setConnection({ user: v })} />
      <Field
        label="Password"
        value={connection.password}
        onChange={(v) => setConnection({ password: v })}
        type="password"
      />
      <Field
        label="Connect String"
        value={connection.connectString}
        onChange={(v) => setConnection({ connectString: v })}
        placeholder="host:1521/FREEPDB1"
      />
      <button
        type="submit"
        data-testid="dialog-deploy-btn"
        disabled={isDisabled}
        className="bg-accent text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {isDeploying ? "Deploying…" : "Deploy"}
      </button>
      {deployState === "deployed" && (
        <p data-testid="deploy-success" className="text-sm text-green-600">
          {deployMessage}
        </p>
      )}
      {deployState === "error" && (
        <p data-testid="deploy-error" className="text-sm text-red-600">
          {deployMessage}
        </p>
      )}
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
  const id = `deploy-f-${label.toLowerCase().replace(/\s+/g, "-")}`;
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
