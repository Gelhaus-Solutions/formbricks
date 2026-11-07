import { type Dispatch, type SetStateAction } from "react";
import { ActionClass, OrganizationRole } from "@formbricks/database/prisma-browser";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { TargetingCard } from "@/modules/ee/contacts/segments/components/targeting-card";
import { HowToSendCard } from "@/modules/survey/editor/components/how-to-send-card";
import { RecontactOptionsCard } from "@/modules/survey/editor/components/recontact-options-card";
import { ResponseOptionsCard } from "@/modules/survey/editor/components/response-options-card";
import { SurveyPlacementCard } from "@/modules/survey/editor/components/survey-placement-card";
import { TargetingLockedCard } from "@/modules/survey/editor/components/targeting-locked-card";
import { WhenToSendCard } from "@/modules/survey/editor/components/when-to-send-card";
import { type TSurveySchedulingConfig } from "@/modules/survey/scheduling/lib/config";
import { TTeamPermission } from "@/modules/workspaces/types/team-permission";

interface SettingsViewProps {
  localSurvey: TSurvey;
  setLocalSurvey: Dispatch<SetStateAction<TSurvey>>;
  actionClasses: ActionClass[];
  contactAttributeKeys: TContactAttributeKey[];
  segments: TSegment[];
  finishedResponseCount: number;
  membershipRole?: OrganizationRole;
  isUserTargetingAllowed?: boolean;
  isSpamProtectionAllowed: boolean;
  workspacePermission: TTeamPermission | null;
  isFormbricksCloud: boolean;
  surveySchedulingConfig: TSurveySchedulingConfig;
  locale: TUserLocale;
  appSetupCompleted: boolean;
  enterpriseLicenseRequestFormUrl: string;
  /** A save or publish was blocked because the survey has no trigger (ENG-2581). */
  hasTriggerError?: boolean;
}

export const SettingsView = ({
  localSurvey,
  setLocalSurvey,
  actionClasses,
  contactAttributeKeys,
  segments,
  finishedResponseCount,
  membershipRole,
  isUserTargetingAllowed = false,
  isSpamProtectionAllowed,
  workspacePermission,
  isFormbricksCloud,
  surveySchedulingConfig,
  locale,
  appSetupCompleted,
  enterpriseLicenseRequestFormUrl,
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

      {localSurvey.type === "app" ? (
        <div>
          {isUserTargetingAllowed ? (
            <div className="relative">
              <div className="blur-none">
                <TargetingCard
                  key={localSurvey.segment?.id}
                  localSurvey={localSurvey}
                  setLocalSurvey={setLocalSurvey}
                  contactAttributeKeys={contactAttributeKeys}
                  segments={segments}
                  initialSegment={segments.find((segment) => segment.id === localSurvey.segment?.id)}
                />
              </div>
            </div>
          ) : (
            <TargetingLockedCard
              isFormbricksCloud={isFormbricksCloud}
              enterpriseLicenseRequestFormUrl={enterpriseLicenseRequestFormUrl}
            />
          )}
        </div>
      ) : null}

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
