import { UNKNOWN_DATA } from "../types/audit-log";
import type { TAuditRequestMetadata } from "../types/request-metadata";

export const UNKNOWN_AUDIT_REQUEST_METADATA: TAuditRequestMetadata = {
  ipAddress: UNKNOWN_DATA,
  userAgent: UNKNOWN_DATA,
};

/**
 * The request's origin for an audit event. GForms records no audit events until GFORMS-11, so it does
 * not read the request yet and answers with unknown values.
 */
export const getAuditRequestMetadata = async (_headers?: Headers): Promise<TAuditRequestMetadata> =>
  UNKNOWN_AUDIT_REQUEST_METADATA;
