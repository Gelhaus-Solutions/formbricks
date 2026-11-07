import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { getTeamsByOrganizationId } from "./team";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { team: { findMany: vi.fn() } } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getTeamsByOrganizationId", () => {
  test("reads the organization's teams by name", async () => {
    vi.mocked(prisma.team.findMany).mockResolvedValueOnce([{ id: "team-1", name: "Design" }] as never);

    await expect(getTeamsByOrganizationId("org-1")).resolves.toEqual([{ id: "team-1", name: "Design" }]);
    expect(prisma.team.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  });

  test("turns a Prisma request error into a DatabaseError", async () => {
    vi.mocked(prisma.team.findMany).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("boom", { code: "P2024", clientVersion: "0.0.0" })
    );

    await expect(getTeamsByOrganizationId("org-2")).rejects.toBeInstanceOf(DatabaseError);
  });
});
