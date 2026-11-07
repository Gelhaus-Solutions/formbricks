import { describe, expect, test } from "vitest";
import { OrganizationRole } from "@formbricks/database/prisma";
import { getRoles } from "./utils";

describe("getRoles", () => {
  test("offers every role except billing, which can no longer be given", () => {
    const result = getRoles();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.data).toEqual(Object.values(OrganizationRole).filter((role) => role !== "billing"));
    }
  });
});
