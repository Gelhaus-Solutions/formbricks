/** Where a request came from, kept with an audit event (GFORMS-3 seam). */
export type TAuditRequestMetadata = {
  ipAddress: string;
  userAgent: string;
};
