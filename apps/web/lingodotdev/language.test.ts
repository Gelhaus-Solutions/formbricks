import { beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getUserLocale } from "@/lib/user/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getSession } from "@/modules/auth/lib/session";
import { getLocale } from "./language";

// Mock dependencies
vi.mock("@/modules/auth/lib/session", () => ({
  getSession: vi.fn(),
}));
vi.mock("@/lib/user/service", () => ({
  getUserLocale: vi.fn(),
}));
vi.mock("@/lib/utils/locale", () => ({
  findMatchingLocale: vi.fn(),
}));

describe("lingodotdev getLocale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return user locale when session exists and user has id", async () => {
    const mockSession = {
      user: {
        id: "user-123",
      },
      expires: "2999-01-01T00:00:00.000Z",
    };
    const userLocale = "en-US";

    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getUserLocale).mockResolvedValue(userLocale);

    const result = await getLocale();

    expect(getSession).toHaveBeenCalled();
    expect(getUserLocale).toHaveBeenCalledWith("user-123");
    expect(findMatchingLocale).not.toHaveBeenCalled();
    expect(result).toBe(userLocale);
  });

  test("should use findMatchingLocale when no session exists", async () => {
    const matchingLocale = "en-US";

    vi.mocked(getSession).mockResolvedValue(null);
    vi.mocked(findMatchingLocale).mockResolvedValue(matchingLocale);

    const result = await getLocale();

    expect(getSession).toHaveBeenCalled();
    expect(getUserLocale).not.toHaveBeenCalled();
    expect(findMatchingLocale).toHaveBeenCalled();
    expect(result).toBe(matchingLocale);
  });

  test("should return DEFAULT_LOCALE when getUserLocale returns undefined", async () => {
    const mockSession = {
      user: {
        id: "user-123",
      },
      expires: "2999-01-01T00:00:00.000Z",
    };

    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getUserLocale).mockResolvedValue(undefined);

    const result = await getLocale();

    expect(getSession).toHaveBeenCalled();
    expect(getUserLocale).toHaveBeenCalledWith("user-123");
    expect(result).toBe(DEFAULT_LOCALE);
  });

  test("reads English for a stored locale the app no longer ships", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "user-123" },
      expires: "2999-01-01T00:00:00.000Z",
    });
    vi.mocked(getUserLocale).mockResolvedValue("de-DE");

    expect(await getLocale()).toBe(DEFAULT_LOCALE);
  });
});
