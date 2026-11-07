import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import type { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { DatabaseError } from "@formbricks/types/errors";

/**
 * GForms' contact reads (GFORMS-3 seam): the small reads AGPL code takes from the contacts feature,
 * written from the Prisma schema, the call sites and the AGPL types. The contacts rebuild (GFORMS-18)
 * builds on them. Every caller already checks the `contacts` flag, which is off.
 */

/** The workspace's contact attribute keys, oldest first. Request-deduped. */
export const getContactAttributeKeys = reactCache(
  async (workspaceId: string): Promise<TContactAttributeKey[]> => {
    try {
      return await prisma.contactAttributeKey.findMany({
        where: { workspaceId },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          isUnique: true,
          key: true,
          name: true,
          description: true,
          type: true,
          dataType: true,
          workspaceId: true,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
