"use client";

import { RocketIcon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

interface MainNavigationNoticesProps {
  isCollapsed: boolean;
  isOwnerOrManager: boolean;
  isFormbricksCloud: boolean;
  isDevelopment: boolean;
  latestVersion: string;
}

/**
 * The notice card that sits above the sidebar's switchers: the self-hosted update prompt.
 *
 * Split out of MainNavigation rather than inlined: it is gated on several conditions, which pushed
 * that component's cognitive complexity past the limit Sonar enforces (ENG-3076). It renders nothing
 * unless every condition holds, so the caller can render this unconditionally.
 */
export const MainNavigationNotices = ({
  isCollapsed,
  isOwnerOrManager,
  isFormbricksCloud,
  isDevelopment,
  latestVersion,
}: Readonly<MainNavigationNoticesProps>) => {
  const { t } = useTranslation();

  // Collapsed, there is no room for the card, and it only ever addresses an owner/manager.
  if (isCollapsed || !isOwnerOrManager) {
    return null;
  }

  const showUpdateNotice = Boolean(latestVersion) && !isFormbricksCloud && !isDevelopment;

  return (
    <>
      {showUpdateNotice && (
        <Link
          href="https://github.com/formbricks/formbricks/releases"
          target="_blank"
          className="m-2 flex items-center gap-x-4 rounded-lg border border-slate-200 bg-slate-100 p-2 text-sm text-slate-800 hover:border-slate-300 hover:bg-slate-200">
          <p className="flex items-center justify-center gap-x-2 text-xs">
            <RocketIcon strokeWidth={1.5} className="mx-1 size-6 text-slate-900" />
            {t("common.new_version_available", { version: latestVersion })}
          </p>
        </Link>
      )}
    </>
  );
};
