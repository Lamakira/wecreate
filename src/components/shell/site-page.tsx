import type { ReactNode } from "react";

import { SiteFooter } from "@/components/shell/site-footer";
import { SiteShell } from "@/components/shell/site-shell";
import { DEFAULT_DISCIPLINE, type Discipline } from "@/discipline";
import { readChrome, readLegalDay } from "@/managed-content";
import { effectiveLegalTerms } from "@/managed-content/legal";
import type { LegalDocument, SiteSettings } from "@/managed-content/types";
import { localBusinessJsonLd } from "@/seo/json-ld";
import { JsonLdScript } from "@/seo/json-ld-script";
import { siteUrl } from "@/site-config";

interface SitePageProps {
  settings: SiteSettings;
  legalDocuments: LegalDocument[];
  /**
   * The Discipline this page belongs to, which decides its colour theme and
   * its brand mark. Vidéographie unless the page says otherwise.
   */
  discipline?: Discipline;
  children: ReactNode;
}

/**
 * Header, footer and the skip-target main landmark, from one cached read.
 *
 * The page's Discipline is declared once, on `<main>`, and `globals.css`
 * themes the whole document from it — header, footer and drawers included.
 *
 * They live here rather than in the shared `(site)` layout so a public page
 * is a single `"use cache"` fill: layout and page are separate work units
 * under Cache Components, and a second tagged read is a second provider
 * round trip.
 */
export async function SitePage({
  settings,
  legalDocuments,
  discipline = DEFAULT_DISCIPLINE,
  children,
}: SitePageProps) {
  const legalTerms = effectiveLegalTerms(
    legalDocuments,
    await readLegalDay(),
  );

  return (
    <>
      <JsonLdScript data={localBusinessJsonLd(settings, siteUrl())} />
      <SiteShell settings={settings} discipline={discipline}>
        <main
          id="contenu"
          data-discipline={discipline}
          className="pt-header-offset"
        >
          {children}
        </main>
        <SiteFooter
          settings={settings}
          legalLinks={legalTerms.inForce}
          discipline={discipline}
        />
      </SiteShell>
    </>
  );
}

/**
 * The same chrome, for surfaces that are not a public page of their own —
 * checkout and Order Access. It reads the site entry itself, which is the one
 * entry those surfaces' other reads (products, legal terms) share.
 *
 * Not for the 404 page: that is rendered into every public response, so a read
 * there would cost every cold render a second provider round trip. Routes that
 * can be missing something (projects, products, legal documents) render
 * `NotFoundContent` in their own `SitePage` instead.
 */
export async function SiteChrome({ children }: { children: ReactNode }) {
  const content = await readChrome();
  return (
    <SitePage
      settings={content.settings}
      legalDocuments={content.legalDocuments}
    >
      {children}
    </SitePage>
  );
}
