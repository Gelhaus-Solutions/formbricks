import { afterEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { getIsSpamProtectionEnabled } from "@/modules/features/lib/flags";
import { checkSpamProtectionPermission, getExternalUrlsPermission } from "./permission";

vi.mock("@/modules/features/lib/flags", () => ({
  getIsSpamProtectionEnabled: vi.fn(),
}));

describe("checkSpamProtectionPermission", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("resolves when spam protection is enabled", async () => {
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(true);

    await expect(checkSpamProtectionPermission("org_1")).resolves.toBeUndefined();
  });

  test("throws when spam protection is not enabled", async () => {
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(false);

    await expect(checkSpamProtectionPermission("org_1")).rejects.toThrow(OperationNotAllowedError);
    await expect(checkSpamProtectionPermission("org_1")).rejects.toThrow(
      "Spam protection is not enabled for this organization"
    );
  });
});

describe("getExternalUrlsPermission", () => {
  test("allows external URLs for every organization", async () => {
    await expect(getExternalUrlsPermission("org_123")).resolves.toBe(true);
  });
});
