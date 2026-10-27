/**
 * Cache tags for published Managed Content.
 *
 * Kept in their own module so route handlers can invalidate them without
 * importing the server-only read API.
 *
 * There is one tag per document type, 1:1, and no read sets any other. What a
 * publish expires is therefore exactly the cached entries tagged with that
 * type, and what an entry depends on is written once, as the list of tags it
 * is filled under (`published-read.ts`) — there is no second, hand-kept table
 * saying "a project change is also visible on the homepage". The homepage
 * entry simply carries the projects and products tags.
 *
 * The operator bearer token, and any webhook whose type is missing or unknown,
 * expire every tag.
 */

export const SETTINGS_TAG = "managed-content:settings";
export const LEGAL_TAG = "managed-content:legal";
export const HOME_TAG = "managed-content:home";
export const PORTFOLIO_PAGE_TAG = "managed-content:portfolio-page";
export const PORTFOLIO_PROJECTS_TAG = "managed-content:portfolio-projects";
export const BOUTIQUE_PAGE_TAG = "managed-content:boutique-page";
export const DIGITAL_PRODUCTS_TAG = "managed-content:digital-products";
export const SERVICES_TAG = "managed-content:services";
export const ABOUT_TAG = "managed-content:about";
export const CONTACT_TAG = "managed-content:contact";

export const ALL_MANAGED_CONTENT_TAGS = [
  SETTINGS_TAG,
  LEGAL_TAG,
  HOME_TAG,
  PORTFOLIO_PAGE_TAG,
  PORTFOLIO_PROJECTS_TAG,
  BOUTIQUE_PAGE_TAG,
  DIGITAL_PRODUCTS_TAG,
  SERVICES_TAG,
  ABOUT_TAG,
  CONTACT_TAG,
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

const DOCUMENT_TYPE_TAGS: Record<ManagedContentDocumentType, string> = {
  siteSettings: SETTINGS_TAG,
  homePage: HOME_TAG,
  portfolioPage: PORTFOLIO_PAGE_TAG,
  portfolioProject: PORTFOLIO_PROJECTS_TAG,
  boutiquePage: BOUTIQUE_PAGE_TAG,
  digitalProduct: DIGITAL_PRODUCTS_TAG,
  servicesPage: SERVICES_TAG,
  aboutPage: ABOUT_TAG,
  contactPage: CONTACT_TAG,
  legalDocument: LEGAL_TAG,
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
  // `Object.hasOwn` rather than `in`: a webhook `_type` of "constructor" or
  // "toString" is on the prototype chain, and would otherwise resolve to a
  // function instead of falling back to expiring everything.
  if (!type || !Object.hasOwn(DOCUMENT_TYPE_TAGS, type)) {
    return ALL_MANAGED_CONTENT_TAGS;
  }

  return [DOCUMENT_TYPE_TAGS[type as ManagedContentDocumentType]];
}
