import "server-only";
import type { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { getIsContactsEnabled } from "@/modules/features/lib/flags";

/**
 * The contacts gate of the v2 management API: null when the organization has contacts, otherwise the
 * forbidden error to answer with. Run it after authentication, so an unauthenticated caller learns
 * nothing about the organization.
 */
export const checkContactsEnabledApiV2 = async (
  organizationId: string
): Promise<ApiErrorResponseV2 | null> => {
  if (await getIsContactsEnabled(organizationId)) return null;

  return {
    type: "forbidden",
    details: [{ field: "organizationId", issue: "Contacts are not enabled for this organization." }],
  };
};
