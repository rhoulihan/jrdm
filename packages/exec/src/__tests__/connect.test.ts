import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock oracledb so this unit test never touches a real database
vi.mock("oracledb", () => ({
  default: {
    getConnection: vi.fn(),
  },
}));

import oracledb from "oracledb";
import { openOracleConnection } from "../connect";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("openOracleConnection", () => {
  it("wraps an oracledb connection into a Connection interface", async () => {
    const mockOraConn = {
      execute: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
      commit: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(oracledb.getConnection).mockResolvedValue(mockOraConn as never);

    const conn = await openOracleConnection({
      user: "system",
      password: "secret",
      connectString: "localhost:1521/FREEPDB1",
    });

    // execute delegates to oracledb with autoCommit:false
    const result = await conn.execute("SELECT 1 FROM dual");
    expect(mockOraConn.execute).toHaveBeenCalledWith("SELECT 1 FROM dual", [], {
      autoCommit: false,
    });
    expect(result).toEqual({ rowsAffected: 1 });

    // commit and close delegate to oracledb
    await conn.commit();
    expect(mockOraConn.commit).toHaveBeenCalledTimes(1);

    await conn.close();
    expect(mockOraConn.close).toHaveBeenCalledTimes(1);
  });

  it("defaults rowsAffected to 0 when oracledb returns undefined", async () => {
    const mockOraConn = {
      execute: vi.fn().mockResolvedValue({ rowsAffected: undefined }),
      commit: vi.fn(),
      close: vi.fn(),
    };
    vi.mocked(oracledb.getConnection).mockResolvedValue(mockOraConn as never);

    const conn = await openOracleConnection({
      user: "u",
      password: "p",
      connectString: "cs",
    });
    const result = await conn.execute("any sql");
    expect(result.rowsAffected).toBe(0);

    await conn.close();
  });

  it("passes connection params to oracledb.getConnection", async () => {
    const mockOraConn = { execute: vi.fn(), commit: vi.fn(), close: vi.fn() };
    vi.mocked(oracledb.getConnection).mockResolvedValue(mockOraConn as never);

    await openOracleConnection({ user: "u", password: "p", connectString: "h:1521/s" });
    expect(oracledb.getConnection).toHaveBeenCalledWith({
      user: "u",
      password: "p",
      connectString: "h:1521/s",
    });
  });
});
