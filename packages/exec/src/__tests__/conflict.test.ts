import { describe, it, expect } from "vitest";
import { isEtagConflict } from "../conflict";

describe("isEtagConflict", () => {
  it("returns true for an Error containing ORA-42699", () => {
    expect(isEtagConflict(new Error("ORA-42699: etag mismatch on duality view update"))).toBe(true);
  });

  it("returns true for an Error with ORA-42699 embedded in a longer message", () => {
    expect(
      isEtagConflict(new Error("Error updating row: ORA-42699: The etag provided does not match")),
    ).toBe(true);
  });

  it("returns false for an unrelated ORA error", () => {
    expect(isEtagConflict(new Error("ORA-01918: user does not exist"))).toBe(false);
  });

  it("returns false for a generic error", () => {
    expect(isEtagConflict(new Error("something went wrong"))).toBe(false);
  });

  it("returns false for a non-Error string", () => {
    expect(isEtagConflict("ORA-42699")).toBe(true);
    expect(isEtagConflict("some other string")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isEtagConflict(null)).toBe(false);
    expect(isEtagConflict(undefined)).toBe(false);
  });
});
