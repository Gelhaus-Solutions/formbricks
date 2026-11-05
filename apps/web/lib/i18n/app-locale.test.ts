import { describe, expect, test } from "vitest";
import { toAppLocale } from "./app-locale";

describe("toAppLocale", () => {
  test("keeps a locale the app ships", () => {
    expect(toAppLocale("en-US")).toBe("en-US");
  });

  test("reads English for a stored locale the app no longer ships, or none", () => {
    expect(toAppLocale("de-DE")).toBe("en-US");
    expect(toAppLocale("zh-Hant-TW")).toBe("en-US");
    expect(toAppLocale(undefined)).toBe("en-US");
    expect(toAppLocale(null)).toBe("en-US");
  });
});
