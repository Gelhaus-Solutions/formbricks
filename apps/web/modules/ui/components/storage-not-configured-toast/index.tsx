"use client";

import { useTranslation } from "react-i18next";
import { getDocsUrl } from "@/lib/docs-links";

const fileUploadsDocsUrl = getDocsUrl("/self-hosting/configuration/file-uploads");

interface StorageNotConfiguredToastProps {
  variant?: "notConfigured" | "uploadUnavailable";
}

export const StorageNotConfiguredToast = ({
  variant = "notConfigured",
}: Readonly<StorageNotConfiguredToastProps>) => {
  const { t } = useTranslation();

  return (
    <span className="whitespace-normal text-slate-900">
      {variant === "uploadUnavailable"
        ? t("common.file_upload_service_unavailable")
        : t("common.file_storage_not_set_up")}
      {fileUploadsDocsUrl && (
        <>
          {" "}
          <a
            className="whitespace-nowrap underline"
            href={fileUploadsDocsUrl}
            target="_blank"
            rel="noopener noreferrer">
            {t("common.learn_more")}
          </a>
        </>
      )}
    </span>
  );
};
