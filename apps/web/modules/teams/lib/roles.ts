import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";

/** The ids of the organization's teams the user is an admin of. Request-deduped. */
export const getTeamsWhereUserIsAdmin = reactCache(
  async (userId: string, organizationId: string): Promise<string[]> => {
    try {
      const teamUsers = await prisma.teamUser.findMany({
        where: { userId, role: "admin", team: { organizationId } },
        select: { teamId: true },
      });
      return teamUsers.map((teamUser) => teamUser.teamId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
