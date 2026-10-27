import type { Metadata } from "next";
import { draftMode } from "next/headers";
import type { ReactNode } from "react";

import { DraftModeBanner } from "@/components/shell/draft-mode-banner";
import { GrainOverlay } from "@/components/shell/grain-overlay";
import { DigitalCartProvider } from "@/digital-cart/use-digital-cart";
import { DEFAULT_SITE_CONTENT } from "@/managed-content/default-content";
import { SiteMeasurement } from "@/measurement";
import { pageMetadata } from "@/seo/page-metadata";
import { isIndexable, siteUrl } from "@/site-config";

/**
 * What every public route inherits, and nothing an editor owns.
 *
 * `metadataBase` and `robots` are deployment facts. Title, description, site
 * name and Open Graph are editorial, and a layout cannot read them without a
 * Managed Content read of its own — a second provider round trip on every
 * render. Each route therefore sets those itself, from the cached read its body
 * already uses (`pageMetadata` in `@/seo/page-metadata`).
 *
 * The bundled defaults below are the last resort, and exist for one case: the
 * 404 page for an unknown URL. A not-found file cannot export metadata, so that
 * page carries these rather than the editor's `siteSettings.seo`. A missing
 * project or product does not hit this, because those routes render the
 * not-found body themselves with their own metadata.
 */
export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(siteUrl()),
    ...pageMetadata(DEFAULT_SITE_CONTENT.settings.seo),
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
