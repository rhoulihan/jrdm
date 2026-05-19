// @tested-by: apps/web/src/diagram/canMapToDocument.ts
import { describe, it, expect } from "vitest";
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

describe("canMapToDocument", () => {
  it("returns false when editingView is null", () => {
    expect(canMapToDocument(null)).toBe(false);
  });

  it("returns true for a minimal valid DualityView", () => {
    expect(canMapToDocument(MINIMAL_VIEW)).toBe(true);
  });
});
