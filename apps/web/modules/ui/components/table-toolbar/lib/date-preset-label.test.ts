import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { DATE_RANGE_PRESETS } from "@/lib/date-ranges";
import enUS from "@/locales/en-US.json";
import { getDatePresetLabel } from "./date-preset-label";

const t = ((key: string) => key) as unknown as TFunction;

const lookup = (key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], enUS);

describe("getDatePresetLabel", () => {
  test("names every preset with a string the English catalogue holds", () => {
    for (const preset of DATE_RANGE_PRESETS) {
      expect(typeof lookup(getDatePresetLabel(preset, t)), preset).toBe("string");
    }
  });

  test("gives each preset a label of its own", () => {
    const labels = DATE_RANGE_PRESETS.map((preset) => getDatePresetLabel(preset, t));
    expect(new Set(labels).size).toBe(DATE_RANGE_PRESETS.length);
  });
});
