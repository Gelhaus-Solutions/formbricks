"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Alert, AlertButton, AlertTitle } from "@/modules/ui/components/alert";

interface DocumentationLink {
  title: string;
  /** Null while the docs have no host; the link is then left out. */
  href: string | null;
}

interface DocumentationLinksProps {
  readonly links: DocumentationLink[];
}

export const DocumentationLinks = ({ links }: DocumentationLinksProps) => {
  const { t } = useTranslation();
  const shownLinks = links.filter((link): link is DocumentationLink & { href: string } => link.href !== null);

  if (shownLinks.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-y-2">
      {shownLinks.map((link) => (
        <div key={link.title} className="flex w-full flex-col gap-3">
          <Alert variant="outbound" size="small" role="status">
            <AlertTitle>{link.title}</AlertTitle>
            <AlertButton asChild>
              <Link
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-900 hover:underline">
                {t("common.learn_more")}
              </Link>
            </AlertButton>
          </Alert>
        </div>
      ))}
    </div>
  );
};
