import { describe, expect, test, vi } from "vitest";
import { UNKNOWN_DATA } from "../types/audit-log";
import { queueAuditEvent, withAuditLogging } from "./handler";
import { UNKNOWN_AUDIT_REQUEST_METADATA, getAuditRequestMetadata } from "./request-metadata";

describe("GForms audit-log seam", () => {
  test("withAuditLogging hands back the action itself, so its result and errors pass through", async () => {
    const handler = vi.fn(async ({ value }: { value: number }) => value * 2);
    const wrapped = withAuditLogging("updated", "survey", handler);

    expect(wrapped).toBe(handler);
    await expect(wrapped({ value: 21 })).resolves.toBe(42);
  });

  test("queueing an event records nothing and never throws", async () => {
    await expect(
      queueAuditEvent({
        action: "deleted",
        targetType: "file",
        userId: UNKNOWN_DATA,
        userType: "user",
        targetId: UNKNOWN_DATA,
        organizationId: UNKNOWN_DATA,
        status: "success",
      })
    ).resolves.toBeUndefined();
  });

  test("request metadata is unknown until the rebuild reads the request", async () => {
    await expect(getAuditRequestMetadata()).resolves.toEqual(UNKNOWN_AUDIT_REQUEST_METADATA);
    expect(UNKNOWN_AUDIT_REQUEST_METADATA).toEqual({ ipAddress: "unknown", userAgent: "unknown" });
  });
});
