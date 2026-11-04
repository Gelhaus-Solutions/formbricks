import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import type { TTeamPermission } from "@/modules/workspaces/types/team-permission";

const PERMISSION_RANK: Record<TTeamPermission, number> = { read: 1, readWrite: 2, manage: 3 };

/**
 * The permission a user holds on a workspace through their teams, or null when none of their teams has
 * access (GFORMS-3 seam). A user in several teams with access holds the broadest of their grants.
 * Organization roles are not considered here: owners and managers need no team grant.
 */
export const getWorkspacePermissionByUserId = reactCache(
  async (userId: string, workspaceId: string): Promise<TTeamPermission | null> => {
    try {
      const grants = await prisma.workspaceTeam.findMany({
        where: { workspaceId, team: { teamUsers: { some: { userId } } } },
        select: { permission: true },
      });

      return grants.reduce<TTeamPermission | null>(
        (broadest, { permission }) =>
          broadest === null || PERMISSION_RANK[permission] > PERMISSION_RANK[broadest]
            ? permission
            : broadest,
        null
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
