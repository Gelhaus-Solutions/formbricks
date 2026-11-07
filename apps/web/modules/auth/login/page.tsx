import { Metadata } from "next";
import { PASSWORD_RESET_DISABLED, SIGNUP_ENABLED, WEBAPP_URL } from "@/lib/constants";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import {
  getInviteTokenFromCallbackUrl,
  getRelativeCallbackUrl,
  getSearchParamString,
  resolveAuthCallbackUrl,
} from "@/modules/auth/lib/callback-url";
import { getIsMultiOrgEnabled } from "@/modules/features/lib/flags";
import { LoginForm } from "./components/login-form";

export const metadata: Metadata = {
  title: "Login",
  description: "Open-source Experience Management. Free & open source.",
};

export const LoginPage = async ({
  searchParams: searchParamsProps,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) => {
  const [isMultiOrgEnabled, searchParams] = await Promise.all([getIsMultiOrgEnabled(), searchParamsProps]);

  const resolvedCallbackUrl =
    resolveAuthCallbackUrl({
      searchParamCallbackUrl: searchParams.callbackUrl,
      webAppUrl: WEBAPP_URL,
    }) ?? WEBAPP_URL;
  const resolvedCallbackPath = getRelativeCallbackUrl(resolvedCallbackUrl, WEBAPP_URL);
  const inviteToken = getInviteTokenFromCallbackUrl(resolvedCallbackUrl, WEBAPP_URL);

  return (
    <FormWrapper>
      <LoginForm
        publicSignUpEnabled={SIGNUP_ENABLED}
        passwordResetEnabled={!PASSWORD_RESET_DISABLED}
        isMultiOrgEnabled={isMultiOrgEnabled}
        // ENG-2562: set when a verification succeeded but the session was withheld, because the
        // browser presenting the link was not the one that signed up. Without it the user is bounced
        // here with no explanation right after being told their address was verified.
        emailJustVerified={getSearchParamString(searchParams.verified) === "1"}
        prefilledEmail={getSearchParamString(searchParams.email)}
        inviteToken={inviteToken}
        resolvedCallbackPath={resolvedCallbackPath}
        resolvedCallbackUrl={resolvedCallbackUrl}
      />
    </FormWrapper>
  );
};
