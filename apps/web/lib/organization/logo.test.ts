import { beforeEach, describe, expect, test, vi } from "vitest";
import { getOrganization } from "@/lib/organization/service";
import { getOrganizationLogoUrl } from "./logo";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/organization/service", () => ({ getOrganization: vi.fn() }));

type TOrg = Awaited<ReturnType<typeof getOrganization>>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOrganizationLogoUrl", () => {
  test("is the logo stored in the organization's whitelabel settings", async () => {
    vi.mocked(getOrganization).mockResolvedValue({
      id: "org_1",
      whitelabel: { logoUrl: "https://storage.example/logo.png" },
    } as TOrg);
    await expect(getOrganizationLogoUrl("org_1")).resolves.toBe("https://storage.example/logo.png");
    expect(getOrganization).toHaveBeenCalledWith("org_1");
  });

  test("is null without a logo or without the organization", async () => {
    vi.mocked(getOrganization).mockResolvedValue({ id: "org_2", whitelabel: {} } as TOrg);
    await expect(getOrganizationLogoUrl("org_2")).resolves.toBeNull();
    vi.mocked(getOrganization).mockResolvedValue(null);
    await expect(getOrganizationLogoUrl("org_3")).resolves.toBeNull();
  });
});
