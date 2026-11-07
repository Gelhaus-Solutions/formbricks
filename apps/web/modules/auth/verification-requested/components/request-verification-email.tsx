"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { Button } from "@/modules/ui/components/button";
import { resendVerificationEmailAction } from "../actions";

interface RequestVerificationEmailProps {
  readonly email: string | null;
  readonly callbackUrl?: string | null;
}

export const RequestVerificationEmail = ({ email, callbackUrl }: RequestVerificationEmailProps) => {
  const { t } = useTranslation();
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        location.reload();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const requestVerificationEmail = async () => {
    if (!email) return toast.error(t("auth.verification-requested.no_email_provided"));
    const response = await resendVerificationEmailAction({
      email,
      callbackUrl: callbackUrl ?? undefined,
    });
    if (response?.data) {
      toast.success(t("auth.verification-requested.verification_email_resent_successfully"));
    } else {
      toast.error(getFormattedErrorMessage(response));
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={requestVerificationEmail} className="w-full justify-center">
        {t("auth.verification-requested.resend_verification_email")}
      </Button>
    </>
  );
};
