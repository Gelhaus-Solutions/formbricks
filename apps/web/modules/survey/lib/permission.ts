import { OperationNotAllowedError } from "@formbricks/types/errors";
import { getIsSpamProtectionEnabled } from "@/modules/features/lib/flags";

/**
 * Checks if the organization has spam protection enabled.
 * @param {string} organizationId - The ID of the organization to check.
 * @returns {Promise<void>} A promise that resolves if spam protection is enabled.
 * @throws {OperationNotAllowedError} If spam protection is not enabled for the organization.
 */
export const checkSpamProtectionPermission = async (organizationId: string): Promise<void> => {
  const isSpamProtectionEnabled = await getIsSpamProtectionEnabled(organizationId);
  if (!isSpamProtectionEnabled) {
    throw new OperationNotAllowedError("Spam protection is not enabled for this organization");
  }
};

// GForms sells no plans (GFORMS-7): custom redirect URLs and links in surveys are open to every
// organization.
export const getExternalUrlsPermission = async (_organizationId: string): Promise<boolean> => true;
