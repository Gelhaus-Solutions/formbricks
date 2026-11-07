import { describe, expect, test } from "vitest";
import { getBillingFallbackPath } from "./navigation";

describe("getBillingFallbackPath", () => {
  test("returns the account profile, since GForms has no billing page", () => {
    expect(getBillingFallbackPath()).toBe("/account/settings/profile");
  });
});
