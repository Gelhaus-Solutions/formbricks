import "server-only";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { getAccessControlPermission } from "@/modules/features/lib/flags";

/**
 * Refuses an action that assigns an organization role other than owner, or a team, while the
 * organization has no access control (GFORMS-12 rebuilds it). Resolves when it may go ahead.
 */
export const checkRoleManagementPermission = async (organizationId: string): Promise<void> => {
  if (!(await getAccessControlPermission(organizationId))) {
    throw new OperationNotAllowedError("Role management is not allowed for this organization");
  }
};
