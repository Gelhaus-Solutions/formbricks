import { type Dispatch, type SetStateAction } from "react";
import { ActionClass, OrganizationRole } from "@formbricks/database/prisma-browser";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { HowToSendCard } from "@/modules/survey/editor/components/how-to-send-card";
import { RecontactOptionsCard } from "@/modules/survey/editor/components/recontact-options-card";
import { ResponseOptionsCard } from "@/modules/survey/editor/components/response-options-card";
import { SurveyPlacementCard } from "@/modules/survey/editor/components/survey-placement-card";
import { WhenToSendCard } from "@/modules/survey/editor/components/when-to-send-card";
import { type TSurveySchedulingConfig } from "@/modules/survey/scheduling/lib/config";
import { TTeamPermission } from "@/modules/workspaces/types/team-permission";

interface SettingsViewProps {
  localSurvey: TSurvey;
  setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  actionClasses: ActionClass[];
  finishedResponseCount: number;
  membershipRole?: OrganizationRole;
  isSpamProtectionAllowed: boolean;
  workspacePermission: TTeamPermission | null;
  surveySchedulingConfig: TSurveySchedulingConfig;
  locale: TUserLocale;
  appSetupCompleted: boolean;
  /** A save or publish was blocked because the survey has no trigger (ENG-2581). */
  hasTriggerError?: boolean;
}

export const SettingsView = ({
  localSurvey,
  setLocalSurvey,
  actionClasses,
  finishedResponseCount,
  membershipRole,
  isSpamProtectionAllowed,
  workspacePermission,
  surveySchedulingConfig,
  locale,
  appSetupCompleted,
  hasTriggerError = false,
}: Readonly<SettingsViewProps>) => {
  const isAppSurvey = localSurvey.type === "app";

  return (
    <div className="mt-12 space-y-3 p-5">
      <HowToSendCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        appSetupCompleted={appSetupCompleted}
      />

      <WhenToSendCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        workspaceId={localSurvey.workspaceId}
        propActionClasses={actionClasses}
        membershipRole={membershipRole}
        workspacePermission={workspacePermission}
        hasError={hasTriggerError}
      />

      <ResponseOptionsCard
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        finishedResponseCount={finishedResponseCount}
        isSpamProtectionAllowed={isSpamProtectionAllowed}
        surveySchedulingConfig={surveySchedulingConfig}
        locale={locale}
      />

      <RecontactOptionsCard localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} />

      {isAppSurvey && <SurveyPlacementCard localSurvey={localSurvey} setLocalSurvey={setLocalSurvey} />}
    </div>
  );
};
