import * as nextHeaders from "next/headers";
import { describe, expect, test, vi } from "vitest";
import { AVAILABLE_LOCALES, DEFAULT_LOCALE } from "@/lib/constants";
import { findMatchingLocale, getAcceptedLanguages } from "./locale";

// Mock the Next.js headers function
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

describe("locale", () => {
  test("getAcceptedLanguages reads the Accept-Language header in preference order", async () => {
    vi.mocked(nextHeaders.headers).mockResolvedValue({
      get: vi.fn().mockReturnValue("en;q=0.5, de-DE"),
    } as unknown as Awaited<ReturnType<typeof nextHeaders.headers>>);

    expect(await getAcceptedLanguages()).toEqual(["de-DE", "en"]);
  });

  test("getAcceptedLanguages returns nothing without the header", async () => {
    vi.mocked(nextHeaders.headers).mockResolvedValue({
      get: vi.fn().mockReturnValue(null),
    } as unknown as Awaited<ReturnType<typeof nextHeaders.headers>>);

    expect(await getAcceptedLanguages()).toEqual([]);
  });

  test("returns DEFAULT_LOCALE when Accept-Language header is missing", async () => {
    // Set up the mock to return null for accept-language header
    vi.mocked(nextHeaders.headers).mockReturnValue({
      get: vi.fn().mockReturnValue(null),
    } as any);

    const result = await findMatchingLocale();

    expect(result).toBe(DEFAULT_LOCALE);
    expect(nextHeaders.headers).toHaveBeenCalled();
  });

  test("returns exact match when available", async () => {
    // Assuming we have 'en-US' in AVAILABLE_LOCALES
    const testLocale = AVAILABLE_LOCALES[0];

    vi.mocked(nextHeaders.headers).mockReturnValue({
      get: vi.fn().mockReturnValue(`${testLocale},fr-FR,de-DE`),
    } as any);

    const result = await findMatchingLocale();

    expect(result).toBe(testLocale);
    expect(nextHeaders.headers).toHaveBeenCalled();
  });

  test("returns normalized match when available", async () => {
    // Assuming we have 'en-US' in AVAILABLE_LOCALES but not 'en-GB'
    const availableLocale = AVAILABLE_LOCALES.find((locale) => locale.startsWith("en-"));

    if (!availableLocale) {
      // Skip this test if no English locale is available
      return;
    }

    vi.mocked(nextHeaders.headers).mockReturnValue({
      get: vi.fn().mockReturnValue("en-US,fr-FR,de-DE"),
    } as any);

    const result = await findMatchingLocale();

    expect(result).toBe(availableLocale);
    expect(nextHeaders.headers).toHaveBeenCalled();
  });

  test("returns DEFAULT_LOCALE when no match is found", async () => {
    // Use a locale that should not exist in AVAILABLE_LOCALES
    vi.mocked(nextHeaders.headers).mockReturnValue({
      get: vi.fn().mockReturnValue("xx-XX,yy-YY"),
    } as any);

    const result = await findMatchingLocale();

    expect(result).toBe(DEFAULT_LOCALE);
    expect(nextHeaders.headers).toHaveBeenCalled();
  });

  test("matches English only: the app ships no other language", async () => {
    expect(AVAILABLE_LOCALES).toEqual(["en-US"]);

    vi.mocked(nextHeaders.headers).mockReturnValue({
      get: vi.fn().mockReturnValue("de-DE,sv-SE,en-GB"),
    } as any);

    expect(await findMatchingLocale()).toBe("en-US");
  });
});
