import { describe, it, expect } from "vitest";
import { sampleQuery, parseSampleRows, SampleParseError } from "../sample";

describe("sampleQuery", () => {
  it("builds a clamped JSON_SERIALIZE query", () => {
    expect(sampleQuery("app", "orders_dv", 5)).toBe(
      "SELECT JSON_SERIALIZE(data PRETTY) AS DOC FROM app.orders_dv FETCH FIRST 5 ROWS ONLY",
    );
    expect(sampleQuery("app", "orders_dv", 999)).toContain("FETCH FIRST 50 ROWS ONLY");
    expect(sampleQuery("app", "orders_dv", 0)).toContain("FETCH FIRST 1 ROWS ONLY");
  });

  it("clamps negative values to 1", () => {
    expect(sampleQuery("app", "orders_dv", -10)).toContain("FETCH FIRST 1 ROWS ONLY");
  });

  it("clamps exactly 50 as-is", () => {
    expect(sampleQuery("app", "orders_dv", 50)).toContain("FETCH FIRST 50 ROWS ONLY");
  });

  it("truncates fractional values", () => {
    expect(sampleQuery("app", "orders_dv", 5.9)).toContain("FETCH FIRST 5 ROWS ONLY");
  });

  it("builds the full SQL string with correct schema and view name", () => {
    const sql = sampleQuery("myschema", "my_dv", 10);
    expect(sql).toBe(
      "SELECT JSON_SERIALIZE(data PRETTY) AS DOC FROM myschema.my_dv FETCH FIRST 10 ROWS ONLY",
    );
  });
});

describe("parseSampleRows", () => {
  it("parses serialized docs", () => {
    expect(parseSampleRows([{ DOC: '{"_id":1}' }])).toEqual([{ _id: 1 }]);
  });

  it("parses multiple rows", () => {
    const rows = [{ DOC: '{"_id":1,"name":"a"}' }, { DOC: '{"_id":2,"name":"b"}' }];
    expect(parseSampleRows(rows)).toEqual([
      { _id: 1, name: "a" },
      { _id: 2, name: "b" },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(parseSampleRows([])).toEqual([]);
  });

  it("throws SampleParseError for invalid JSON", () => {
    expect(() => parseSampleRows([{ DOC: "not-valid-json" }])).toThrow(SampleParseError);
  });

  it("SampleParseError has correct name", () => {
    let err: unknown;
    try {
      parseSampleRows([{ DOC: "{bad" }]);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SampleParseError);
    expect((err as SampleParseError).name).toBe("SampleParseError");
  });

  it("SampleParseError message includes SampleParseError prefix", () => {
    let err: unknown;
    try {
      parseSampleRows([{ DOC: "{bad" }]);
    } catch (e) {
      err = e;
    }
    expect((err as SampleParseError).message).toMatch(/SampleParseError/);
  });
});
