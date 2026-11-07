"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError, TooManyRequestsError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";
import { WEBAPP_URL } from "@/lib/constants";
import { actionClient } from "@/lib/utils/action-client";
import { MAX_CALLBACK_URL_LENGTH, getValidatedCallbackUrl } from "@/lib/utils/url";
import { withAuditLogging } from "@/modules/audit-log/lib/handler";
import { auth } from "@/modules/auth/lib/auth";
import {
  SIGNUP_INTENT_COOKIE_NAME,
  SIGNUP_INTENT_COOKIE_OPTIONS,
  classifySignupIntent,
  createSignupIntentToken,
} from "@/modules/auth/lib/signup-intent";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { applyIPRateLimit, applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";

const ZResendVerificationEmailAction = z.object({
  email: ZUserEmail,
  // The same bound `getValidatedCallbackUrl` enforces, so a callback this action accepts is one the
  // rest of the app would accept too: two independent numbers here drifted once already.
  callbackUrl: z.string().max(MAX_CALLBACK_URL_LENGTH).optional(),
});

export const resendVerificationEmailAction = actionClient.inputSchema(ZResendVerificationEmailAction).action(
  withAuditLogging("verificationEmailSent", "user", async ({ ctx, parsedInput }) => {
    await applyIPRateLimit(rateLimitConfigs.auth.verifyEmail);

    const user = await getUserByEmail(parsedInput.email);
    if (!user) {
      throw new ResourceNotFoundError("user", parsedInput.email);
    }
    const validatedCallbackUrl = getValidatedCallbackUrl(parsedInput.callbackUrl, WEBAPP_URL) ?? undefined;
    if (user.emailVerified) {
      return {
        success: true,
      };
    }
    // Anyone can ask for this account's email from here. Counted per account, only when an email is sent,
    // and below the recipient cap, so strangers rotating IPs cannot spend the whole cap and leave the
    // user's own sign-in with none.
    try {
      await applyRateLimit(rateLimitConfigs.auth.verifyEmailPerAccount, user.id);
    } catch (error) {
      // Answer quietly, exactly as a sent email does. Only unverified accounts reach this line, so an error
      // here would tell anyone which addresses have one: the same reasoning that makes the callback in
      // auth.ts swallow the same refusal.
      if (error instanceof TooManyRequestsError) {
        return { success: true };
      }
      throw error;
    }
    ctx.auditLoggingCtx.userId = user.id;
    // Email verification is Better Auth-native (ENG-1054 decommission): BA mints its own verification
    // token and sends the verify link through the emailVerification.sendVerificationEmail callback in
    // auth.ts. The user is unverified here (the guard above returned for verified users), so BA takes its
    // no-session, enumeration-safe path.
    await auth.api.sendVerificationEmail({
      body: { email: user.email, callbackURL: validatedCallbackUrl },
      headers: await headers(),
    });

    // ENG-2562: re-pair the sign-up intent cookie with the link just minted. The cookie's clock starts at
    // sign-up while every resent link gets a fresh hour, so without this a resend's link outlives the
    // cookie and the sign-up browser itself lands on the withheld path. Strictly a refresh (the browser
    // must already hold a valid cookie naming THIS user), so it extends evidence the browser has, and
    // never arms one that lacks it: an unauthenticated caller must not be able to mint sign-up proof for
    // an arbitrary account by asking for a resend. A browser whose cookie has already expired therefore
    // stays on the withheld path (documented residual). Non-fatal, like the sign-up issuance: the email
    // above has already gone out, so a failure here must cost exactly the auto-sign-in UX, never the
    // resend itself.
    try {
      const cookieStore = await cookies();
      if (classifySignupIntent(cookieStore.get(SIGNUP_INTENT_COOKIE_NAME)?.value, user.id) === "valid") {
        cookieStore.set(
          SIGNUP_INTENT_COOKIE_NAME,
          createSignupIntentToken(user.id),
          SIGNUP_INTENT_COOKIE_OPTIONS
        );
      }
    } catch (error) {
      logger.error({ error, userId: user.id }, "Failed to refresh the sign-up intent cookie on resend");
    }
    return {
      success: true,
    };
  })
);
