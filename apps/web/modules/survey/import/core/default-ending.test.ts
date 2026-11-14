import { describe, expect, test } from "vitest";
import enUS from "@/locales/en-US.json";
import { getDefaultEndingTexts } from "./default-ending";

const english = {
  headline: enUS.templates.default_ending_card_headline,
  subheader: enUS.templates.default_ending_card_subheader,
};

describe("getDefaultEndingTexts", () => {
  test("reads the English strings for an English language, a regional variant included", async () => {
    expect(await getDefaultEndingTexts(["en-US", "en-GB"])).toEqual([english, english]);
  });

  test("gives every other language nothing, unless it is the default one", async () => {
    expect(await getDefaultEndingTexts(["en-US", "de-AT", "zh-Hant-HK"])).toEqual([english, null, null]);
    expect(await getDefaultEndingTexts(["it-IT", "nb-NO"])).toEqual([english, null]);
  });
});
