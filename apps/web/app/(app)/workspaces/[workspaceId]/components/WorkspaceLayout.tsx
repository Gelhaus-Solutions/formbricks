import { ResourceNotFoundError } from "@formbricks/types/errors";
import { MainNavigation } from "@/app/(app)/workspaces/[workspaceId]/components/MainNavigation";
import { TopControlBar } from "@/app/(app)/workspaces/[workspaceId]/components/TopControlBar";
import { IS_DEVELOPMENT, IS_FORMBRICKS_CLOUD, IS_FORMBRICKS_SURVEYS_CONFIGURED } from "@/lib/constants";
import { getAccessFlags } from "@/lib/membership/utils";
import { getTranslate } from "@/lingodotdev/server";
import { isGFormsFeatureEnabled } from "@/modules/features/lib/flags";
import { TWorkspaceLayoutData } from "@/modules/workspaces/types/workspace-auth";

interface WorkspaceLayoutProps {
  readonly layoutData: TWorkspaceLayoutData;
  readonly children?: React.ReactNode;
}

export const WorkspaceLayout = async ({ layoutData, children }: WorkspaceLayoutProps) => {
  const t = await getTranslate();

  // Destructure all data from props (NO database queries)
  const {
    user,
    organization,
    membership,
    workspace, // Current workspace details
    isAccessControlAllowed,
    workspacePermission,
  } = layoutData;

  // Calculate derived values (no queries)
  const { isMember, isOwner, isManager } = getAccessFlags(membership.role);

  const isMultiOrgEnabled = isGFormsFeatureEnabled("multiOrg");

  const isOwnerOrManager = isOwner || isManager;

  // Validate that workspace permission exists for members
  if (isMember && !workspacePermission) {
    throw new ResourceNotFoundError(t("common.workspace"), null);
  }

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden">
      <div className="flex h-full">
        <MainNavigation
          organization={organization}
          user={user}
          workspace={{ id: workspace.id, name: workspace.name }}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          isDevelopment={IS_DEVELOPMENT}
          membershipRole={membership.role}
          isAccessControlAllowed={isAccessControlAllowed}
          isFormbricksSurveysConfigured={IS_FORMBRICKS_SURVEYS_CONFIGURED}
        />
        <div id="mainContent" className="flex flex-1 flex-col overflow-hidden bg-slate-50">
          <TopControlBar
            currentOrganizationId={organization.id}
            isMultiOrgEnabled={isMultiOrgEnabled}
            isOwnerOrManager={isOwnerOrManager}
            isAccessControlAllowed={isAccessControlAllowed}
            membershipRole={membership.role}
          />
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
};
