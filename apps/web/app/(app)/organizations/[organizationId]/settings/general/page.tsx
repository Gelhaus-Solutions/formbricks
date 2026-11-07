import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { AISettingsToggle } from "@/app/(app)/workspaces/[workspaceId]/settings/organization/general/components/AISettingsToggle";
import { CreateOrganizationCard } from "@/app/(app)/workspaces/[workspaceId]/settings/organization/general/components/CreateOrganizationCard";
import { DeleteOrganization } from "@/app/(app)/workspaces/[workspaceId]/settings/organization/general/components/DeleteOrganization";
import { EditOrganizationSettingsForm } from "@/app/(app)/workspaces/[workspaceId]/settings/organization/general/components/EditOrganizationSettingsForm";
import { isInstanceAIConfigured } from "@/lib/ai/service";
import { getTranslate } from "@/lingodotdev/server";
import { getIsAISmartToolsEnabled, getIsMultiOrgEnabled } from "@/modules/features/lib/flags";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { redirectBillingRoleFromRestrictedOrgSettings } from "@/modules/settings/lib/redirect-billing-role";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import packageJson from "@/package.json";

const Page = async (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const params = await props.params;
  const t = await getTranslate();

  await redirectBillingRoleFromRestrictedOrgSettings(params.organizationId);

  const { currentUserMembership, organization, isOwner } = await getOrganizationAuth(params.organizationId);

  const [isMultiOrgEnabled, hasAIPermission] = await Promise.all([
    getIsMultiOrgEnabled(),
    getIsAISmartToolsEnabled(organization.id),
  ]);

  const isDeleteDisabled = !isOwner || !isMultiOrgEnabled;
  const currentUserRole = currentUserMembership?.role;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("workspace.settings.general.organization_settings")} />
      <SettingsCard
        title={t("workspace.settings.general.organization_settings")}
        description={t("workspace.settings.general.organization_settings_description")}>
        <EditOrganizationSettingsForm organization={organization} membershipRole={currentUserRole} />
      </SettingsCard>
      <SettingsCard
        title={t("workspace.settings.general.ai_enabled")}
        description={t("workspace.settings.general.ai_enabled_description")}>
        <AISettingsToggle
          organization={organization}
          membershipRole={currentUserRole}
          isInstanceAIConfigured={isInstanceAIConfigured()}
          hasAIPermission={hasAIPermission}
        />
      </SettingsCard>
      {isMultiOrgEnabled && (
        <>
          <SettingsCard
            title={t("workspace.settings.general.delete_organization")}
            description={t("workspace.settings.general.delete_organization_description")}>
            <DeleteOrganization
              organization={organization}
              isDeleteDisabled={isDeleteDisabled}
              isUserOwner={currentUserRole === "owner"}
            />
          </SettingsCard>
          <CreateOrganizationCard />
        </>
      )}

      <div className="space-y-2">
        <IdBadge id={organization.id} label={t("common.organization_id")} variant="column" />
        <IdBadge id={packageJson.version} label={t("common.formbricks_version")} variant="column" />
      </div>
    </PageContentWrapper>
  );
};

export default Page;
