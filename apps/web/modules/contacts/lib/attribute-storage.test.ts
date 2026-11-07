import { describe, expect, test } from "vitest";
import { readAttributeValue } from "./attribute-storage";

describe("readAttributeValue", () => {
  test("reads text as stored", () => {
    expect(readAttributeValue({ value: "Ada", valueNumber: null, valueDate: null }, "string")).toBe("Ada");
  });

  test("reads a number as its decimal string", () => {
    expect(readAttributeValue({ value: "12.0", valueNumber: 12, valueDate: null }, "number")).toBe("12");
  });

  test("reads a date as ISO 8601", () => {
    const valueDate = new Date("2026-01-02T03:04:05.000Z");
    expect(readAttributeValue({ value: "2026-01-02", valueNumber: null, valueDate }, "date")).toBe(
      "2026-01-02T03:04:05.000Z"
    );
  });

  test("falls back to the stored text when the typed column is empty", () => {
    expect(readAttributeValue({ value: "n/a", valueNumber: null, valueDate: null }, "number")).toBe("n/a");
    expect(readAttributeValue({ value: "soon", valueNumber: null, valueDate: null }, "date")).toBe("soon");
  });
});
