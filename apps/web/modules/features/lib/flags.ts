/**
 * GForms' own feature flags (GFORMS-2). They replace Formbricks' Enterprise license check: there is no
 * license key, no license server and no per-organization limit.
 *
 * A feature whose code is part of GForms is on for every organization. A feature whose code still sits
 * in the Enterprise folder is off: that folder is being deleted (GFORMS-3) and never runs in
 * production. Its clean-room rebuild turns the flag on when it lands; the comment names the item.
 *
 * The getters keep the names and async shape the call sites already use, so a call site only changes
 * its import, and an upstream merge that adds a call site resolves the same way.
 */
export const GFORMS_FEATURES = {
  aiSmartTools: true,
  biggerUploadFileSize: true,
  bulkInvite: true,
  customCss: true,
  multiOrg: true,
  removeBranding: true,
  spamProtection: true,

  accessControl: false, // GFORMS-12
  auditLogs: false, // GFORMS-11
  contacts: false, // GFORMS-18
  creatives: false, // GFORMS-21
  dashboards: false, // GFORMS-25
  dataRetention: false, // GFORMS-22
  feedbackDirectories: false, // GFORMS-24
  quotas: false, // GFORMS-19
  samlSso: false, // GFORMS-16
  sso: false, // GFORMS-14
  twoFactorAuth: false, // GFORMS-13
  whitelabel: false, // GFORMS-5
  workflows: false, // GFORMS-20
} as const satisfies Record<string, boolean>;

export type TGFormsFeature = keyof typeof GFORMS_FEATURES;

export const isGFormsFeatureEnabled = (feature: TGFormsFeature): boolean => GFORMS_FEATURES[feature];

/** The organization argument is accepted for the call sites' sake; no flag differs by organization. */
const flag =
  (feature: TGFormsFeature) =>
  async (_organizationId?: string): Promise<boolean> =>
    GFORMS_FEATURES[feature];

export const getIsAISmartToolsEnabled = flag("aiSmartTools");
export const getBiggerUploadFileSizePermission = flag("biggerUploadFileSize");
export const getBulkInvitePermission = flag("bulkInvite");
export const getCustomCssPermission = flag("customCss");
export const getIsMultiOrgEnabled = flag("multiOrg");
export const getRemoveBrandingPermission = flag("removeBranding");
export const getIsSpamProtectionEnabled = flag("spamProtection");

export const getAccessControlPermission = flag("accessControl");
export const getIsAuditLogsEnabled = flag("auditLogs");
export const getIsContactsEnabled = flag("contacts");
export const getIsCreativesEnabled = flag("creatives");
export const getIsDashboardsEnabled = flag("dashboards");
export const getIsDataRetentionEnabled = flag("dataRetention");
export const getIsFeedbackDirectoriesEnabled = flag("feedbackDirectories");
export const getIsQuotasEnabled = flag("quotas");
export const getIsSamlSsoEnabled = flag("samlSso");
export const getIsSsoEnabled = flag("sso");
export const getIsTwoFactorAuthEnabled = flag("twoFactorAuth");
export const getWhiteLabelPermission = flag("whitelabel");
export const getIsWorkflowsEnabled = flag("workflows");

/** GForms sets no workspace limit (GFORMS-6). Infinity keeps every `count >= limit` check false. */
export const getOrganizationWorkspacesLimit = async (_organizationId?: string): Promise<number> =>
  Number.POSITIVE_INFINITY;
