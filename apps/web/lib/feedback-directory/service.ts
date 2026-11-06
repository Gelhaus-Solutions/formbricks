import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getFeedbackDirectoryAuthorizationScope } from "@/lib/authorization/resolvers";

/**
 * Feedback directory lookups for the code that serves feedback datasets: the v3 feedback records API,
 * the Hub gateway and the internal dataset routes (GFORMS-3). A feedback directory is what the API and
 * the documentation call a feedback dataset; its id is the Hub `tenant_id`.
 *
 * Written from the Prisma schema and those call sites. The names are the ones the call sites already
 * use, so an upstream merge that adds a call site only has to change its import.
 */

export type TFeedbackDirectorySummary = {
  id: string;
  name: string;
};

export type TFeedbackDirectoryAuthContext = {
  organizationId: string;
  isArchived: boolean;
  workspaceIds: string[];
};

/**
 * The directories assigned to a workspace, ordered by name. Archived directories are left out: an
 * archived directory is soft-deleted, and the Hub gateway refuses it as well.
 */
export const getFeedbackDirectoriesByWorkspaceId = reactCache(
  async (workspaceId: string): Promise<TFeedbackDirectorySummary[]> => {
    try {
      return await prisma.feedbackDirectory.findMany({
        where: { isArchived: false, workspaces: { some: { workspaceId } } },
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

/**
 * The owning organization, the archived flag and the assigned workspaces of a directory, or null when
 * there is no such directory. Callers decide what an archived directory may still do.
 */
export const getFeedbackDirectoryAuthContext = async (
  feedbackDirectoryId: string
): Promise<TFeedbackDirectoryAuthContext | null> => {
  const scope = await getFeedbackDirectoryAuthorizationScope(feedbackDirectoryId);
  if (!scope) return null;

  return {
    organizationId: scope.organizationId,
    isArchived: scope.isArchived,
    workspaceIds: [...scope.workspaceIds],
  };
};

/** The id of the organization that owns a directory. Throws `ResourceNotFoundError` when there is none. */
export const getOrganizationIdFromDirectoryId = async (feedbackDirectoryId: string): Promise<string> => {
  const scope = await getFeedbackDirectoryAuthorizationScope(feedbackDirectoryId);
  if (!scope) {
    throw new ResourceNotFoundError("feedbackDirectory", feedbackDirectoryId);
  }

  return scope.organizationId;
};
