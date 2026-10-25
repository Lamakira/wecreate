import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { draftMode } from "next/headers";
import { cache } from "react";

import { findAtSlug, findSlugRedirect, slugRedirects } from "./addresses";
import { isDiscoverable } from "./digital-products";
import {
  effectiveLegalTerms,
  legalToday,
  revisionHistory,
  type EffectiveLegalTerms,
} from "./legal";
import { isPublishable } from "./portfolio";
import { getManagedContentProvider } from "./provider";
import {
  readPublishedAbout,
  readPublishedBoutique,
  readPublishedContact,
  readPublishedHome,
  readPublishedPortfolio,
  readPublishedServices,
  readPublishedSite,
} from "./published-read";
import { LEGAL_TAG } from "./tag";
import type {
  BoutiqueContent,
  DigitalProduct,
  LegalDocument,
  LegalRevision,
  PortfolioContent,
  SiteContent,
  SiteSettings,
} from "./types";

export * from "./types";

/**
 * The draft site. Deliberately uncached: a preview must show what the editor
 * just typed, and its result must never be served to anyone else. React cache
 * still collapses the several readers in one preview request into a single
 * provider call.
 */
const loadDraftContent = cache(async (): Promise<SiteContent> => {
  const provider = await getManagedContentProvider();
  return provider.read("drafts");
});

async function publishedOrDraft<T>(
  published: () => Promise<T>,
  select: (content: SiteContent) => T,
): Promise<T> {
  const { isEnabled } = await draftMode();
  return isEnabled ? select(await loadDraftContent()) : published();
}

/**
 * Everything, from the one entry every non-page surface shares.
 *
 * Header, footer, default SEO and legal links for checkout, Order Access and
 * the legal pages — and the entry every standalone reader below is built on, so a
 * caller that combines several of them (the sitemap, checkout) is one provider
 * round trip however many it uses. See `readPublishedSite`.
 */
export async function readChrome(): Promise<SiteContent> {
  return publishedOrDraft(readPublishedSite, (content) => content);
}

/**
 * Published reads for the public pages are tagged per page, so publishing
 * About cannot drop Services. Header, footer, metadata and the page body share
 * that one cached fetch — a cold render is one provider round trip.
 */
export async function readHome(): Promise<SiteContent> {
  return publishedOrDraft(readPublishedHome, (content) => content);
}

export async function readAboutPage(): Promise<SiteContent> {
  return publishedOrDraft(readPublishedAbout, (content) => content);
}

export async function readServicesPage(): Promise<SiteContent> {
  return publishedOrDraft(readPublishedServices, (content) => content);
}

export async function readContactPage(): Promise<SiteContent> {
  return publishedOrDraft(readPublishedContact, (content) => content);
}

export async function readPortfolioPage(): Promise<SiteContent> {
  return publishedOrDraft(readPublishedPortfolio, (content) => content);
}

export async function readBoutiquePage(): Promise<SiteContent> {
  return publishedOrDraft(readPublishedBoutique, (content) => content);
}

export async function readSiteSettings(): Promise<SiteSettings> {
  return publishedOrDraft(
    async () => (await readPublishedSite()).settings,
    (content) => content.settings,
  );
}

/**
 * The portfolio with the publication gate applied.
 *
 * A Portfolio Project that is missing an editorial or a rights field does not
 * reach a visitor at all — it is not hidden behind a flag further down, it is
 * absent from the list, so no page, count, sitemap entry or detail route can
 * accidentally expose one. Preview is the exception and the point: an editor
 * sees every project they are working on, including what each still needs.
 *
 * Pure, and shared by {@link readPortfolio} and the pages that already hold
 * the content they were handed, so there is one gate rather than one per page.
 */
export function gatePortfolio(
  portfolio: PortfolioContent,
  isPreview: boolean,
): PortfolioContent {
  return isPreview
    ? portfolio
    : { ...portfolio, projects: portfolio.projects.filter(isPublishable) };
}

/**
 * The Boutique with archived products already gone.
 *
 * Archiving is not a flag the page is left to remember: a withdrawn product is
 * absent from the list, so nothing counts it, links to it, lists it in the
 * sitemap or shows it in the homepage teaser. Its page and its identity
 * survive — the unfiltered product list still resolves it — because an Order
 * Snapshot, an Order Access grant and a receipt all point at it. A page that
 * resolves one product by slug therefore looks it up in the ungated content and
 * passes only the listing through this gate.
 *
 * In preview the products are exactly what the editor has, archived ones
 * included, so they can see what they have withdrawn.
 */
export function gateBoutique(
  boutique: BoutiqueContent,
  isPreview: boolean,
): BoutiqueContent {
  return isPreview
    ? boutique
    : { ...boutique, products: boutique.products.filter(isDiscoverable) };
}

/** The portfolio, gated, for a caller that has not read the site itself. */
export async function readPortfolio(): Promise<PortfolioContent> {
  const { isEnabled } = await draftMode();
  const portfolio = isEnabled
    ? (await loadDraftContent()).portfolio
    : (await readPublishedSite()).portfolio;

  return gatePortfolio(portfolio, isEnabled);
}

/** The Boutique, gated, for a caller that has not read the site itself. */
export async function readBoutique(): Promise<BoutiqueContent> {
  const { isEnabled } = await draftMode();
  const boutique = isEnabled
    ? (await loadDraftContent()).boutique
    : (await readPublishedSite()).boutique;

  return gateBoutique(boutique, isEnabled);
}

/**
 * Every Digital Product, archived ones included.
 *
 * What the Digital Cart resolves its identifiers against, and deliberately not
 * `readBoutique()`'s list: a shopper whose product was withdrawn while it sat
 * in their cart has to be told so, which needs the product to still answer to
 * its identity.
 */
export async function readDigitalProducts(): Promise<DigitalProduct[]> {
  return publishedOrDraft(
    async () => (await readPublishedSite()).boutique.products,
    (content) => content.boutique.products,
  );
}

/**
 * Every abandoned product address and where it now points, as one object.
 *
 * Read by `/api/boutique/redirects`, which is how `src/proxy.ts` turns a former
 * address into a real 308 before the page starts rendering. Published content
 * only — the proxy carries no preview session, and a draft slug is not an
 * address anyone has ever been able to link to.
 *
 * The one standalone reader that does not use the site entry. The proxy asks
 * for this map on every request to `/boutique/<slug>`, just before the product
 * page renders, so the two must fill the same entry — the Boutique's — or a cold
 * product page costs a provider round trip for each.
 */
export async function readDigitalProductSlugRedirects(): Promise<
  Record<string, string>
> {
  return slugRedirects(
    await publishedOrDraft(
      async () => (await readPublishedBoutique()).boutique.products,
      (content) => content.boutique.products,
    ),
  );
}

/**
 * Today, as the effective-date rule sees it.
 *
 * Cached because Cache Components refuses a moving clock in a prerender, and
 * tagged with the legal slice because of what it decides. An editor publishing
 * terms dated today must see them in force at once; a day frozen at yesterday
 * would leave the site serving the previous revision until the clock cache
 * happened to turn over. The publish drops both, so the two are always read
 * together.
 */
export async function readLegalDay(): Promise<string> {
  "use cache";
  cacheTag(LEGAL_TAG);
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
  return publishedOrDraft(
    async () => (await readPublishedSite()).legalDocuments,
    (content) => content.legalDocuments,
  );
}

/** The legal document at an address, or `undefined` if nothing is there. */
export async function readLegalDocument(
  slug: string,
): Promise<LegalDocument | undefined> {
  return findAtSlug(await readLegalDocuments(), slug);
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
  return findSlugRedirect(await readLegalDocuments(), slug);
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
  return slugRedirects(await readLegalDocuments());
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
