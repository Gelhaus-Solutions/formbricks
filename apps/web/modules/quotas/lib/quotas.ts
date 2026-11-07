import "server-only";
import type { Prisma } from "@formbricks/database/prisma";
import type { TSurveyQuota } from "@formbricks/types/quota";

/**
 * GForms' quota reads and writes (GFORMS-3 seam). Every caller keeps its call so the quotas rebuild
 * (GFORMS-19) only has to fill these in. Until then no survey has a quota, which is also what every
 * caller already assumes while the `quotas` flag is off.
 */

/** The quotas a survey defines. */
export const getQuotas = async (_surveyId: string): Promise<TSurveyQuota[]> => [];

/** Lowers the limits of the given quotas when responses that counted towards them are deleted. */
export const reduceQuotaLimits = async (
  _quotaIds: string[],
  _tx?: Prisma.TransactionClient
): Promise<void> => {};
