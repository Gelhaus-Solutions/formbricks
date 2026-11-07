import { OrganizationRole } from "@formbricks/database/prisma";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";

export const getRoles = (): Result<{ data: string[] }, ApiErrorResponseV2> => {
  try {
    const roles = Object.values(OrganizationRole);

    // The billing role went with Cloud billing (GFORMS-7): it stays in the enum for existing members but
    // can no longer be given, so the API does not offer it.
    const filteredRoles = roles.filter((role) => role !== "billing");
    return ok({
      data: filteredRoles,
    });
  } catch {
    return err({
      type: "internal_server_error",
      details: [{ field: "roles", issue: "Failed to get roles" }],
    });
  }
};
