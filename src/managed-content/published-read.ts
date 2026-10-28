import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { Discipline } from "@/discipline";

import { getManagedContentProvider } from "./provider";
import {
  ABOUT_TAG,
  ALL_MANAGED_CONTENT_TAGS,
  BOUTIQUE_PAGE_TAG,
  BRANDING_HOME_TAG,
  CONTACT_TAG,
  DIGITAL_PRODUCTS_TAG,
  HOME_TAG,
  LEGAL_TAG,
  PORTFOLIO_PAGE_TAG,
  PORTFOLIO_PROJECTS_TAG,
  SERVICES_TAG,
  SETTINGS_TAG,
  SITE_WEB_HOME_TAG,
} from "./tag";
import type { SiteContent } from "./types";

/**
 * Published Managed Content, cached in slices.
 *
 * Every entry is the same thing — one `provider.read("published")` returning
 * the whole `SiteContent` — filled under a different list of tags. The list is
 * the entry's dependency declaration: it names every document type whose
 * publish changes something that entry's callers render. Publishing one type
 * expires exactly the entries tagged with it and leaves the rest cached, which
 * is the point of issue #24.
 *
 * The tags are an argument rather than a closure so that all of them share one
 * `"use cache"` function: arguments are part of the cache key, so two lists are
 * two entries, and the dependency lists below are the only place a page's tags
 * are written down. `cacheTag` takes several tags in one call.
 *
 * A shared layout cannot take part in this: with Cache Components, layout and
 * page are separate work units, and a second tagged read is a second provider
 * round trip. Header, footer, metadata and page body therefore all come from
 * the one entry a page reads, and "a cold render of any public page costs at
 * most one Managed Content provider round trip" holds by construction.
 */
async function readPublished(tags: readonly string[]): Promise<SiteContent> {
  "use cache";
  cacheTag(...tags);
  cacheLife("managedContent");

  const provider = await getManagedContentProvider();
  return provider.read("published");
}

/*
 * A page's `generateMetadata` and its body both read the page's entry, and they
 * run concurrently. That is still one provider round trip: Next.js coalesces
 * concurrent fills of the same entry (same function, same arguments), which the
 * cold-render counts in `managed-content-publishing.spec.ts` pin down, so no
 * per-request memoisation is layered on top.
 */

/** Header and footer come from settings and legal on every entry. */
const CHROME_TAGS = [SETTINGS_TAG, LEGAL_TAG] as const;

/** The tag of each Discipline's own homepage document. */
const HOME_TAGS: Record<Discipline, string> = {
  videographie: HOME_TAG,
  branding: BRANDING_HOME_TAG,
  "site-web": SITE_WEB_HOME_TAG,
};

/**
 * A Discipline's homepage. Each has a document of its own, so publishing one
 * leaves the other two cached. Every one of them carries the projects tag —
 * its reel is the portfolio's own list for that Discipline — and the products
 * tag, because each shows the Boutique teaser; the portfolio and boutique page
 * copy does not appear on any of them.
 */
export function readPublishedHome(discipline: Discipline): Promise<SiteContent> {
  return readPublished([
    HOME_TAGS[discipline],
    PORTFOLIO_PROJECTS_TAG,
    DIGITAL_PRODUCTS_TAG,
    ...CHROME_TAGS,
  ]);
}

/** `/portfolio` and `/portfolio/[slug]`. */
export function readPublishedPortfolio(): Promise<SiteContent> {
  return readPublished([
    PORTFOLIO_PAGE_TAG,
    PORTFOLIO_PROJECTS_TAG,
    ...CHROME_TAGS,
  ]);
}

/** `/boutique` and `/boutique/[slug]`. */
export function readPublishedBoutique(): Promise<SiteContent> {
  return readPublished([
    BOUTIQUE_PAGE_TAG,
    DIGITAL_PRODUCTS_TAG,
    ...CHROME_TAGS,
  ]);
}

export function readPublishedServices(): Promise<SiteContent> {
  return readPublished([SERVICES_TAG, ...CHROME_TAGS]);
}

export function readPublishedAbout(): Promise<SiteContent> {
  return readPublished([ABOUT_TAG, ...CHROME_TAGS]);
}

export function readPublishedContact(): Promise<SiteContent> {
  return readPublished([CONTACT_TAG, ...CHROME_TAGS]);
}

/**
 * Everything, tagged with everything.
 *
 * What every surface that is not a public page of its own reads — the sitemap,
 * checkout, Order Access, the legal pages, the API routes and the commerce
 * back office. Those callers often combine several readers (the
 * sitemap wants settings, projects, products and legal terms; checkout wants
 * the chrome and the products), and if each reader had an entry of its own that
 * would be one provider round trip per reader. Sharing one entry makes it one
 * round trip however many readers they combine.
 *
 * The price is that these surfaces expire on any publish, whatever its type.
 * That is what they did before #24, and none of them is a page whose warm
 * cache a visitor is waiting on.
 */
export function readPublishedSite(): Promise<SiteContent> {
  return readPublished(ALL_MANAGED_CONTENT_TAGS);
}
