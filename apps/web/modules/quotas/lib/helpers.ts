import type { TSurveyQuota, TSurveyQuotaAction } from "@formbricks/types/quota";

/**
 * The quota part of a client response write's answer, in the shape the survey SDK reads
 * (`packages/surveys/src/lib/api-client.ts`): `{ quotaFull: false }`, or the full quota with the action
 * the survey takes and, for `endSurvey`, the ending to show.
 */
export type TQuotaFullObject =
  | { quotaFull: false }
  | {
      quotaFull: true;
      quota: { id: string; action: TSurveyQuotaAction; endingCardId?: string };
    };

export const createQuotaFullObject = (quotaFull?: TSurveyQuota | null): TQuotaFullObject => {
  if (!quotaFull) return { quotaFull: false };

  return {
    quotaFull: true,
    quota: {
      id: quotaFull.id,
      action: quotaFull.action,
      ...(quotaFull.endingCardId ? { endingCardId: quotaFull.endingCardId } : {}),
    },
  };
};
