import "server-only";
import type { AuthHookContext } from "./auth-hook-context";
import { auditFailedAuthAfter } from "./better-auth-observability";
import { twoFactorBackfillAfterHandler } from "./better-auth-two-factor-backfill";
import { verificationAutoSignInAfterHandler } from "./better-auth-verification-autosignin";
import {
  requireOAuthConsentOnRefreshAfterHandler,
  revokeTokensBeyondConsentAfterHandler,
} from "./oauth-grant-revocation";

/**
 * Composed Better Auth `hooks.after` chain, extracted from auth.ts so the order is unit-testable. Each
 * handler checks its own path and returns at once on any other, so only the two `/sign-in/email`
 * handlers ever act on the same request; the order of the rest is pinned so a reorder is a deliberate edit.
 */
export const runAfterAuthHooks = async (ctx: AuthHookContext): Promise<void> => {
  // Records a failed password sign-in (parity with NextAuth's `logAuthAttempt`).
  await auditFailedAuthAfter(ctx);
  // ENG-1824: heal legacy 2FA enrollments (no `TwoFactor` row) on a successful password sign-in, before
  // the 2FA challenge.
  await twoFactorBackfillAfterHandler(ctx);
  // ENG-2562: mint the post-verification session only for the browser that signed up. Only touches
  // `/verify-email`, and is the only handler here that adds a session rather than inspecting one.
  await verificationAutoSignInAfterHandler(ctx);
  // ENG-2499 / ENG-3529: a refresh whose consent was revoked, or narrowed below the token's scopes, is
  // refused and the tokens beyond the consent revoked; narrowing a consent revokes them right away. Only
  // touch `/oauth2/token`, `/oauth2/consent` and `/oauth2/update-consent`.
  await requireOAuthConsentOnRefreshAfterHandler(ctx);
  await revokeTokensBeyondConsentAfterHandler(ctx);
};
