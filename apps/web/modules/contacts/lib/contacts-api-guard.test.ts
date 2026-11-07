import { describe, expect, test, vi } from "vitest";
import { getIsContactsEnabled } from "@/modules/features/lib/flags";
import { checkContactsEnabledApiV2 } from "./contacts-api-guard";

vi.mock("server-only", () => ({}));
vi.mock("@/modules/features/lib/flags", () => ({ getIsContactsEnabled: vi.fn() }));

describe("checkContactsEnabledApiV2", () => {
  test("lets an organization with contacts through", async () => {
    vi.mocked(getIsContactsEnabled).mockResolvedValueOnce(true);

    await expect(checkContactsEnabledApiV2("org-1")).resolves.toBeNull();
    expect(getIsContactsEnabled).toHaveBeenCalledWith("org-1");
  });

  test("answers forbidden without contacts", async () => {
    vi.mocked(getIsContactsEnabled).mockResolvedValueOnce(false);

    await expect(checkContactsEnabledApiV2("org-1")).resolves.toEqual({
      type: "forbidden",
      details: [{ field: "organizationId", issue: "Contacts are not enabled for this organization." }],
    });
  });
});
