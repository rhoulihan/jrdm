// @tested-by: apps/web/src/__tests__/smoke.spec.ts
import { useEffect, useState } from "react";

const SAMPLE_VIEW = {
  name: "orders_dv",
  schema: "app",
  createMode: "orReplace",
  root: {
    table: "orders",
    permissions: { insert: true, update: true, delete: true },
    etag: "check",
  },
  fields: [
    { key: "_id", source: "orders.order_id" },
    { key: "orderTime", source: "orders.order_datetime" },
    { key: "orderStatus", source: "orders.order_status" },
  ],
};

export function App() {
  const [status, setStatus] = useState("loading...");
  const [ddl, setDdl] = useState("");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((j: { status: string; version: string }) => setStatus(`${j.status} (v${j.version})`))
      .catch(() => setStatus("offline"));
  }, []);

  async function generate() {
    const res = await fetch("/api/ddl/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ view: SAMPLE_VIEW }),
    });
    const json = (await res.json()) as { sql: string };
    setDdl(json.sql);
  }

  return (
    <main>
      <h1>JRDM v0.1</h1>
      <p data-testid="status">Server: {status}</p>
      <button
        onClick={() => {
          void generate();
        }}
      >
        Generate DDL
      </button>
      <pre data-testid="ddl-pane">{ddl}</pre>
    </main>
  );
}
