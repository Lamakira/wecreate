import type { Metadata } from "next";

import type { SeoDefaults } from "@/managed-content/types";

/**
 * Open Graph fields a public page must repeat itself.
 *
 * Next.js replaces the whole `openGraph` object when a child sets one, so
 * locale and site name from the site layout would otherwise vanish on every
 * page that publishes its own title. This helper is how a page title cannot
 * drop the locale an editor already maintains.
 *
 * `seo` is passed in rather than read here, so a page that already loaded
 * Managed Content does not pay a second provider round trip for site name
 * and locale.
 */
export function pageOpenGraph(
  page: {
    title: string;
    description: string;
    imageUrl?: string | null;
  },
  seo: SeoDefaults,
): NonNullable<Metadata["openGraph"]> {
  const image = page.imageUrl ?? seo.openGraphImageUrl;

  return {
    type: "website",
    siteName: seo.siteName,
    locale: seo.openGraphLocale,
    title: page.title,
    description: page.description,
    images: image ? [image] : undefined,
  };
}
