import type { Metadata } from "next";

import { readSiteSettings } from "@/managed-content";

/**
 * Open Graph fields a public page must repeat itself.
 *
 * Next.js replaces the whole `openGraph` object when a child sets one, so
 * locale and site name from the site layout would otherwise vanish on every
 * page that publishes its own title. This helper is how a page title cannot
 * drop the locale an editor already maintains.
 */
export async function pageOpenGraph(page: {
  title: string;
  description: string;
  imageUrl?: string | null;
}): Promise<NonNullable<Metadata["openGraph"]>> {
  const { seo } = await readSiteSettings();
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
