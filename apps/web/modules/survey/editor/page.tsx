import { Metadata } from "next";
import { notFound } from "next/navigation";
import { isStorageAvailable } from "@formbricks/storage";
import { type TSurvey } from "@formbricks/types/surveys/types";
import {
  DEFAULT_LOCALE,
  IS_FORMBRICKS_CLOUD,
  MAIL_FROM,
  SURVEY_BG_COLORS,
  UNSPLASH_ACCESS_KEY,
} from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getTranslate } from "@/lingodotdev/server";
import { getCustomCssSource } from "@/modules/custom-css/components/lib/draft";
import { hasStylesInHeadScripts } from "@/modules/custom-css/components/lib/hints";
import { type TSurveyCustomCssEditorConfig } from "@/modules/custom-css/components/types";
import { getCustomCssHealth, toDeliveredCustomCss } from "@/modules/custom-css/lib/delivery";
import { getWorkspaceCustomCssRecord, parseStoredCustomCss } from "@/modules/custom-css/lib/service";
import {
  getIsQuotasEnabled,
  getIsSpamProtectionEnabled,
  getIsWorkflowsEnabled,
} from "@/modules/features/lib/flags";
import { getQuotas } from "@/modules/quotas/lib/quotas";
import { getTeamMemberDetails } from "@/modules/survey/editor/lib/team";
import { getUserEmail } from "@/modules/survey/editor/lib/user";
import { getWorkspaceLanguages } from "@/modules/survey/editor/lib/workspace";
import { getSurveyFollowUpsPermission } from "@/modules/survey/follow-ups/lib/utils";
import { getActionClasses } from "@/modules/survey/lib/action-class";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import {
  getFinishedResponseCountBySurveyId,
  getResponseCountBySurveyId,
} from "@/modules/survey/lib/response";
import { getSurvey } from "@/modules/survey/lib/survey";
import { canReadSurveyInWorkspace, getSurveyAuth } from "@/modules/survey/lib/survey-auth";
import { getWorkspaceWithTeamIds } from "@/modules/survey/lib/workspace";
import { SURVEY_SCHEDULING_CONFIG } from "@/modules/survey/scheduling/lib/constants";
import { getSurveyVisibilityViewer } from "@/modules/survey/visibility/lib/gate";
import { ErrorComponent } from "@/modules/ui/components/error-component";
import { SurveyEditor } from "./components/survey-editor";
import { getUserLocale } from "./lib/user";

type TSurveyEditorPageParams = { params: Promise<{ workspaceId: string; surveyId: string }> };

// Re-exported by the /edit route file: Next only reads metadata from the route segment's own module.
export const generateSurveyEditorMetadata = async (props: TSurveyEditorPageParams): Promise<Metadata> => {
  const params = await props.params;
  const t = await getTranslate();

  // Metadata resolves independently of the page's own access check, so the survey name only goes
  // into the title once the caller may read this survey through this workspace.
  if (!(await canReadSurveyInWorkspace(params.workspaceId, params.surveyId))) {
    return { title: t("common.survey") };
  }

  const survey = await getSurvey(params.surveyId);
  return { title: t("workspace.surveys.edit.edit_survey_title", { surveyName: survey.name }) };
};

export const SurveyEditorPage = async (props: {
  readonly params: Promise<{ workspaceId: string; surveyId: string }>;
  readonly searchParams: Promise<{ mode?: string }>;
}) => {
  const searchParams = await props.searchParams;
  const params = await props.params;

  // Gated here rather than by a layout: the editor lives in its own route group
  // ((survey-editor)) with its own layout, so it does not inherit the guard on
  // (app)/workspaces/[workspaceId]/surveys/[surveyId]/layout.tsx.
  const { session, isMember, hasReadAccess, currentUserMembership, workspacePermission, workspace } =
    await getSurveyAuth(params.workspaceId, params.surveyId);

  const [survey, workspaceWithTeamIds, actionClasses, responseCount, finishedResponseCount] =
    await Promise.all([
      getSurvey(params.surveyId),
      getWorkspaceWithTeamIds(params.workspaceId),
      getActionClasses(workspace.id),
      getResponseCountBySurveyId(params.surveyId),
      getFinishedResponseCountBySurveyId(params.surveyId),
    ]);

  if (!workspaceWithTeamIds) {
    return notFound();
  }

  const isSurveyCreationDeletionDisabled = isMember && hasReadAccess;
  const [locale, userEmail] = await Promise.all([
    getUserLocale(session.user.id),
    getUserEmail(session.user.id),
  ]);

  const [
    isSurveyFollowUpsAllowed,
    isSpamProtectionAllowed,
    isQuotasAllowed,
    isExternalUrlsAllowed,
    isWorkflowsAllowed,
  ] = await Promise.all([
    getSurveyFollowUpsPermission(workspaceWithTeamIds.organizationId),
    getIsSpamProtectionEnabled(workspaceWithTeamIds.organizationId),
    getIsQuotasEnabled(workspaceWithTeamIds.organizationId),
    getExternalUrlsPermission(workspaceWithTeamIds.organizationId),
    // Drives the Follow-ups deprecation: the tab only survives where Workflows cannot replace it.
    getIsWorkflowsEnabled(workspaceWithTeamIds.organizationId),
  ]);

  const quotas = isQuotasAllowed && survey ? await getQuotas(survey.id) : [];
  const [workspaceLanguages, teamMemberDetails] = await Promise.all([
    getWorkspaceLanguages(workspaceWithTeamIds.id),
    getTeamMemberDetails(workspaceWithTeamIds.teamIds),
  ]);

  // A survey that is gone, or that this viewer may not edit, 404s like any other inaccessible resource.
  if (!survey || isSurveyCreationDeletionDisabled) {
    return notFound();
  }

  if (!actionClasses || !workspaceWithTeamIds || !userEmail) {
    return <ErrorComponent />;
  }

  const isCxMode = searchParams.mode === "cx";
  const publicDomain = getPublicDomain();
  const { surveyVisibilityGate, visibility, surveyAccess, ownerName } = await getSurveyVisibilityViewer(
    survey,
    session.user.id,
    workspaceWithTeamIds.organizationId
  );

  // The workspace row reaches the editor without its CSS columns (source, compiled output and the
  // previous revision); the editor gets only what the Custom CSS card shows, read here on the server.
  const customCssEditor = await getSurveyCustomCssEditorConfig({
    storedWorkspaceCustomCss: (await getWorkspaceCustomCssRecord(workspaceWithTeamIds.id)).customCss,
    survey,
    workspaceHeadScripts: workspaceWithTeamIds.customHeadScripts,
  });

  return (
    <SurveyEditor
      survey={survey}
      workspace={workspaceWithTeamIds}
      actionClasses={actionClasses}
      responseCount={responseCount}
      finishedResponseCount={finishedResponseCount}
      membershipRole={currentUserMembership.role}
      workspacePermission={workspacePermission}
      colors={SURVEY_BG_COLORS}
      isSpamProtectionAllowed={isSpamProtectionAllowed}
      workspaceLanguages={workspaceLanguages}
      isFormbricksCloud={IS_FORMBRICKS_CLOUD}
      isUnsplashConfigured={!!UNSPLASH_ACCESS_KEY}
      isCxMode={isCxMode}
      surveySchedulingConfig={SURVEY_SCHEDULING_CONFIG}
      locale={locale ?? DEFAULT_LOCALE}
      mailFrom={MAIL_FROM ?? "hola@formbricks.com"}
      isSurveyFollowUpsAllowed={isSurveyFollowUpsAllowed}
      isWorkflowsAllowed={isWorkflowsAllowed}
      userEmail={userEmail}
      teamMemberDetails={teamMemberDetails}
      isStorageConfigured={isStorageAvailable()}
      quotas={quotas}
      isExternalUrlsAllowed={isExternalUrlsAllowed}
      publicDomain={publicDomain}
      surveyVisibilityGate={surveyVisibilityGate}
      visibility={visibility}
      surveyAccess={surveyAccess}
      ownerName={ownerName}
      customCssEditor={customCssEditor}
    />
  );
};

/**
 * What the survey's Custom CSS card needs (ENG-3553), mirroring the server's own rules: the inherited
 * workspace CSS as source (read-only) and as delivered compiled output (for the preview), the health
 * of both saved values, and (self-hosted only) whether either set of Custom Head
 * Scripts already adds page styles. Survey edit permission is the editor's own: reaching it is it.
 */
const getSurveyCustomCssEditorConfig = async (params: {
  storedWorkspaceCustomCss: unknown;
  survey: TSurvey;
  workspaceHeadScripts: string | null;
}): Promise<TSurveyCustomCssEditorConfig> => {
  const workspaceCustomCss = parseStoredCustomCss(params.storedWorkspaceCustomCss);
  const [workspaceCompiled, workspaceHealth, surveyHealth] = await Promise.all([
    toDeliveredCustomCss(workspaceCustomCss, "workspace"),
    getCustomCssHealth(workspaceCustomCss, "workspace"),
    getCustomCssHealth(params.survey.customCss, "survey"),
  ]);

  return {
    hasHeadScriptStyles:
      !IS_FORMBRICKS_CLOUD &&
      (hasStylesInHeadScripts(params.workspaceHeadScripts) ||
        hasStylesInHeadScripts(params.survey.customHeadScripts)),
    surveyStatus: surveyHealth.status,
    workspace: {
      source: getCustomCssSource(workspaceCustomCss),
      compiled: workspaceCompiled ?? null,
      status: workspaceHealth.status,
    },
  };
};
