import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock oracledb so this unit test never touches a real database
vi.mock("oracledb", () => ({
  default: {
    getConnection: vi.fn(),
    OUT_FORMAT_OBJECT: 4001,
  },
}));

import oracledb from "oracledb";
import { openQueryConnection } from "../query";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("openQueryConnection", () => {
  it("query returns rows as objects", async () => {
    const mockRows = [{ N: 1 }];
    const mockOraConn = {
      execute: vi.fn().mockResolvedValue({ rows: mockRows }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(oracledb.getConnection).mockResolvedValue(mockOraConn as never);

    const qc = await openQueryConnection({
      user: "system",
      password: "secret",
      connectString: "localhost:1521/FREEPDB1",
    });

    const rows = await qc.query<{ N: number }>("SELECT 1 AS n FROM dual");
    expect(mockOraConn.execute).toHaveBeenCalledWith(
      "SELECT 1 AS n FROM dual",
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    expect(rows).toEqual(mockRows);
  });

  it("query defaults rows to [] when oracledb returns undefined rows", async () => {
    const mockOraConn = {
      execute: vi.fn().mockResolvedValue({ rows: undefined }),
      close: vi.fn(),
    };
    vi.mocked(oracledb.getConnection).mockResolvedValue(mockOraConn as never);

    const qc = await openQueryConnection({ user: "u", password: "p", connectString: "cs" });
    const rows = await qc.query("SELECT 1 FROM dual");
    expect(rows).toEqual([]);
  });

  it("query passes bind variables to oracledb", async () => {
    const mockOraConn = {
      execute: vi.fn().mockResolvedValue({ rows: [{ VAL: "hello" }] }),
      close: vi.fn(),
    };
    vi.mocked(oracledb.getConnection).mockResolvedValue(mockOraConn as never);

    const qc = await openQueryConnection({ user: "u", password: "p", connectString: "cs" });
    await qc.query("SELECT :v AS val FROM dual", { v: "hello" });
    expect(mockOraConn.execute).toHaveBeenCalledWith(
      "SELECT :v AS val FROM dual",
      { v: "hello" },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
  });

  it("execute returns rowsAffected with autoCommit:true", async () => {
    const mockOraConn = {
      execute: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
      close: vi.fn(),
    };
    vi.mocked(oracledb.getConnection).mockResolvedValue(mockOraConn as never);

    const qc = await openQueryConnection({ user: "u", password: "p", connectString: "cs" });
    const affected = await qc.execute("INSERT INTO t VALUES (1)");
    expect(mockOraConn.execute).toHaveBeenCalledWith(
      "INSERT INTO t VALUES (1)",
      {},
      {
        autoCommit: true,
      },
    );
    expect(affected).toBe(1);
  });

  it("execute defaults rowsAffected to 0 when oracledb returns undefined", async () => {
    const mockOraConn = {
      execute: vi.fn().mockResolvedValue({ rowsAffected: undefined }),
      close: vi.fn(),
    };
    vi.mocked(oracledb.getConnection).mockResolvedValue(mockOraConn as never);

    const qc = await openQueryConnection({ user: "u", password: "p", connectString: "cs" });
    const affected = await qc.execute("any sql");
    expect(affected).toBe(0);
  });

  it("close delegates to oracledb connection close", async () => {
    const mockOraConn = {
      execute: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(oracledb.getConnection).mockResolvedValue(mockOraConn as never);

    const qc = await openQueryConnection({ user: "u", password: "p", connectString: "cs" });
    await qc.close();
    expect(mockOraConn.close).toHaveBeenCalledTimes(1);
  });

  it("passes connection params to oracledb.getConnection", async () => {
    const mockOraConn = { execute: vi.fn(), close: vi.fn() };
    vi.mocked(oracledb.getConnection).mockResolvedValue(mockOraConn as never);

    await openQueryConnection({ user: "u", password: "p", connectString: "h:1521/s" });
    expect(oracledb.getConnection).toHaveBeenCalledWith({
      user: "u",
      password: "p",
      connectString: "h:1521/s",
    });
  });
});
