import { notFound } from "next/navigation";
import { isStorageAvailable } from "@formbricks/storage";
import { sanitizeThemeStyling } from "@formbricks/types/styling-values";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { cn } from "@/lib/cn";
import { IS_FORMBRICKS_CLOUD, SURVEY_BG_COLORS, UNSPLASH_ACCESS_KEY } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getWorkspace } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { CustomCssQueryClientProvider } from "@/modules/custom-css/components/custom-css-query-client-provider";
import { hasStylesInHeadScripts } from "@/modules/custom-css/components/lib/hints";
import { type TWorkspaceCustomCssAccess } from "@/modules/custom-css/components/types";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { EditLogo } from "@/modules/workspaces/settings/look/components/edit-logo";
import { EditPlacementForm } from "./components/edit-placement-form";
import { ThemeStyling } from "./components/theme-styling";

export const WorkspaceLookSettingsPage = async (props: {
  readonly params: Promise<{ workspaceId: string }>;
}) => {
  const params = await props.params;
  const t = await getTranslate();

  const { canManage, isOwner, isManager } = await getWorkspaceAuth(params.workspaceId);
  // Every card on this page saves through an action that asserts `workspace.manage`.
  const isReadOnly = !canManage;

  const workspace = await getWorkspace(params.workspaceId);

  if (!workspace) {
    return notFound();
  }

  const publicDomain = getPublicDomain();
  const isStorageConfigured = isStorageAvailable();

  // Mirrors the server's checks for `PATCH …/custom-css` (ENG-2949), which stay authoritative.
  const customCssAccess: TWorkspaceCustomCssAccess = {
    canEdit: isOwner || isManager,
    // Head scripts exist only on self-hosted, and the check is a plain string match (ENG-3415).
    hasHeadScriptStyles: !IS_FORMBRICKS_CLOUD && hasStylesInHeadScripts(workspace.customHeadScripts),
  };

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.appearance")} />
      {!isStorageConfigured && (
        <Alert variant="warning" role="status">
          <AlertDescription>{t("common.storage_not_configured")}</AlertDescription>
        </Alert>
      )}
      <SettingsCard
        title={t("workspace.look.theme")}
        className={cn(!isReadOnly && "max-w-7xl")}
        description={t("workspace.look.theme_settings_description")}>
        <CustomCssQueryClientProvider>
          <ThemeStyling
            workspaceId={params.workspaceId}
            // Theme values are not validated on write (ENG-3723), so a stored value that could add CSS
            // (ENG-2950) is dropped before it reaches the form and its preview.
            workspace={{ ...workspace, styling: sanitizeThemeStyling(workspace.styling) }}
            colors={SURVEY_BG_COLORS}
            isUnsplashConfigured={!!UNSPLASH_ACCESS_KEY}
            isReadOnly={isReadOnly}
            isStorageConfigured={isStorageConfigured}
            publicDomain={publicDomain}
            customCssAccess={customCssAccess}
          />
        </CustomCssQueryClientProvider>
      </SettingsCard>
      <SettingsCard title={t("common.logo")} description={t("workspace.look.logo_settings_description")}>
        <EditLogo
          workspace={workspace}
          workspaceId={params.workspaceId}
          isReadOnly={isReadOnly}
          isStorageConfigured={isStorageConfigured}
        />
      </SettingsCard>
      <SettingsCard
        title={t("workspace.look.app_survey_placement")}
        description={t("workspace.look.app_survey_placement_settings_description")}>
        <EditPlacementForm workspace={workspace} isReadOnly={isReadOnly} />
      </SettingsCard>
    </PageContentWrapper>
  );
};
