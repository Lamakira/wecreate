import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { draftMode } from "next/headers";

import {
  effectiveLegalTerms,
  findLegalDocument,
  findLegalSlugRedirect,
  legalSlugRedirects,
  legalToday,
  revisionHistory,
  type EffectiveLegalTerms,
} from "./legal";
import { isPublishable } from "./portfolio";
import { getManagedContentProvider } from "./provider";
import type {
  AboutContent,
  ContactContent,
  HomePage,
  LegalDocument,
  LegalRevision,
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

/**
 * Today, as the effective-date rule sees it.
 *
 * Cached because Cache Components refuses a moving clock in a prerender, and
 * tagged with the content tag because of what it decides. An editor publishing
 * terms dated today must see them in force at once; a day frozen at yesterday
 * would leave the site serving the previous revision until the clock cache
 * happened to turn over. The publish drops both, so the two are always read
 * together.
 */
export async function readLegalDay(): Promise<string> {
  "use cache";
  cacheTag(MANAGED_CONTENT_TAG);
  cacheLife("managedContent");

  return legalToday();
}

/**
 * WeCreate's legal documents, with every revision each has had.
 *
 * No gate of its own, and no filtering: publishing is the whole of the decision
 * for a legal text, and which revision applies is a question of dates rather
 * than of readiness. Draft and published separate the way they do everywhere
 * else, so an editor previews new terms in the real page before anyone is bound
 * by them.
 */
export async function readLegalDocuments(): Promise<LegalDocument[]> {
  return (await readSiteContent()).legalDocuments;
}

/** The legal document at an address, or `undefined` if nothing is there. */
export async function readLegalDocument(
  slug: string,
): Promise<LegalDocument | undefined> {
  return findLegalDocument(await readLegalDocuments(), slug);
}

/**
 * A legal document resolved against today: what it says now, and what it has
 * said before.
 *
 * The three travel together everywhere — a page renders one revision, says
 * whether it is still the one in force, and lists the rest — so they are
 * resolved once and passed as one thing rather than recomputed side by side.
 */
export interface LegalDocumentInForce {
  document: LegalDocument;
  /** The revision that applies today. */
  current: LegalRevision;
  /** In force now or previously, newest first. */
  history: LegalRevision[];
}

/**
 * The document at an address, with the revision in force.
 *
 * `undefined` covers both "no document lives here" and "every revision it has
 * is dated in the future": either way there is nothing a visitor can be bound
 * by, and the page answers the same for both rather than hinting that a
 * different address would behave differently.
 */
export async function readLegalDocumentInForce(
  slug: string,
): Promise<LegalDocumentInForce | undefined> {
  const document = await readLegalDocument(slug);
  if (!document) {
    return undefined;
  }

  const today = await readLegalDay();
  const history = revisionHistory(document, today);
  const current = history[0];

  return current ? { document, current, history } : undefined;
}

/**
 * The address a prior published address now points at.
 *
 * Only consulted once `readLegalDocument` has found nothing, so a slug that has
 * become another document's own address is served rather than redirected.
 */
export async function readLegalSlugRedirect(
  slug: string,
): Promise<string | undefined> {
  return findLegalSlugRedirect(await readLegalDocuments(), slug);
}

/**
 * Every abandoned legal address and where it now points, as one object.
 *
 * Read by `/api/legal/redirects`, which is how `src/proxy.ts` turns a former
 * address into a real 308 before the page starts rendering. Published content
 * only — the proxy carries no preview session, and a draft slug is not an
 * address anyone has ever been able to link to.
 */
export async function readLegalSlugRedirects(): Promise<
  Record<string, string>
> {
  return legalSlugRedirects(await readLegalDocuments());
}

/**
 * What is legally in force right now.
 *
 * The stable boundary issue #1 asks for: checkout takes the revisions it must
 * present and record from here, and reads `awaitingApproval` to know it may not
 * run at all. Nothing downstream parses a rendered page to find out what the
 * terms are.
 */
export async function readEffectiveLegalTerms(): Promise<EffectiveLegalTerms> {
  return effectiveLegalTerms(await readLegalDocuments(), await readLegalDay());
}
