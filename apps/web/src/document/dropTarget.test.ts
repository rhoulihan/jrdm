import { describe, it, expect } from "vitest";
import { parseDragPayload, DRAG_MIME } from "./dropTarget";

describe("dropTarget", () => {
  it("DRAG_MIME is a stable custom type", () => {
    expect(DRAG_MIME).toBe("application/x-jrdm-column");
  });
  it("parseDragPayload reads {table,column} JSON", () => {
    expect(parseDragPayload(JSON.stringify({ table: "orders", column: "order_status" }))).toEqual({
      table: "orders",
      column: "order_status",
    });
  });
  it("parseDragPayload returns null on garbage", () => {
    expect(parseDragPayload("not json")).toBeNull();
    expect(parseDragPayload(JSON.stringify({ table: "orders" }))).toBeNull();
  });
});
