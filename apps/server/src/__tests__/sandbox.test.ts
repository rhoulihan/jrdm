import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../app";

// Mock @jrdm/exec so unit tests never touch a real Oracle connection.
// Note: openOracleConnection is the WRITE connection for POST (createSandbox),
// openQueryConnection is used for DELETE (dropSandbox).
vi.mock("@jrdm/exec", () => ({
  openOracleConnection: vi.fn(),
  openQueryConnection: vi.fn(),
  sandboxSchemaName: vi.fn((id: string) => `JRDM_PROJ_${id.toUpperCase()}`),
  createSandbox: vi.fn(),
  dropSandbox: vi.fn(),
}));

import {
  openOracleConnection,
  openQueryConnection,
  sandboxSchemaName,
  createSandbox,
  dropSandbox,
} from "@jrdm/exec";

const VALID_CONNECTION = {
  user: "system",
  password: "secret",
  connectString: "localhost:1521/FREEPDB1",
};

beforeEach(() => {
  vi.resetAllMocks();
});

// ── POST /api/sandbox ─────────────────────────────────────────────────────────

describe("POST /api/sandbox — unit (no DB)", () => {
  it("returns 400 on missing connection", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sandbox",
      payload: { projectId: "myproj", password: "Pwd_2026" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_connection" });
    await app.close();
  });

  it("returns 400 on invalid connection (missing user)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sandbox",
      payload: {
        connection: { password: "secret", connectString: "localhost:1521/FREEPDB1" },
        projectId: "myproj",
        password: "Pwd_2026",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_connection" });
    await app.close();
  });

  it("returns 400 on missing projectId", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sandbox",
      payload: { connection: VALID_CONNECTION, password: "Pwd_2026" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_body" });
    await app.close();
  });

  it("returns 400 on missing password", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sandbox",
      payload: { connection: VALID_CONNECTION, projectId: "myproj" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_body" });
    await app.close();
  });

  it("returns { created: true, schema } on success and closes connection", async () => {
    const mockConn = {
      execute: vi.fn(),
      commit: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(openOracleConnection).mockResolvedValue(mockConn);
    vi.mocked(sandboxSchemaName).mockReturnValue("JRDM_PROJ_MYPROJ");
    vi.mocked(createSandbox).mockResolvedValue(undefined);

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sandbox",
      payload: { connection: VALID_CONNECTION, projectId: "myproj", password: "Pwd_2026" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ created: true, schema: "JRDM_PROJ_MYPROJ" });
    expect(mockConn.close).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("returns 502 sandbox_create_failed on error and closes connection", async () => {
    const mockConn = {
      execute: vi.fn(),
      commit: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(openOracleConnection).mockResolvedValue(mockConn);
    vi.mocked(sandboxSchemaName).mockReturnValue("JRDM_PROJ_MYPROJ");
    vi.mocked(createSandbox).mockRejectedValue(new Error("ORA-01920: user name conflicts"));

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/sandbox",
      payload: { connection: VALID_CONNECTION, projectId: "myproj", password: "Pwd_2026" },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: "sandbox_create_failed" });
    expect(mockConn.close).toHaveBeenCalledTimes(1);
    await app.close();
  });
});

// ── DELETE /api/sandbox ───────────────────────────────────────────────────────

describe("DELETE /api/sandbox — unit (no DB)", () => {
  it("returns 400 on missing connection", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/sandbox",
      payload: { projectId: "myproj" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_connection" });
    await app.close();
  });

  it("returns 400 on invalid connection (missing password)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/sandbox",
      payload: {
        connection: { user: "system", connectString: "localhost:1521/FREEPDB1" },
        projectId: "myproj",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_connection" });
    await app.close();
  });

  it("returns 400 on missing projectId", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/sandbox",
      payload: { connection: VALID_CONNECTION },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_body" });
    await app.close();
  });

  it("returns { dropped: true, schema } on success and closes connection", async () => {
    const mockQc = {
      query: vi.fn(),
      execute: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(openQueryConnection).mockResolvedValue(mockQc);
    vi.mocked(sandboxSchemaName).mockReturnValue("JRDM_PROJ_MYPROJ");
    vi.mocked(dropSandbox).mockResolvedValue(undefined);

    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/sandbox",
      payload: { connection: VALID_CONNECTION, projectId: "myproj" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ dropped: true, schema: "JRDM_PROJ_MYPROJ" });
    expect(mockQc.close).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("returns { dropped: true, schema } on idempotent second delete (dropSandbox is a no-op)", async () => {
    const mockQc = {
      query: vi.fn(),
      execute: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(openQueryConnection).mockResolvedValue(mockQc);
    vi.mocked(sandboxSchemaName).mockReturnValue("JRDM_PROJ_MYPROJ");
    // dropSandbox swallows ORA-01918 internally — it resolves even for non-existent schemas
    vi.mocked(dropSandbox).mockResolvedValue(undefined);

    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/sandbox",
      payload: { connection: VALID_CONNECTION, projectId: "myproj" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ dropped: true, schema: "JRDM_PROJ_MYPROJ" });
    expect(mockQc.close).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("returns 502 sandbox_drop_failed on non-idempotent error and closes connection", async () => {
    const mockQc = {
      query: vi.fn(),
      execute: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(openQueryConnection).mockResolvedValue(mockQc);
    vi.mocked(sandboxSchemaName).mockReturnValue("JRDM_PROJ_MYPROJ");
    vi.mocked(dropSandbox).mockRejectedValue(new Error("ORA-01031: insufficient privileges"));

    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/sandbox",
      payload: { connection: VALID_CONNECTION, projectId: "myproj" },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: "sandbox_drop_failed" });
    expect(mockQc.close).toHaveBeenCalledTimes(1);
    await app.close();
  });
});
