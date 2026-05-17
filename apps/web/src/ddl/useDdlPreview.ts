import { useEffect, useRef, useState } from "react";
import { useJrdmStore } from "../state/store";
import { fetchDdlPreview, ApiError } from "../api/client";

export interface DdlPreviewState {
  ddl: string;
  kind: "sql" | "graphql";
  busy: boolean;
  error: string | null;
}

export function useDdlPreview(): DdlPreviewState {
  const view = useJrdmStore((s) => s.editingView);
  const syntax = useJrdmStore((s) => s.ddlSyntax);
  const [state, setState] = useState<DdlPreviewState>({
    ddl: "",
    kind: "sql",
    busy: false,
    error: null,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!view) {
      setState({ ddl: "", kind: syntax, busy: false, error: null });
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setState((s) => ({ ...s, busy: true }));
    let cancelled = false;
    timer.current = setTimeout(() => {
      fetchDdlPreview(view, syntax)
        .then((r) => {
          if (cancelled) return;
          setState({ ddl: r.ddl, kind: r.kind, busy: false, error: null });
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          const msg =
            e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
          setState({ ddl: "", kind: syntax, busy: false, error: msg });
        });
    }, 150);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [view, syntax]);

  return state;
}
