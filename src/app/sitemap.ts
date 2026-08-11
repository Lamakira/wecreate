import type { MetadataRoute } from "next";

import { readSiteSettings } from "@/managed-content";
import { isIndexablePath, siteUrl } from "@/site-config";

/**
 * The crawlable public routes, taken from the navigation an editor maintains
 * so the sitemap cannot drift from the site's own menu.
 *
 * Later tickets add their routes (Portfolio Project and Digital Product detail
 * pages) as those content types arrive.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await readSiteSettings();
  const origin = siteUrl();

  return settings.navigation
    // The same predicate `robots.ts` uses, so an editor cannot put a
    // non-indexable path in the menu and have it turn up in the sitemap.
    .filter((link) => isIndexablePath(link.href))
    .map((link) => ({
      url: new URL(link.href, origin).toString(),
      changeFrequency: "monthly",
      priority: link.href === "/" ? 1 : 0.7,
    }));
}
