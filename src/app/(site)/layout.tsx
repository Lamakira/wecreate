import type { Metadata } from "next";
import { draftMode } from "next/headers";
import type { ReactNode } from "react";

import { DraftModeBanner } from "@/components/shell/draft-mode-banner";
import { GrainOverlay } from "@/components/shell/grain-overlay";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteShell } from "@/components/shell/site-shell";
import { readEffectiveLegalTerms, readSiteSettings } from "@/managed-content";
import { isIndexable, siteUrl } from "@/site-config";

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await readSiteSettings();

  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: seo.defaultTitle,
      template: seo.titleTemplate,
    },
    description: seo.defaultDescription,
    applicationName: seo.siteName,
    openGraph: {
      type: "website",
      siteName: seo.siteName,
      locale: seo.openGraphLocale,
      title: seo.defaultTitle,
      description: seo.defaultDescription,
      images: seo.openGraphImageUrl ? [seo.openGraphImageUrl] : undefined,
    },
    // Staging and preview deployments stay out of search results entirely.
    robots: isIndexable() ? { index: true, follow: true } : { index: false, follow: false },
  };
}

/**
 * The public site.
 *
 * Everything under this layout shares the fixed header, the footer and the
 * Digital Cart. The Studio sits outside it.
 */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const settings = await readSiteSettings();
  const legalTerms = await readEffectiveLegalTerms();
  const { isEnabled: isDraftMode } = await draftMode();

  return (
    <>
      <GrainOverlay />
      <SiteShell settings={settings}>
        <main id="contenu" className="pt-header-offset">
          {children}
        </main>
        <SiteFooter settings={settings} legalLinks={legalTerms.inForce} />
      </SiteShell>
      {isDraftMode ? <DraftModeBanner /> : null}
    </>
  );
}
