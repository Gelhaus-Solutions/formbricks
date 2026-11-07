import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import type { TOrganizationTeam } from "../types/team";

/**
 * GForms' team reads (GFORMS-3 seam), written from the Prisma schema and the call sites. The teams and
 * roles rebuild (GFORMS-12) builds on them.
 */

/** The organization's teams, by name. */
export const getTeamsByOrganizationId = reactCache(
  async (organizationId: string): Promise<TOrganizationTeam[]> => {
    try {
      return await prisma.team.findMany({
        where: { organizationId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
