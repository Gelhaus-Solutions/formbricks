import type { TTeamPermission } from "@/modules/workspaces/types/team-permission";

export type TTeamPermissionFlags = {
  hasReadAccess: boolean;
  hasReadWriteAccess: boolean;
  hasManageAccess: boolean;
};

/**
 * Which one permission a member holds. The flags are exact, not cumulative: `hasReadAccess` means the
 * member holds `read` and nothing more, which is how the call sites test for a read-only member. No
 * permission sets no flag.
 */
export const getTeamPermissionFlags = (
  permission: TTeamPermission | null | undefined
): TTeamPermissionFlags => ({
  hasReadAccess: permission === "read",
  hasReadWriteAccess: permission === "readWrite",
  hasManageAccess: permission === "manage",
});
