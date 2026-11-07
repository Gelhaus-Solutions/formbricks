const RELATIVE_URL_BASE = "http://localhost";

/**
 * Where sign-up lands when a verification email went out: the page that says so and offers a resend.
 * It carries the token and the invite callback, and nothing about what happened to the address
 * (ENG-2099).
 */
export const buildVerificationRequestedPath = ({
  token,
  callbackUrl,
}: {
  token: string;
  callbackUrl?: string | null;
}): string => {
  const verificationRequestedUrl = new URL("/auth/verification-requested", RELATIVE_URL_BASE);
  verificationRequestedUrl.searchParams.set("token", token);

  if (callbackUrl) {
    verificationRequestedUrl.searchParams.set("callbackUrl", callbackUrl);
  }

  return `${verificationRequestedUrl.pathname}${verificationRequestedUrl.search}`;
};

/**
 * Where sign-up lands when EMAIL_VERIFICATION_DISABLED=1: the DEFAULT for self-hosted (.env.example
 * and docker-compose both ship it) and what CI runs.
 *
 * It carries `callbackUrl` for the same reason the verification-requested path does: an invited visitor
 * whose address already has an account gets no email and nothing was created for them, so the log-in
 * link on that screen is their only way back to the invite. Without the callback it drops them at the
 * app root and the invite has to be reopened from the original mail (ENG-2091, raised by @Dhruwang and
 * @BhagyaAmarasinghe in review).
 *
 * Present for every invited visitor, never conditional on whether the account exists: that would make
 * the URL an account-existence signal (ENG-2099).
 */
export const buildSignupWithoutVerificationSuccessPath = ({
  token,
  callbackUrl,
}: {
  token: string;
  callbackUrl?: string | null;
}): string => {
  const successUrl = new URL("/auth/signup-without-verification-success", RELATIVE_URL_BASE);
  successUrl.searchParams.set("token", token);

  if (callbackUrl) {
    successUrl.searchParams.set("callbackUrl", callbackUrl);
  }

  return `${successUrl.pathname}${successUrl.search}`;
};
