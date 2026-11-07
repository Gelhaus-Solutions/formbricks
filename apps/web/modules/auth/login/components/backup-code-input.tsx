"use client";

import type { Control, FieldValues, Path } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";

interface BackupCodeInputProps<TFormValues extends FieldValues> {
  readonly control: Control<TFormValues>;
  readonly name: Path<TFormValues>;
}

/**
 * One of the account's backup codes, the fallback for a user without their authenticator app. It only
 * collects the code into the form field: the login form sends it to
 * `authClient.twoFactor.verifyBackupCode`, which accepts each code once.
 */
export const BackupCodeInput = <TFormValues extends FieldValues>({
  control,
  name,
}: BackupCodeInputProps<TFormValues>) => {
  const { t } = useTranslation();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="w-full text-left">
          <FormLabel>{t("auth.login.backup_code")}</FormLabel>
          <FormControl>
            <Input
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              // Shown in place of the code boxes after "Use a backup code", so it takes the focus.
              autoFocus
              required
              name={field.name}
              value={typeof field.value === "string" ? field.value : ""}
              onBlur={field.onBlur}
              onChange={(event) => field.onChange(event)}
              placeholder="xxxxx-xxxxx"
            />
          </FormControl>
          <FormError role="alert" />
        </FormItem>
      )}
    />
  );
};
