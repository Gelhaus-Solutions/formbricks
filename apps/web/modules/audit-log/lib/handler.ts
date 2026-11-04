import type { TAuditAction, TAuditEvent, TAuditTarget } from "../types/audit-log";
import type { TAuditRequestMetadata } from "../types/request-metadata";

/**
 * GForms' audit-log entry points (GFORMS-3 seam). Every call site keeps its call, so the audit-log
 * rebuild (GFORMS-11) only has to fill these in. Until then they record nothing, which is what the
 * Enterprise audit logs did on an instance without the license feature.
 */

/** Wraps a server action so it can be audited; today it returns the action unchanged. */
export const withAuditLogging = <TArgs, TResult>(
  _action: TAuditAction,
  _targetType: TAuditTarget,
  handler: (args: TArgs) => Promise<TResult>
): ((args: TArgs) => Promise<TResult>) => handler;

/** Queues an event raised while handling a request. */
export const queueAuditEvent = async (_event: TAuditEvent): Promise<void> => {};

/** Queues an event raised outside a request, such as in a job. */
export const queueAuditEventWithoutRequest = async (
  _event: TAuditEvent & { requestMetadata?: TAuditRequestMetadata }
): Promise<void> => {};

/** Queues an event without making the caller wait for it. */
export const queueAuditEventBackground = async (_event: TAuditEvent): Promise<void> => {};
