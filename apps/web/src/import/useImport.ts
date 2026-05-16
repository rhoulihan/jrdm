import { useState, useCallback } from "react";
import { importOracle, ApiError, type ImportRequest } from "../api/client";
import { useJrdmStore } from "../state/store";

export function useImport() {
  const setImport = useJrdmStore((s) => s.setImport);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (req: ImportRequest) => {
      setBusy(true);
      setError(null);
      try {
        const payload = await importOracle(req);
        setImport(payload);
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
        setError(msg);
      } finally {
        setBusy(false);
      }
    },
    [setImport],
  );

  return { run, busy, error };
}
