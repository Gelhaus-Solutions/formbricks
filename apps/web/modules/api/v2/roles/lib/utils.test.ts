import { describe, expect, test } from "vitest";
import { OrganizationRole } from "@formbricks/database/prisma";
import { getRoles } from "./utils";

describe("getRoles", () => {
  test("never lists the Dashboard viewer, which this API cannot assign (C3)", () => {
    const result = getRoles();
    expect(result.ok && result.data.data).not.toContain("dashboard_viewer");
  });

  test("offers every role except billing, which can no longer be given", () => {
    const result = getRoles();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.data).toEqual(
        Object.values(OrganizationRole).filter((role) => role !== "billing" && role !== "dashboard_viewer")
      );
    }
  });
});
