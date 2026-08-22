/**
 * Cache tags for published Managed Content.
 *
 * Kept in their own module so route handlers can invalidate them without
 * importing the server-only read API.
 *
 * Each public page is one `"use cache"` entry tagged with the slices it
 * reads — the page itself plus header, footer and default SEO. A scoped
 * publish expires only those tags. The operator bearer token, and any
 * webhook whose type is missing or unknown, expire every tag.
 */

export const MANAGED_CONTENT_TAG = "managed-content";

export const SETTINGS_TAG = "managed-content:settings";
export const HOME_TAG = "managed-content:home";
export const PORTFOLIO_TAG = "managed-content:portfolio";
export const BOUTIQUE_TAG = "managed-content:boutique";
export const SERVICES_TAG = "managed-content:services";
export const ABOUT_TAG = "managed-content:about";
export const CONTACT_TAG = "managed-content:contact";
export const LEGAL_TAG = "managed-content:legal";

export const ALL_MANAGED_CONTENT_TAGS = [
  MANAGED_CONTENT_TAG,
  SETTINGS_TAG,
  HOME_TAG,
  PORTFOLIO_TAG,
  BOUTIQUE_TAG,
  SERVICES_TAG,
  ABOUT_TAG,
  CONTACT_TAG,
  LEGAL_TAG,
] as const;

/**
 * Sanity document types the publish webhook is set up for.
 *
 * The names are the content model's, and they are what the webhook payload's
 * `_type` field carries. An editor's publish of one of these should expire
 * only the cached slices that read it.
 */
export const MANAGED_CONTENT_DOCUMENT_TYPES = [
  "siteSettings",
  "homePage",
  "portfolioPage",
  "portfolioProject",
  "boutiquePage",
  "digitalProduct",
  "servicesPage",
  "aboutPage",
  "contactPage",
  "legalDocument",
] as const;

export type ManagedContentDocumentType =
  (typeof MANAGED_CONTENT_DOCUMENT_TYPES)[number];

const DOCUMENT_TYPE_TAGS: Record<
  ManagedContentDocumentType,
  readonly string[]
> = {
  siteSettings: [SETTINGS_TAG],
  homePage: [HOME_TAG],
  // The homepage reel is the portfolio's own list, so a project change is
  // visible there as well as on /portfolio.
  portfolioPage: [PORTFOLIO_TAG],
  portfolioProject: [PORTFOLIO_TAG, HOME_TAG],
  boutiquePage: [BOUTIQUE_TAG],
  // Featured products on the homepage are this catalogue, so a product
  // change is visible there as well as on /boutique.
  digitalProduct: [BOUTIQUE_TAG, HOME_TAG],
  servicesPage: [SERVICES_TAG],
  aboutPage: [ABOUT_TAG],
  contactPage: [CONTACT_TAG],
  legalDocument: [LEGAL_TAG],
};

/**
 * The cache tags a publish of this document type must expire.
 *
 * An absent or unrecognised type expires everything rather than nothing: a
 * webhook we cannot scope is still a signal that published content changed,
 * and serving the previous cache would be the wrong failure.
 */
export function cacheTagsForDocumentType(
  type: string | null | undefined,
): readonly string[] {
  if (!type || !(type in DOCUMENT_TYPE_TAGS)) {
    return ALL_MANAGED_CONTENT_TAGS;
  }

  return DOCUMENT_TYPE_TAGS[type as ManagedContentDocumentType];
}
