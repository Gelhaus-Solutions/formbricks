import { describe, expect, test } from "vitest";
import { getSurveyFollowUpsPermission } from "./utils";

describe("getSurveyFollowUpsPermission", () => {
  test("allows follow-ups for every organization", async () => {
    await expect(getSurveyFollowUpsPermission("org_123")).resolves.toBe(true);
  });
});
