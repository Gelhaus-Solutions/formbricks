import type { TSurveyStatus, TSurveyType } from "@formbricks/types/surveys/types";

/**
 * The publish rule for app surveys, in one copy that every writer shares: the server's create and update,
 * the v3 PATCH and the survey editor's own check (client-safe on purpose, so the editor never promises a
 * save the API then refuses).
 *
 * A live (non-draft) app survey needs a trigger of its own, or it can never be shown.
 */

export const APP_SURVEY_TRIGGER_REQUIRED_MESSAGE =
  "An app survey must have at least one trigger to be set to a non-draft status.";

export const isAppSurveyMissingTriggersToPublish = ({
  type,
  status,
  triggers,
}: {
  type: TSurveyType;
  /** The status the survey is heading for, not the one it has. */
  status: TSurveyStatus;
  /** Falsy entries are holes the editor leaves when a trigger is removed. */
  triggers: readonly unknown[] | null | undefined;
}): boolean => type === "app" && status !== "draft" && (triggers ?? []).filter(Boolean).length === 0;
