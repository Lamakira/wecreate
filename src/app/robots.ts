import type { MetadataRoute } from "next";

import { NON_INDEXABLE_PATHS, isIndexable, siteUrl } from "@/site-config";

/**
 * Crawling rules.
 *
 * Only a deployment explicitly flagged as production is crawlable at all.
 * Preview, administration and every transaction surface stay out of search
 * results even there.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: NON_INDEXABLE_PATHS.map((path) => `${path}/`),
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
