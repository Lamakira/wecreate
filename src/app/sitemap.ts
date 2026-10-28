import type { MetadataRoute } from "next";

import { DISCIPLINES, disciplinePath } from "@/discipline";
import {
  readBoutique,
  readEffectiveLegalTerms,
  readPortfolio,
  readSiteSettings,
} from "@/managed-content";
import { productPath } from "@/managed-content/digital-products";
import { isIndexablePath, siteUrl } from "@/site-config";

/**
 * The crawlable public routes, taken from the navigation an editor maintains
 * so the sitemap cannot drift from the site's own menu, plus each Discipline's
 * homepage when the menu does not already list it (so `/` is not duplicated),
 * one entry per published Portfolio Project, per Digital Product on offer and
 * per legal document in force.
 *
 * The projects come through the same publication gate as the pages themselves,
 * so an unfinished or unauthorised one is never advertised to a crawler. The
 * products come through the same archive rule as the Boutique, so a product
 * WeCreate has withdrawn keeps its page for the orders that reference it without
 * being advertised to anyone about to buy.
 *
 * Later tickets add their routes as those surfaces arrive.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await readSiteSettings();
  const { projects } = await readPortfolio();
  const { products } = await readBoutique();
  const legalTerms = await readEffectiveLegalTerms();
  const origin = siteUrl();

  const pages = settings.navigation
    // The same predicate `robots.ts` uses, so an editor cannot put a
    // non-indexable path in the menu and have it turn up in the sitemap.
    .filter((link) => isIndexablePath(link.href))
    .map((link) => ({
      url: new URL(link.href, origin).toString(),
      changeFrequency: "monthly" as const,
      priority: link.href === "/" ? 1 : 0.7,
    }));

  // Branding and Site web have homepages of their own that the menu need not
  // link to; `/` is Vidéographie's and is usually in the menu already.
  const listed = new Set(pages.map((page) => page.url));
  const disciplineHomepages = DISCIPLINES.map((discipline) =>
    new URL(disciplinePath(discipline), origin).toString(),
  )
    .filter((url) => !listed.has(url))
    .map((url) => ({
      url,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    }));

  return [
    ...pages,
    ...disciplineHomepages,
    ...projects.map((project) => ({
      url: new URL(`/portfolio/${project.slug}`, origin).toString(),
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
    ...products.map((product) => ({
      url: new URL(productPath(product.slug), origin).toString(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    // Approved text only. A placeholder legal page is readable — the site has
    // to have one to link to before WeCreate's counsel has written the real
    // thing — but advertising it to a crawler would put text WeCreate has not
    // agreed to into search results as its terms. Superseded revisions are
    // absent for the neighbouring reason: they are kept because orders
    // reference them, not because anyone should find them by searching.
    ...legalTerms.inForce
      .filter((legal) => legal.status === "approved")
      .map((legal) => ({
        url: new URL(legal.path, origin).toString(),
        changeFrequency: "yearly" as const,
        priority: 0.3,
      })),
  ];
}
