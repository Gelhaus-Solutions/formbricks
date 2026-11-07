import { describe, expect, test } from "vitest";
import type { TSurveyQuota } from "@formbricks/types/quota";
import { createQuotaFullObject } from "./helpers";

const quota = (overrides: Partial<TSurveyQuota>): TSurveyQuota => ({
  id: "quota-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  surveyId: "survey-1",
  name: "Quota",
  limit: 10,
  logic: { connector: "and", conditions: [] },
  action: "endSurvey",
  endingCardId: null,
  countPartialSubmissions: false,
  ...overrides,
});

describe("createQuotaFullObject", () => {
  test("reports no full quota without one", () => {
    expect(createQuotaFullObject()).toEqual({ quotaFull: false });
    expect(createQuotaFullObject(null)).toEqual({ quotaFull: false });
  });

  test("reports a full quota that ends the survey on an ending", () => {
    expect(createQuotaFullObject(quota({ endingCardId: "ending-1" }))).toEqual({
      quotaFull: true,
      quota: { id: "quota-1", action: "endSurvey", endingCardId: "ending-1" },
    });
  });

  test("leaves the ending out when the quota has none", () => {
    expect(createQuotaFullObject(quota({ action: "continueSurvey" }))).toEqual({
      quotaFull: true,
      quota: { id: "quota-1", action: "continueSurvey" },
    });
  });
});
