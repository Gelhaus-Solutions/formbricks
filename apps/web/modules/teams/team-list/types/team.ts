import type { TOrganizationRole } from "@formbricks/types/memberships";

/** A team of the organization, as the invite and workspace pickers list it. */
export type TOrganizationTeam = {
  id: string;
  name: string;
};

/** An organization member, as the members list reads it. */
export type TOrganizationMember = {
  id: string;
  name: string;
  role: TOrganizationRole;
};
