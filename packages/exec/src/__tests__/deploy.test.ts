import { describe, it, expect, vi } from "vitest";
import { deployDdl, type Connection } from "../deploy";

describe("deployDdl", () => {
  it("executes statements in order and returns a result for each", async () => {
    const calls: string[] = [];
    const conn: Connection = {
      execute: vi.fn(async (sql: string) => {
        calls.push(sql);
        return { rowsAffected: 0 };
      }),
      commit: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    };
    const ddl = [
      "CREATE TABLE t (id NUMBER)",
      "CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW v AS x",
    ];
    const out = await deployDdl(conn, ddl);
    expect(calls).toEqual(ddl);
    expect(out).toEqual({ statements: 2, errors: [] });
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  it("aborts on first error and returns the error, no commit", async () => {
    const conn: Connection = {
      execute: vi.fn(async (sql: string) => {
        if (sql.includes("bad")) throw new Error("ORA-00942");
        return { rowsAffected: 0 };
      }),
      commit: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    };
    const out = await deployDdl(conn, ["CREATE TABLE t (id NUMBER)", "bad"]);
    expect(out.errors[0]).toMatchObject({
      statementIndex: 1,
      message: expect.stringContaining("ORA-00942"),
    });
    expect(out.statements).toBe(1);
    expect(conn.commit).not.toHaveBeenCalled();
  });

  it("handles non-Error throws by stringifying", async () => {
    const conn: Connection = {
      execute: vi.fn(async () => {
        throw "string error";
      }),
      commit: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    };
    const out = await deployDdl(conn, ["any"]);
    expect(out.errors[0]).toMatchObject({
      statementIndex: 0,
      message: "string error",
    });
  });
});
