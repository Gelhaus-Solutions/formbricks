import { accountSettingsPath } from "@/modules/settings/lib/routes";

// Where a billing-role member (and other "you can't see this settings page" cases) gets sent. GForms has
// no billing page (GFORMS-7) and no license page (GFORMS-2), so it is the user's own profile, which every
// signed-in user can open.
export const getBillingFallbackPath = (): string => accountSettingsPath("profile");
