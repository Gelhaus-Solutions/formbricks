import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { getTeamsWhereUserIsAdmin } from "./roles";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { teamUser: { findMany: vi.fn() } } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getTeamsWhereUserIsAdmin", () => {
  test("lists the teams of the organization the user administers", async () => {
    vi.mocked(prisma.teamUser.findMany).mockResolvedValueOnce([
      { teamId: "team-1" },
      { teamId: "team-2" },
    ] as never);

    await expect(getTeamsWhereUserIsAdmin("user-1", "org-1")).resolves.toEqual(["team-1", "team-2"]);
    expect(prisma.teamUser.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", role: "admin", team: { organizationId: "org-1" } },
      select: { teamId: true },
    });
  });

  test("turns a Prisma request error into a DatabaseError", async () => {
    vi.mocked(prisma.teamUser.findMany).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("boom", { code: "P2024", clientVersion: "0.0.0" })
    );

    await expect(getTeamsWhereUserIsAdmin("user-2", "org-2")).rejects.toBeInstanceOf(DatabaseError);
  });
});
