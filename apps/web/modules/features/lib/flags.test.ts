import { describe, expect, test } from "vitest";
import {
  GFORMS_FEATURES,
  getAccessControlPermission,
  getCustomCssPermission,
  getIsContactsEnabled,
  getIsMultiOrgEnabled,
  getOrganizationWorkspacesLimit,
  getRemoveBrandingPermission,
  isGFormsFeatureEnabled,
} from "./flags";

describe("GForms feature flags", () => {
  test("features built into GForms are on for every organization", async () => {
    await expect(getIsMultiOrgEnabled()).resolves.toBe(true);
    await expect(getCustomCssPermission("org_1")).resolves.toBe(true);
    await expect(getRemoveBrandingPermission("org_2")).resolves.toBe(true);
  });

  test("features still in the Enterprise folder stay off until their rebuild", async () => {
    await expect(getIsContactsEnabled("org_1")).resolves.toBe(false);
    await expect(getAccessControlPermission("org_1")).resolves.toBe(false);
  });

  test("a getter answers exactly what the map says", () => {
    for (const [feature, enabled] of Object.entries(GFORMS_FEATURES)) {
      expect(isGFormsFeatureEnabled(feature as keyof typeof GFORMS_FEATURES)).toBe(enabled);
    }
  });

  test("no organization is held to a workspace limit", async () => {
    const limit = await getOrganizationWorkspacesLimit("org_1");
    expect(10_000 >= limit).toBe(false);
  });
});
