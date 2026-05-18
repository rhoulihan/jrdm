import { describe, it, expect } from "vitest";
import { listSchemas, LIST_SCHEMAS_SQL } from "../list-schemas";
import type { QueryExec } from "../import-schema";

describe("listSchemas", () => {
  it("issues exactly LIST_SCHEMAS_SQL", async () => {
    const calls: string[] = [];
    // eslint-disable-next-line @typescript-eslint/require-await
    const exec: QueryExec = async <T>(sql: string): Promise<T[]> => {
      calls.push(sql);
      return [] as T[];
    };
    await listSchemas(exec);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(LIST_SCHEMAS_SQL);
  });

  it("maps rows to a sorted string[] of schema names", async () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    const exec: QueryExec = async <T>(_sql: string): Promise<T[]> =>
      [{ SCHEMA_NAME: "ZAPP" }, { SCHEMA_NAME: "APP" }, { SCHEMA_NAME: "SALES" }] as T[];
    const result = await listSchemas(exec);
    expect(result).toEqual(["APP", "SALES", "ZAPP"]);
  });

  it("filters blank/falsy schema names", async () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    const exec: QueryExec = async <T>(_sql: string): Promise<T[]> =>
      [{ SCHEMA_NAME: "APP" }, { SCHEMA_NAME: "" }, { SCHEMA_NAME: "SALES" }] as T[];
    const result = await listSchemas(exec);
    expect(result).toEqual(["APP", "SALES"]);
  });

  it("returns empty array when no schemas found", async () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    const exec: QueryExec = async <T>(_sql: string): Promise<T[]> => [] as T[];
    const result = await listSchemas(exec);
    expect(result).toEqual([]);
  });

  it("sorts results regardless of the order returned by Oracle", async () => {
    // eslint-disable-next-line @typescript-eslint/require-await
    const exec: QueryExec = async <T>(_sql: string): Promise<T[]> =>
      [{ SCHEMA_NAME: "ZEBRA" }, { SCHEMA_NAME: "ALPHA" }, { SCHEMA_NAME: "MANGO" }] as T[];
    const result = await listSchemas(exec);
    expect(result).toEqual(["ALPHA", "MANGO", "ZEBRA"]);
  });
});
