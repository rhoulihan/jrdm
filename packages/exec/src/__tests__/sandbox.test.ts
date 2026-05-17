import { describe, it, expect } from "vitest";
import { sandboxSchemaName, createSandboxDdl, dropSandboxDdl } from "../sandbox";

describe("sandboxSchemaName", () => {
  it("prefixes with JRDM_PROJ_ and uppercases", () => {
    expect(sandboxSchemaName("myproject")).toBe("JRDM_PROJ_MYPROJECT");
  });

  it('strips non-alphanumeric/underscore chars ("My Proj!" → JRDM_PROJ_MYPROJ)', () => {
    expect(sandboxSchemaName("My Proj!")).toBe("JRDM_PROJ_MYPROJ");
  });

  it("clamps result to 30 chars (Oracle identifier limit)", () => {
    // 'A' repeated 30 chars → prefix is 10 chars → only 20 of the 30 A's fit
    const long = "A".repeat(30);
    const result = sandboxSchemaName(long);
    expect(result.length).toBeLessThanOrEqual(30);
    expect(result).toBe(("JRDM_PROJ_" + long).slice(0, 30));
  });

  it("result is letter-led (prefix JRDM_ guarantees it)", () => {
    const name = sandboxSchemaName("123project");
    expect(name).toMatch(/^[A-Z]/);
  });

  it("handles underscores in projectId", () => {
    expect(sandboxSchemaName("my_project")).toBe("JRDM_PROJ_MY_PROJECT");
  });

  it("handles empty string", () => {
    expect(sandboxSchemaName("")).toBe("JRDM_PROJ_");
  });
});

describe("createSandboxDdl", () => {
  it("returns exact two DDL statements", () => {
    const ddl = createSandboxDdl("JRDM_PROJ_FOO", "secret123");
    expect(ddl).toEqual([
      `CREATE USER "JRDM_PROJ_FOO" IDENTIFIED BY "secret123"`,
      `GRANT CONNECT, RESOURCE, UNLIMITED TABLESPACE TO "JRDM_PROJ_FOO"`,
    ]);
  });
});

describe("dropSandboxDdl", () => {
  it("returns exact DROP USER CASCADE statement", () => {
    const ddl = dropSandboxDdl("JRDM_PROJ_FOO");
    expect(ddl).toEqual([`DROP USER "JRDM_PROJ_FOO" CASCADE`]);
  });
});
