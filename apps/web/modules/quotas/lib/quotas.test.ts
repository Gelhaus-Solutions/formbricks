import { describe, expect, test, vi } from "vitest";
import { getQuotas, reduceQuotaLimits } from "./quotas";

vi.mock("server-only", () => ({}));

describe("quota seam", () => {
  test("a survey has no quotas", async () => {
    await expect(getQuotas("survey-1")).resolves.toEqual([]);
  });

  test("reducing quota limits changes nothing", async () => {
    await expect(reduceQuotaLimits(["quota-1"])).resolves.toBeUndefined();
  });
});
