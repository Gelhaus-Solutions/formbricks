import { describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { getAccessControlPermission } from "@/modules/features/lib/flags";
import { checkRoleManagementPermission } from "./permission";

vi.mock("server-only", () => ({}));
vi.mock("@/modules/features/lib/flags", () => ({ getAccessControlPermission: vi.fn() }));

describe("checkRoleManagementPermission", () => {
  test("goes ahead with access control", async () => {
    vi.mocked(getAccessControlPermission).mockResolvedValueOnce(true);

    await expect(checkRoleManagementPermission("org-1")).resolves.toBeUndefined();
    expect(getAccessControlPermission).toHaveBeenCalledWith("org-1");
  });

  test("refuses without access control", async () => {
    vi.mocked(getAccessControlPermission).mockResolvedValueOnce(false);

    await expect(checkRoleManagementPermission("org-1")).rejects.toBeInstanceOf(OperationNotAllowedError);
  });
});
