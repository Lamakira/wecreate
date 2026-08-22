import type { Metadata } from "next";
import { draftMode } from "next/headers";
import type { ReactNode } from "react";

import { DraftModeBanner } from "@/components/shell/draft-mode-banner";
import { GrainOverlay } from "@/components/shell/grain-overlay";
import { DigitalCartProvider } from "@/digital-cart/use-digital-cart";
import { DEFAULT_SITE_CONTENT } from "@/managed-content/default-content";
import { SiteMeasurement } from "@/measurement";
import { pageOpenGraph } from "@/seo/open-graph";
import { isIndexable, siteUrl } from "@/site-config";

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = DEFAULT_SITE_CONTENT.settings;

  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: seo.defaultTitle,
      template: seo.titleTemplate,
    },
    description: seo.defaultDescription,
    applicationName: seo.siteName,
    openGraph: pageOpenGraph(
      {
        title: seo.defaultTitle,
        description: seo.defaultDescription,
        imageUrl: seo.openGraphImageUrl,
      },
      seo,
    ),
    // Staging is noindex on every page. Preview is a second, per-session
    // rule: DraftModeBanner emits its own robots meta, because calling
    // draftMode() here would make every public page's metadata dynamic.
    //
    // Title, description and Open Graph for a given page come from that
    // page's own cached read, so a siteSettings publish still updates them.
    // The fallback above is the bundled baseline, used only when a route
    // does not supply its own — a second provider round trip here would
    // split every public render in two.
    robots: !isIndexable()
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

/**
 * The public site.
 *
 * Header and footer are not here: they share each page's cached Managed
 * Content read, so a cold render stays one provider round trip. What remains
 * is request-wide chrome that holds no editorial data — the Digital Cart,
 * grain, measurement, and the preview banner.
 *
 * The cart provider wraps the whole thing rather than the header alone, because
 * the two ends of the cart are far apart: *Ajouter au panier* sits on a product
 * page inside `children`, and the count and the drawer are in the shell. It
 * holds no server data of its own — the cart is read from this browser's cookie
 * after hydration — so nothing here stops a page being prerendered (ADR-0003).
 */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const { isEnabled: isDraftMode } = await draftMode();

  return (
    <DigitalCartProvider>
      <a href="#contenu" className="skip-to-content">
        Aller au contenu
      </a>
      <SiteMeasurement />
      <GrainOverlay />
      {children}
      {isDraftMode ? <DraftModeBanner /> : null}
    </DigitalCartProvider>
  );
}
