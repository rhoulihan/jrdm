import { describe, it, expect } from "vitest";
import { validateEntity } from "../rules";
import type { Entity } from "@jrdm/model";

const base: Entity = {
  name: "orders",
  schema: "app",
  columns: [{ name: "order_id", type: "NUMBER", nullable: false }],
  primaryKey: ["order_id"],
};

describe("validateEntity", () => {
  it("reports no issues on a valid entity", () => {
    expect(validateEntity(base)).toEqual([]);
  });

  it("flags entities used as a duality view root without a PK", () => {
    const noPk = { ...base, primaryKey: [] as string[] };
    const issues = validateEntity(noPk);
    expect(issues).toContainEqual(
      expect.objectContaining({ code: "PK_REQUIRED", severity: "error" }),
    );
  });

  it("flags duplicated column names", () => {
    const dup = {
      ...base,
      columns: [
        { name: "order_id", type: "NUMBER" as const, nullable: false },
        { name: "order_id", type: "VARCHAR2" as const, nullable: true },
      ],
    };
    const issues = validateEntity(dup);
    expect(issues).toContainEqual(
      expect.objectContaining({ code: "DUPLICATE_COLUMN", severity: "error" }),
    );
  });
});

describe("validateEntity — supported types", () => {
  it("accepts every documented supported type via the Zod schema upstream", () => {
    const e = {
      ...base,
      columns: [
        { name: "n", type: "NUMBER" as const, nullable: false },
        { name: "j", type: "JSON" as const, nullable: true },
        { name: "v", type: "VECTOR" as const, nullable: true },
      ],
    };
    const issues = validateEntity(e);
    expect(issues.filter((i) => i.code === "UNSUPPORTED_TYPE")).toEqual([]);
  });
});
