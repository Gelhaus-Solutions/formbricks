import "server-only";
import type { Prisma, Response } from "@formbricks/database/prisma";
import type { TEmbeddedValueResponse } from "@formbricks/types/embedded-data-resolver";
import type { TSurveyQuota } from "@formbricks/types/quota";
import type { TResponseData, TResponseDataValue } from "@formbricks/types/responses";

/**
 * GForms' quota evaluation entry points (GFORMS-3 seam). Every response write path keeps its calls,
 * inside its transaction, so the quotas rebuild (GFORMS-19) only has to fill these in. Until then no
 * survey has a quota: nothing is loaded, nothing is screened, no quota is ever full, and a write
 * returns what it returns for a survey without quotas.
 */

/** What a write path loads once, outside its transaction, and hands to every evaluation. */
export type TQuotaEvaluationContext = {
  surveyId: string;
  quotas: TSurveyQuota[];
};

export type TQuotaEvaluationInput = {
  surveyId: string;
  responseId: string;
  data: TResponseData;
  variables?: Record<string, TResponseDataValue>;
  /** The canonical language code; absent or "default" means the survey's default language. */
  language?: string;
  responseFinished: boolean;
  /** The response row as written, so operands that read the row itself can resolve. */
  response: TEmbeddedValueResponse;
  tx?: Prisma.TransactionClient;
  quotaContext?: TQuotaEvaluationContext | null;
};

export type TQuotaEvaluationResult = {
  /** True when a full quota ends the survey for this response. */
  shouldEndSurvey: boolean;
  /** The quota that is full, when one is. */
  quotaFull?: TSurveyQuota | null;
  /** The response as stored after a full quota finished it. */
  refreshedResponse?: Response | null;
};

export type TQuotaScreeningInput = {
  surveyId: string;
  data: TResponseData;
  variables?: Record<string, TResponseDataValue>;
  language: string;
  response: TEmbeddedValueResponse;
};

export type TQuotaScreeningResult = {
  /** Every quota the survey defines. */
  quotas: TSurveyQuota[];
  /** The quotas whose conditions the response meets. */
  passedQuotas: TSurveyQuota[];
};

/** Loads the survey's quota definitions for evaluation. Never rejects; null means "no quotas". */
export const loadQuotaEvaluationContext = async (
  _surveyId: string
): Promise<TQuotaEvaluationContext | null> => null;

/** Evaluates a response that was just written against the survey's quotas. */
export const evaluateResponseQuotas = async (
  _input: TQuotaEvaluationInput
): Promise<TQuotaEvaluationResult> => ({ shouldEndSurvey: false });

/** Screens a response against the survey's quotas without writing anything. Null means "no quotas". */
export const screenResponseQuotas = async (
  _input: TQuotaScreeningInput
): Promise<TQuotaScreeningResult | null> => null;
