import { z } from "zod";

/**
 * A team's access to one workspace, as the `WorkspaceTeamPermission` enum in the Prisma schema stores it
 * (GFORMS-3 seam). `read` sees, `readWrite` also edits, `manage` also changes the workspace's settings.
 */
export const ZTeamPermission = z.enum(["read", "readWrite", "manage"]);

export type TTeamPermission = z.infer<typeof ZTeamPermission>;
