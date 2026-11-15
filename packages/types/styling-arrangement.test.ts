import { describe, expect, test } from "vitest";
import {
  ZAppSurveyCardArrangementOptions,
  ZLinkSurveyCardArrangementOptions,
  getLinkSurveyArrangement,
  isFullPageLinkArrangement,
} from "./styling";

describe("link survey arrangements", () => {
  test("offers Focus to link surveys only", () => {
    expect(ZLinkSurveyCardArrangementOptions.parse("focus")).toBe("focus");
    expect(ZAppSurveyCardArrangementOptions.safeParse("focus").success).toBe(false);
  });

  test.each([
    ["cardless", true],
    ["focus", true],
    ["straight", false],
    ["simple", false],
    ["casual", false],
    [undefined, false],
    [null, false],
  ])("treats %s as a full-page layout: %s", (arrangement, expected) => {
    expect(isFullPageLinkArrangement(arrangement)).toBe(expected);
  });

  test("renders Focus when a styling sets no arrangement, and the set one otherwise", () => {
    expect(getLinkSurveyArrangement(undefined)).toBe("focus");
    expect(getLinkSurveyArrangement(null)).toBe("focus");
    expect(getLinkSurveyArrangement("straight")).toBe("straight");
    expect(isFullPageLinkArrangement(getLinkSurveyArrangement(undefined))).toBe(true);
  });
});
