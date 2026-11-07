import { describe, expect, test, vi } from "vitest";
import { runAfterAuthHooks } from "./after-auth-hooks";
import { auditFailedAuthAfter } from "./better-auth-observability";
import { twoFactorBackfillAfterHandler } from "./better-auth-two-factor-backfill";
import { verificationAutoSignInAfterHandler } from "./better-auth-verification-autosignin";
import {
  requireOAuthConsentOnRefreshAfterHandler,
  revokeTokensBeyondConsentAfterHandler,
} from "./oauth-grant-revocation";

vi.mock("./better-auth-observability", () => ({ auditFailedAuthAfter: vi.fn() }));
vi.mock("./better-auth-two-factor-backfill", () => ({ twoFactorBackfillAfterHandler: vi.fn() }));
vi.mock("./better-auth-verification-autosignin", () => ({
  verificationAutoSignInAfterHandler: vi.fn(),
}));
vi.mock("./oauth-grant-revocation", () => ({
  requireOAuthConsentOnRefreshAfterHandler: vi.fn(),
  revokeTokensBeyondConsentAfterHandler: vi.fn(),
}));

describe("runAfterAuthHooks", () => {
  test("runs every after handler once, in the pinned order", async () => {
    const calls: string[] = [];
    const record = (name: string) => async () => {
      calls.push(name);
    };
    vi.mocked(auditFailedAuthAfter).mockImplementation(record("audit"));
    vi.mocked(twoFactorBackfillAfterHandler).mockImplementation(record("two-factor-backfill"));
    vi.mocked(verificationAutoSignInAfterHandler).mockImplementation(record("verification-auto-sign-in"));
    vi.mocked(requireOAuthConsentOnRefreshAfterHandler).mockImplementation(record("oauth-refresh-consent"));
    vi.mocked(revokeTokensBeyondConsentAfterHandler).mockImplementation(record("oauth-consent-narrowed"));

    await runAfterAuthHooks({} as never);

    // Only the failed sign-in audit and the two-factor backfill share a path (`/sign-in/email`, one on a
    // failed attempt, the other on a successful one), so the order is pinned to make a reorder deliberate.
    expect(calls).toEqual([
      "audit",
      "two-factor-backfill",
      "verification-auto-sign-in",
      "oauth-refresh-consent",
      "oauth-consent-narrowed",
    ]);
  });
});
