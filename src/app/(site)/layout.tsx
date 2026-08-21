import type { Metadata } from "next";
import { draftMode } from "next/headers";
import type { ReactNode } from "react";

import { DraftModeBanner } from "@/components/shell/draft-mode-banner";
import { GrainOverlay } from "@/components/shell/grain-overlay";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteShell } from "@/components/shell/site-shell";
import { DigitalCartProvider } from "@/digital-cart/use-digital-cart";
import { readEffectiveLegalTerms, readSiteSettings } from "@/managed-content";
import { SiteMeasurement } from "@/measurement";
import { localBusinessJsonLd } from "@/seo/json-ld";
import { JsonLdScript } from "@/seo/json-ld-script";
import { pageOpenGraph } from "@/seo/open-graph";
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
    openGraph: await pageOpenGraph({
      title: seo.defaultTitle,
      description: seo.defaultDescription,
      imageUrl: seo.openGraphImageUrl,
    }),
    // Staging is noindex on every page. Preview is a second, per-session
    // rule: DraftModeBanner emits its own robots meta, because calling
    // draftMode() here would make every public page's metadata dynamic.
    robots: !isIndexable()
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

/**
 * The public site.
 *
 * Everything under this layout shares the fixed header, the footer and the
 * Digital Cart. The Studio sits outside it.
 *
 * The cart provider wraps the whole thing rather than the header alone, because
 * the two ends of the cart are far apart: *Ajouter au panier* sits on a product
 * page inside `children`, and the count and the drawer are in the shell. It
 * holds no server data of its own — the cart is read from this browser's cookie
 * after hydration — so nothing here stops a page being prerendered (ADR-0003).
 */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const settings = await readSiteSettings();
  const legalTerms = await readEffectiveLegalTerms();
  const { isEnabled: isDraftMode } = await draftMode();

  return (
    <DigitalCartProvider>
      <a href="#contenu" className="skip-to-content">
        Aller au contenu
      </a>
      <JsonLdScript data={localBusinessJsonLd(settings, siteUrl())} />
      <SiteMeasurement />
      <GrainOverlay />
      <SiteShell settings={settings}>
        <main id="contenu" className="pt-header-offset">
          {children}
        </main>
        <SiteFooter settings={settings} legalLinks={legalTerms.inForce} />
      </SiteShell>
      {isDraftMode ? <DraftModeBanner /> : null}
    </DigitalCartProvider>
  );
}
