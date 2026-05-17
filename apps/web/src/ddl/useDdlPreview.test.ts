import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDdlPreview } from "./useDdlPreview";
import { useJrdmStore } from "../state/store";

const view = {
  name: "orders_dv",
  schema: "app",
  createMode: "orReplace" as const,
  root: {
    table: "orders",
    permissions: { insert: true, update: true, delete: true },
    etag: "check" as const,
  },
  fields: [{ key: "_id", source: "orders.id" }],
};

describe("useDdlPreview", () => {
  beforeEach(() => useJrdmStore.getState().reset());
  afterEach(() => vi.restoreAllMocks());

  it("idle when there is no editingView", () => {
    const { result } = renderHook(() => useDdlPreview());
    expect(result.current).toEqual({ ddl: "", kind: "sql", busy: false, error: null });
  });

  it("fetches and exposes ddl when editingView is set (sql)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ sql: "CREATE X" }), { status: 200 })),
      ),
    );
    const { result } = renderHook(() => useDdlPreview());
    act(() => useJrdmStore.getState().setEditingView(view));
    await waitFor(() => expect(result.current.ddl).toBe("CREATE X"));
    expect(result.current.kind).toBe("sql");
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("re-fetches as graphql when ddlSyntax flips", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ sql: "CREATE X" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ graphql: "orders { }" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useDdlPreview());
    act(() => useJrdmStore.getState().setEditingView(view));
    await waitFor(() => expect(result.current.ddl).toBe("CREATE X"));
    act(() => useJrdmStore.getState().setDdlSyntax("graphql"));
    await waitFor(() => expect(result.current.ddl).toBe("orders { }"));
    expect(result.current.kind).toBe("graphql");
  });

  it("exposes error on 422", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ error: "unsupported_view", message: "MissingLinkError: x" }),
            {
              status: 422,
            },
          ),
        ),
      ),
    );
    const { result } = renderHook(() => useDdlPreview());
    act(() => useJrdmStore.getState().setEditingView(view));
    await waitFor(() => expect(result.current.error).toContain("MissingLinkError"));
    expect(result.current.ddl).toBe("");
  });
});
