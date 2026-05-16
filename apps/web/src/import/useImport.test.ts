import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useImport } from "./useImport";
import { useJrdmStore } from "../state/store";

const req = {
  connection: { user: "u", password: "p", connectString: "h:1521/FREEPDB1" },
  schemaOwner: "APP",
  projectName: "imported",
};
const payload = {
  project: { name: "imported", version: "0.1.0", entities: [], views: [] },
  relationships: [],
  issues: [],
};

describe("useImport", () => {
  beforeEach(() => useJrdmStore.getState().reset());
  afterEach(() => vi.restoreAllMocks());

  it("on success: clears error, sets store project, busy toggles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }))),
    );
    const { result } = renderHook(() => useImport());
    expect(result.current.busy).toBe(false);
    await act(async () => {
      await result.current.run(req);
    });
    await waitFor(() => expect(useJrdmStore.getState().project?.name).toBe("imported"));
    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it("on failure: sets error message, does not set project", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ message: "ORA-12541" }), { status: 502 })),
      ),
    );
    const { result } = renderHook(() => useImport());
    await act(async () => {
      await result.current.run(req);
    });
    await waitFor(() => expect(result.current.error).toContain("ORA-12541"));
    expect(useJrdmStore.getState().project).toBeNull();
  });
});
