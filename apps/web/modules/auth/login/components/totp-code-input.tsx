"use client";

import { useEffect, useRef } from "react";
import type { Control, FieldValues, Path } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormField } from "@/modules/ui/components/form";
import { OTPInput } from "@/modules/ui/components/otp-input";

// Matches `totpOptions.digits` of the `twoFactor` plugin in modules/auth/lib/auth.ts.
const TOTP_CODE_LENGTH = 6;

interface TotpCodeInputProps<TFormValues extends FieldValues> {
  readonly control: Control<TFormValues>;
  readonly name: Path<TFormValues>;
}

/**
 * The code from the authenticator app, asked for after the password on an account with two-factor
 * authentication. It only collects the digits into the form field: the login form sends them to
 * `authClient.twoFactor.verifyTotp`, and the server keeps the session withheld until that succeeds.
 */
export const TotpCodeInput = <TFormValues extends FieldValues>({
  control,
  name,
}: TotpCodeInputProps<TFormValues>) => {
  const { t } = useTranslation();
  const groupRef = useRef<HTMLDivElement>(null);

  // The challenge replaces the password step on the same screen, so the first digit takes the focus.
  // OTPInput renders its boxes as plain siblings and takes no ref, hence the lookup through the group.
  useEffect(() => {
    groupRef.current?.querySelector("input")?.focus();
  }, []);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <div
          ref={groupRef}
          role="group"
          aria-label={t("auth.login.enter_your_two_factor_authentication_code")}
          className="w-full">
          <OTPInput
            value={typeof field.value === "string" ? field.value : ""}
            onChange={field.onChange}
            valueLength={TOTP_CODE_LENGTH}
          />
        </div>
      )}
    />
  );
};
