import { describe, it, expect } from "vitest";
import { tokens } from "./tokens";

describe("theme tokens", () => {
  it("exposes the Oracle red accent and neutral surfaces", () => {
    expect(tokens.color.accent).toBe("#C74634");
    expect(tokens.color.surface).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(tokens.color.text).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
  it("exposes cardinality edge colors for 1:1 and 1:N", () => {
    expect(tokens.edge["1:1"]).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(tokens.edge["1:N"]).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(tokens.edge["1:1"]).not.toBe(tokens.edge["1:N"]);
  });
});
