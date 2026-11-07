import type { Prisma } from "@formbricks/database/prisma";

/**
 * The contact list's base filter: the workspace, and with a search, a contact whose id or any attribute
 * value contains it, ignoring case. The caller escapes LIKE wildcards in `search` first.
 */
export const buildContactWhereClause = (workspaceId: string, search?: string): Prisma.ContactWhereInput => {
  if (!search) return { workspaceId };

  return {
    workspaceId,
    OR: [
      { attributes: { some: { value: { contains: search, mode: "insensitive" } } } },
      { id: { contains: search, mode: "insensitive" } },
    ],
  };
};
