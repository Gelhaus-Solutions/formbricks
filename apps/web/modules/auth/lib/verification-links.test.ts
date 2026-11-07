import { describe, expect, test } from "vitest";
import {
  buildSignupWithoutVerificationSuccessPath,
  buildVerificationRequestedPath,
} from "./verification-links";

const WEBAPP_URL = "http://localhost:3000";

describe("verification link helpers", () => {
  test("builds a verification requested path with token only", () => {
    expect(buildVerificationRequestedPath({ token: "abc123" })).toBe(
      "/auth/verification-requested?token=abc123"
    );
  });

  test("builds a verification requested path that preserves callback URL", () => {
    expect(
      buildVerificationRequestedPath({
        token: "abc123",
        callbackUrl: "http://localhost:3000/invite?token=invite-token",
      })
    ).toBe(
      "/auth/verification-requested?token=abc123&callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Finvite%3Ftoken%3Dinvite-token"
    );
  });

  // ENG-2099: nothing about what happened to one address may ride along in this path. The
  // verification-requested page decides its "we couldn't send it" copy from IS_SMTP_CONFIGURED, which is
  // the same for every visitor: a per-sign-up flag here would have made the URL an account-existence
  // signal, since a send is only ever attempted for an address that was actually created.
  test("carries nothing beyond the token and the callback URL", () => {
    const path = buildVerificationRequestedPath({
      token: "abc123",
      callbackUrl: "http://localhost:3000/invite?token=invite-token",
    });

    expect([...new URL(path, WEBAPP_URL).searchParams.keys()].toSorted()).toEqual(["callbackUrl", "token"]);
  });

  // ENG-2091: this is the EMAIL_VERIFICATION_DISABLED=1 landing page, the self-hosted default. It has
  // to carry the invite callback for the same reason the verification path does, or the log-in button on
  // it drops an invited visitor at the app root with the invite unreachable.
  test("builds a no-verification success path that preserves the callback URL", () => {
    expect(
      buildSignupWithoutVerificationSuccessPath({
        token: "abc123",
        callbackUrl: "http://localhost:3000/invite?token=invite-token",
      })
    ).toBe(
      "/auth/signup-without-verification-success?token=abc123&callbackUrl=http%3A%2F%2Flocalhost%3A3000%2Finvite%3Ftoken%3Dinvite-token"
    );
  });

  test("omits the callback URL from the no-verification success path when there is none", () => {
    expect(buildSignupWithoutVerificationSuccessPath({ token: "abc123" })).toBe(
      "/auth/signup-without-verification-success?token=abc123"
    );
  });
});
