import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getFeedbackDirectoryAuthorizationScope } from "@/lib/authorization/resolvers";
import {
  getFeedbackDirectoriesByWorkspaceId,
  getFeedbackDirectoryAuthContext,
  getOrganizationIdFromDirectoryId,
} from "./service";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    feedbackDirectory: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/authorization/resolvers", () => ({
  getFeedbackDirectoryAuthorizationScope: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getFeedbackDirectoriesByWorkspaceId", () => {
  test("reads the workspace's directories that are not archived, by name", async () => {
    vi.mocked(prisma.feedbackDirectory.findMany).mockResolvedValueOnce([
      { id: "directory-a", name: "Product" },
      { id: "directory-b", name: "Support" },
    ] as never);

    await expect(getFeedbackDirectoriesByWorkspaceId("workspace-1")).resolves.toEqual([
      { id: "directory-a", name: "Product" },
      { id: "directory-b", name: "Support" },
    ]);
    expect(prisma.feedbackDirectory.findMany).toHaveBeenCalledWith({
      where: { isArchived: false, workspaces: { some: { workspaceId: "workspace-1" } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  });

  test("turns a Prisma request error into a DatabaseError", async () => {
    vi.mocked(prisma.feedbackDirectory.findMany).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("boom", { code: "P2024", clientVersion: "0.0.0" })
    );

    await expect(getFeedbackDirectoriesByWorkspaceId("workspace-2")).rejects.toBeInstanceOf(DatabaseError);
  });

  test("passes any other error through", async () => {
    const error = new Error("unexpected");
    vi.mocked(prisma.feedbackDirectory.findMany).mockRejectedValueOnce(error);

    await expect(getFeedbackDirectoriesByWorkspaceId("workspace-3")).rejects.toBe(error);
  });
});

describe("getFeedbackDirectoryAuthContext", () => {
  test("returns the organization, archived flag and assigned workspaces", async () => {
    vi.mocked(getFeedbackDirectoryAuthorizationScope).mockResolvedValueOnce({
      organizationId: "org-1",
      isArchived: true,
      workspaceIds: ["workspace-a", "workspace-b"],
    });

    await expect(getFeedbackDirectoryAuthContext("directory-1")).resolves.toEqual({
      organizationId: "org-1",
      isArchived: true,
      workspaceIds: ["workspace-a", "workspace-b"],
    });
    expect(getFeedbackDirectoryAuthorizationScope).toHaveBeenCalledWith("directory-1");
  });

  test("returns null for a directory that does not exist", async () => {
    vi.mocked(getFeedbackDirectoryAuthorizationScope).mockResolvedValueOnce(null);

    await expect(getFeedbackDirectoryAuthContext("directory-missing")).resolves.toBeNull();
  });
});

describe("getOrganizationIdFromDirectoryId", () => {
  test("returns the owning organization, archived or not", async () => {
    vi.mocked(getFeedbackDirectoryAuthorizationScope).mockResolvedValueOnce({
      organizationId: "org-2",
      isArchived: true,
      workspaceIds: [],
    });

    await expect(getOrganizationIdFromDirectoryId("directory-2")).resolves.toBe("org-2");
  });

  test("throws ResourceNotFoundError for a directory that does not exist", async () => {
    vi.mocked(getFeedbackDirectoryAuthorizationScope).mockResolvedValueOnce(null);

    await expect(getOrganizationIdFromDirectoryId("directory-missing")).rejects.toBeInstanceOf(
      ResourceNotFoundError
    );
  });
});
