import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { draftMode } from "next/headers";

import { isPublishable } from "./portfolio";
import { getManagedContentProvider } from "./provider";
import type {
  AboutContent,
  ContactContent,
  HomePage,
  PortfolioContent,
  PortfolioProject,
  ServicesContent,
  SiteContent,
  SiteSettings,
} from "./types";

export * from "./types";
export { MANAGED_CONTENT_TAG } from "./tag";

import { MANAGED_CONTENT_TAG } from "./tag";

/**
 * The published site, cached and tagged.
 *
 * Public pages prerender from this, so an ordinary visit reaches a cached
 * response and never a content provider — which is what keeps the browsing
 * path off any transactional service (ADR-0003). Publishing invalidates the
 * tag through `/api/revalidate`.
 */
async function readPublishedContent(): Promise<SiteContent> {
  "use cache";
  cacheTag(MANAGED_CONTENT_TAG);
  cacheLife("managedContent");

  const provider = await getManagedContentProvider();
  return provider.read("published");
}

/**
 * The draft site. Deliberately uncached: a preview must show what the editor
 * just typed, and its result must never be served to anyone else.
 */
async function readDraftContent(): Promise<SiteContent> {
  const provider = await getManagedContentProvider();
  return provider.read("drafts");
}

/**
 * Read Managed Content for the current request.
 *
 * Draft mode is the only way to reach unpublished content. Next.js sets a
 * signed bypass cookie when preview is enabled, which both selects the draft
 * perspective here and takes the response out of the shared cache.
 */
export async function readSiteContent(): Promise<SiteContent> {
  const { isEnabled } = await draftMode();
  return isEnabled ? readDraftContent() : readPublishedContent();
}

export async function readSiteSettings(): Promise<SiteSettings> {
  return (await readSiteContent()).settings;
}

export async function readHomePage(): Promise<HomePage> {
  return (await readSiteContent()).homePage;
}

/**
 * The service catalogue.
 *
 * No gate of its own: unlike a Portfolio Project, a service pack carries no
 * rights or media requirements — it is a price and a description WeCreate
 * decides to publish. Draft and published still separate the same way.
 */
export async function readServices(): Promise<ServicesContent> {
  return (await readSiteContent()).services;
}

/**
 * The two editorial pages, read the same way the service catalogue is.
 *
 * Neither carries a gate of its own: they hold WeCreate's own words about
 * itself, not client work, so there is no permission or media requirement to
 * satisfy before a visitor may see them. Draft and published still separate.
 */
export async function readAbout(): Promise<AboutContent> {
  return (await readSiteContent()).about;
}

export async function readContact(): Promise<ContactContent> {
  return (await readSiteContent()).contact;
}

/**
 * The portfolio, with the publication gate already applied.
 *
 * A Portfolio Project that is missing an editorial or a rights field does not
 * reach a visitor at all — it is not hidden behind a flag further down, it is
 * absent from the list, so no page, count, sitemap entry or detail route can
 * accidentally expose one. Preview is the exception and the point: an editor
 * sees every project they are working on, including what each still needs.
 */
export async function readPortfolio(): Promise<PortfolioContent> {
  const { isEnabled } = await draftMode();
  const portfolio = (await readSiteContent()).portfolio;

  return isEnabled
    ? portfolio
    : { ...portfolio, projects: portfolio.projects.filter(isPublishable) };
}

/** One Portfolio Project by slug, or `undefined` if it is not visible here. */
export async function readPortfolioProject(
  slug: string,
): Promise<PortfolioProject | undefined> {
  const { projects } = await readPortfolio();
  return projects.find((project) => project.slug === slug);
}
