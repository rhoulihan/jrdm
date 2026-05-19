import { describe, it, expect } from "vitest";
import { TABLES_SQL, COLUMNS_SQL, PK_UK_SQL, FK_SQL } from "../dictionary-sql";

describe("dictionary SQL constants", () => {
  it("query the ALL_* data-dictionary views (not USER_* — USER_* ignores the selected schema owner)", () => {
    expect(TABLES_SQL).toContain("ALL_TABLES");
    expect(COLUMNS_SQL).toContain("ALL_TAB_COLUMNS");
    expect(PK_UK_SQL).toContain("ALL_CONSTRAINTS");
    expect(PK_UK_SQL).toContain("ALL_CONS_COLUMNS");
    expect(FK_SQL).toContain("ALL_CONSTRAINTS");
    expect(FK_SQL).toContain("ALL_CONS_COLUMNS");

    // Regression guard: USER_* views silently ignore the schemaOwner bind and
    // always return the connected user's own objects — exactly the bug this fixes.
    expect(TABLES_SQL).not.toContain("USER_TABLES");
    expect(COLUMNS_SQL).not.toContain("USER_TAB_COLUMNS");
    expect(PK_UK_SQL).not.toContain("USER_CONSTRAINTS");
    expect(PK_UK_SQL).not.toContain("USER_CONS_COLUMNS");
    expect(FK_SQL).not.toContain("USER_CONSTRAINTS");
    expect(FK_SQL).not.toContain("USER_CONS_COLUMNS");
  });

  it("all four import queries filter by :owner bind (schema-owner correctness)", () => {
    expect(TABLES_SQL).toContain(":owner");
    expect(COLUMNS_SQL).toContain(":owner");
    expect(PK_UK_SQL).toContain(":owner");
    expect(FK_SQL).toContain(":owner");
  });

  it("order columns deterministically for stable mapping", () => {
    expect(COLUMNS_SQL).toContain("ORDER BY");
    expect(COLUMNS_SQL.toUpperCase()).toContain("COLUMN_ID");
  });

  it("restrict PK/UK query to P and U constraint types", () => {
    expect(PK_UK_SQL).toMatch(/CONSTRAINT_TYPE\s+IN\s*\(\s*'P'\s*,\s*'U'\s*\)/);
  });

  it("restrict FK query to R constraint type", () => {
    expect(FK_SQL).toMatch(/CONSTRAINT_TYPE\s*=\s*'R'/);
  });

  it("FK query emits the REF_TABLE, REF_COLUMN, REF_POSITION, REF_OWNER aliases expected by map.ts", () => {
    expect(FK_SQL).toContain("REF_TABLE");
    expect(FK_SQL).toContain("REF_COLUMN");
    expect(FK_SQL).toContain("REF_POSITION");
    expect(FK_SQL).toContain("REF_OWNER");
  });
});
