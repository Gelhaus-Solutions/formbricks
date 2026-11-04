/**
 * GForms' audit-log types (GFORMS-3 seam). They stand in for the Enterprise audit logs, which leave the
 * tree with apps/web/modules/ee. The audit-log rebuild (GFORMS-11) narrows the action and target names
 * and stores the events; until then nothing is recorded.
 */

/** What happened, such as `created` or `passwordReset`. */
export type TAuditAction = string;

/** What it happened to, such as `survey` or `organization`. */
export type TAuditTarget = string;

export type TAuditStatus = "success" | "failure";

export type TAuditUserType = "user" | "api" | "system";

/** Stands in for an id or value that is not known when the event is built. */
export const UNKNOWN_DATA = "unknown";

export type TAuditEvent = {
  action: TAuditAction;
  targetType: TAuditTarget;
  userId: string;
  userType: TAuditUserType;
  targetId: string;
  organizationId: string;
  status: TAuditStatus;
  oldObject?: Record<string, unknown> | null;
  newObject?: Record<string, unknown> | null;
  eventId?: string;
  apiUrl?: string;
};
