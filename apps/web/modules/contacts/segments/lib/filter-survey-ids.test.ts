import { describe, expect, test } from "vitest";
import type { TBaseFilters } from "@formbricks/types/segment";
import { collectSegmentFilterSurveyIds, redactSegmentFilterSurveyIds } from "./filter-survey-ids";

const interaction = (id: string, surveyIds: string[]) => ({
  id,
  connector: null,
  resource: {
    id: `${id}-f`,
    root: { type: "surveyInteraction" },
    value: { surveyScope: "specific", surveyIds, within: { amount: 7, unit: "days" } },
    qualifier: { operator: "responded" },
  },
});

const attribute = {
  id: "attr",
  connector: "and",
  resource: {
    id: "attr-f",
    root: { type: "attribute", contactAttributeKey: "plan" },
    value: "pro",
    qualifier: { operator: "equals" },
  },
};

const filters = [
  interaction("a", ["s1", "s2"]),
  attribute,
  { id: "g", connector: "and", resource: [interaction("b", ["s2", "s3"])] },
] as unknown as TBaseFilters;

describe("collectSegmentFilterSurveyIds", () => {
  test("lists each survey id once, nested groups included", () => {
    expect(collectSegmentFilterSurveyIds(filters)).toEqual(["s1", "s2", "s3"]);
  });

  test("lists nothing for filters without survey interactions", () => {
    expect(collectSegmentFilterSurveyIds([attribute] as unknown as TBaseFilters)).toEqual([]);
  });
});

describe("redactSegmentFilterSurveyIds", () => {
  test("keeps only visible survey ids and leaves other filters and the input alone", () => {
    const redacted = redactSegmentFilterSurveyIds(filters, new Set(["s2"])) as unknown as typeof filters;

    expect(JSON.stringify(redacted)).not.toContain("s1");
    expect(JSON.stringify(redacted)).not.toContain("s3");
    expect(redacted[1]).toBe(filters[1]);
    expect(collectSegmentFilterSurveyIds(filters)).toEqual(["s1", "s2", "s3"]);
  });
});
