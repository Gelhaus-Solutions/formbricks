"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Alert, AlertButton, AlertTitle } from "@/modules/ui/components/alert";
import { H4 } from "@/modules/ui/components/typography";

interface DocumentationLink {
  /** Null while the docs have no host; the link is then left out. */
  href: string | null;
  title: string;
}

interface DocumentationLinksSectionProps {
  readonly title: string;
  readonly links: DocumentationLink[];
}

export const DocumentationLinksSection = ({ title, links }: DocumentationLinksSectionProps) => {
  const { t } = useTranslation();
  const shownLinks = links.filter((link): link is DocumentationLink & { href: string } => link.href !== null);

  if (shownLinks.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-y-3">
      <H4>{title}</H4>
      {shownLinks.map((link) => (
        <Alert key={link.title} size="small" variant="default" role="status">
          <ArrowUpRight className="size-4" />
          <AlertTitle>{link.title}</AlertTitle>
          <AlertButton>
            <Link href={link.href} target="_blank" rel="noopener noreferrer">
              {t("common.read_docs")}
            </Link>
          </AlertButton>
        </Alert>
      ))}
    </div>
  );
};
