import { describe, it, expect } from "vitest";
import { TABLES_SQL, COLUMNS_SQL, PK_UK_SQL, FK_SQL } from "../dictionary-sql";

describe("dictionary SQL constants", () => {
  it("query the user-owned data dictionary views only", () => {
    expect(TABLES_SQL).toContain("USER_TABLES");
    expect(COLUMNS_SQL).toContain("USER_TAB_COLUMNS");
    expect(PK_UK_SQL).toContain("USER_CONSTRAINTS");
    expect(PK_UK_SQL).toContain("USER_CONS_COLUMNS");
    expect(FK_SQL).toContain("USER_CONSTRAINTS");
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
});
