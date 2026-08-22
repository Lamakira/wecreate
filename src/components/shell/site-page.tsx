import type { ReactNode } from "react";

import { SiteFooter } from "@/components/shell/site-footer";
import { SiteShell } from "@/components/shell/site-shell";
import { readChrome, readLegalDay } from "@/managed-content";
import { effectiveLegalTerms } from "@/managed-content/legal";
import type { LegalDocument, SiteSettings } from "@/managed-content/types";
import { localBusinessJsonLd } from "@/seo/json-ld";
import { JsonLdScript } from "@/seo/json-ld-script";
import { siteUrl } from "@/site-config";

interface SitePageProps {
  settings: SiteSettings;
  legalDocuments: LegalDocument[];
  children: ReactNode;
}

/**
 * Header, footer and the skip-target main landmark, from one cached read.
 *
 * They live here rather than in the shared `(site)` layout so a public page
 * is a single `"use cache"` fill: layout and page are separate work units
 * under Cache Components, and a second tagged read is a second provider
 * round trip.
 */
export async function SitePage({
  settings,
  legalDocuments,
  children,
}: SitePageProps) {
  const legalTerms = effectiveLegalTerms(
    legalDocuments,
    await readLegalDay(),
  );

  return (
    <>
      <JsonLdScript data={localBusinessJsonLd(settings, siteUrl())} />
      <SiteShell settings={settings}>
        <main id="contenu" className="pt-header-offset">
          {children}
        </main>
        <SiteFooter settings={settings} legalLinks={legalTerms.inForce} />
      </SiteShell>
    </>
  );
}

/**
 * The same chrome, for surfaces that are not a public page of their own —
 * checkout, Order Access, the 404 page.
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
