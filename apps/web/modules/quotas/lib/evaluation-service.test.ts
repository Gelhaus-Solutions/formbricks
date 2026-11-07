import { describe, expect, test, vi } from "vitest";
import type { TEmbeddedValueResponse } from "@formbricks/types/embedded-data-resolver";
import {
  evaluateResponseQuotas,
  loadQuotaEvaluationContext,
  screenResponseQuotas,
} from "./evaluation-service";

vi.mock("server-only", () => ({}));

const response = { id: "response-1", surveyId: "survey-1", data: {} } as unknown as TEmbeddedValueResponse;

describe("quota evaluation seam", () => {
  test("loads no quota context", async () => {
    await expect(loadQuotaEvaluationContext("survey-1")).resolves.toBeNull();
  });

  test("never ends a survey on a quota", async () => {
    await expect(
      evaluateResponseQuotas({
        surveyId: "survey-1",
        responseId: "response-1",
        data: {},
        language: "default",
        responseFinished: true,
        response,
        quotaContext: null,
      })
    ).resolves.toEqual({ shouldEndSurvey: false });
  });

  test("screens no quotas", async () => {
    await expect(
      screenResponseQuotas({ surveyId: "survey-1", data: {}, language: "default", response })
    ).resolves.toBeNull();
  });
});
