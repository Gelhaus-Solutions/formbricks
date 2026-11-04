import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getWorkspacePermissionByUserId } from "./team-permission";
import { getTeamPermissionFlags } from "./team-permission-flags";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { workspaceTeam: { findMany: vi.fn() } } }));

const findMany = vi.mocked(prisma.workspaceTeam.findMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getWorkspacePermissionByUserId", () => {
  test("asks only for grants of teams the user belongs to, on this workspace", async () => {
    findMany.mockResolvedValue([]);
    await getWorkspacePermissionByUserId("user_1", "ws_1");

    expect(findMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws_1", team: { teamUsers: { some: { userId: "user_1" } } } },
      select: { permission: true },
    });
  });

  test("is null when no team of the user has access", async () => {
    findMany.mockResolvedValue([]);
    await expect(getWorkspacePermissionByUserId("user_2", "ws_1")).resolves.toBeNull();
  });

  test("a user in several teams holds the broadest grant", async () => {
    findMany.mockResolvedValue([
      { permission: "read" },
      { permission: "manage" },
      { permission: "readWrite" },
    ] as never);
    await expect(getWorkspacePermissionByUserId("user_3", "ws_1")).resolves.toBe("manage");
  });
});

describe("getTeamPermissionFlags", () => {
  test("sets exactly the flag of the permission held", () => {
    expect(getTeamPermissionFlags("read")).toEqual({
      hasReadAccess: true,
      hasReadWriteAccess: false,
      hasManageAccess: false,
    });
    expect(getTeamPermissionFlags("readWrite").hasReadAccess).toBe(false);
    expect(getTeamPermissionFlags("manage").hasManageAccess).toBe(true);
  });

  test("no permission sets no flag", () => {
    expect(getTeamPermissionFlags(null)).toEqual({
      hasReadAccess: false,
      hasReadWriteAccess: false,
      hasManageAccess: false,
    });
  });
});
