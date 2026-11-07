"use server";

import { z } from "zod";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { getHasNoOrganizations } from "@/lib/instance/service";
import { createMembership } from "@/lib/membership/service";
import { createOrganization } from "@/lib/organization/service";
import { capturePostHogEvent, getEmailDomain, groupIdentifyPostHog } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { DEFAULT_WORKSPACE_NAME } from "@/lib/workspace/constants";
import { withAuditLogging } from "@/modules/audit-log/lib/handler";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getIsMultiOrgEnabled } from "@/modules/features/lib/flags";
import { createWorkspace } from "@/modules/workspaces/settings/lib/workspace";

const ZCreateOrganizationAction = z.object({
  organizationName: z.string(),
});

export const createOrganizationAction = authenticatedActionClient
  .inputSchema(ZCreateOrganizationAction)
  .action(
    withAuditLogging("created", "organization", async ({ ctx, parsedInput }) => {
      await applyRateLimit(rateLimitConfigs.actions.createOrganization, ctx.user.id);

      const hasNoOrganizations = await getHasNoOrganizations();
      const isMultiOrgEnabled = await getIsMultiOrgEnabled();

      if (!hasNoOrganizations && !isMultiOrgEnabled) {
        throw new OperationNotAllowedError("This action can only be performed on a fresh instance.");
      }

      const newOrganization = await createOrganization({
        name: parsedInput.organizationName,
      });

      await createMembership(newOrganization.id, ctx.user.id, {
        role: "owner",
        accepted: true,
      });

      // The organization was created just above and owns no workspaces, so there is no cap to enforce.
      const newWorkspace = await createWorkspace(
        newOrganization.id,
        { name: DEFAULT_WORKSPACE_NAME },
        { workspaceLimit: null }
      );

      ctx.auditLoggingCtx.organizationId = newOrganization.id;
      ctx.auditLoggingCtx.newObject = newOrganization;

      groupIdentifyPostHog("organization", newOrganization.id, {
        name: newOrganization.name,
        email_domain: getEmailDomain(ctx.user.email),
      });
      groupIdentifyPostHog("workspace", newWorkspace.id, { name: newWorkspace.name });

      capturePostHogEvent(
        ctx.user.id,
        "organization_created",
        {
          organization_id: newOrganization.id,
          is_first_org: hasNoOrganizations,
        },
        { organizationId: newOrganization.id, workspaceId: newWorkspace.id }
      );

      capturePostHogEvent(
        ctx.user.id,
        "workspace_created",
        {
          organization_id: newOrganization.id,
          workspace_id: newWorkspace.id,
          name: newWorkspace.name,
        },
        { organizationId: newOrganization.id, workspaceId: newWorkspace.id }
      );

      return newOrganization;
    })
  );
