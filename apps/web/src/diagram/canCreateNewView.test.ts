// @tested-by: apps/web/src/diagram/canCreateNewView.ts
import { describe, it, expect } from "vitest";
import { canCreateNewView } from "./canCreateNewView";
import { canMapToDocument } from "./canMapToDocument";
import type { DualityView } from "@jrdm/model";

/** Minimal valid DualityView that satisfies the Zod schema */
const MINIMAL_VIEW: DualityView = {
  name: "order_dv",
  schema: "HR",
  createMode: "create",
  root: {
    table: "ORDERS",
    permissions: { insert: true, update: true, delete: false },
    etag: "check",
  },
  fields: [{ key: "_id", source: "ORDER_ID" }],
};

describe("canCreateNewView", () => {
  it("returns true when editingView is null (no view yet — new-view allowed)", () => {
    expect(canCreateNewView(null)).toBe(true);
  });

  it("returns false for a minimal valid DualityView (view exists — new-view disabled)", () => {
    expect(canCreateNewView(MINIMAL_VIEW)).toBe(false);
  });

  it("is the strict complement of canMapToDocument for null", () => {
    expect(canCreateNewView(null)).toBe(!canMapToDocument(null));
  });

  it("is the strict complement of canMapToDocument for a valid view", () => {
    expect(canCreateNewView(MINIMAL_VIEW)).toBe(!canMapToDocument(MINIMAL_VIEW));
  });
});
