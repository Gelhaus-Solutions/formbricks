import "server-only";
import { getOrganization } from "@/lib/organization/service";

/**
 * The logo an organization uses in the emails GForms sends for it, or null when it has none
 * (GFORMS-5). It is read from the organization's whitelabel settings; editing it comes with GFORMS-5.
 */
export const getOrganizationLogoUrl = async (organizationId: string): Promise<string | null> => {
  const organization = await getOrganization(organizationId);
  return organization?.whitelabel?.logoUrl ?? null;
};
