import type {
  DigitalProduct,
  DigitalProductFamily,
  LegalDocumentKind,
} from "./types";

/**
 * The rules the Boutique is built on: which family a product belongs to, where
 * it lives, and whether WeCreate may sell it.
 *
 * Pure functions over Managed Content, like `portfolio.ts` and `legal.ts`. What
 * they deliberately do not know is anything about the commerce system — the
 * caller supplies what it says, because a Paid Deliverable Version is not
 * editorial content and never reaches this side of the boundary (issue #1).
 */

/** French wording for each family: the Boutique's filters, and a product's kicker. */
export const DIGITAL_PRODUCT_FAMILY_LABELS: Record<
  DigitalProductFamily,
  string
> = {
  ebooks: "Ebooks & Guides",
  luts: "LUTs & Presets",
};

/**
 * The Legal Document every Digital Product is sold under.
 *
 * One licence for the whole Boutique rather than a reference an editor picks
 * per product, and for two reasons. WeCreate publishes exactly one *Licence des
 * produits numériques* (CONTEXT.md), so a per-product choice could only ever
 * point at the right document or at the wrong one. And a product carrying its
 * own licence wording would be a second place terms are written, free to drift
 * from the document a checkout actually records acceptance of.
 */
export const DIGITAL_PRODUCT_LICENCE_KIND: LegalDocumentKind = "licence";

/** Where a visitor reads one product. */
export function productPath(slug: string): string {
  return `/boutique/${slug}`;
}

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

/**
 * What a Digital Product still lacks before WeCreate may sell it.
 *
 * The names are the editor's, not the model's: they are what preview says out
 * loud, so an editor is told what to do rather than which field is empty.
 *
 * `paidDeliverableVersion` is the one requirement Managed Content cannot see.
 * It is the file a buyer receives, activated in the commerce system by a
 * Commerce Operator (issue #8) — so neither system alone can make an incomplete
 * product purchasable, which is the point of separating them.
 */
export type PurchaseRequirement =
  | "sku"
  | "family"
  | "price"
  | "summary"
  | "inclusions"
  | "cover"
  | "licence"
  | "purchaseIntent"
  | "paidDeliverableVersion";

/**
 * French wording for each requirement, shown to editors in preview.
 *
 * Each names the field the Studio names, so an editor is sent to the box they
 * have to fill rather than to whichever of the two descriptions they guess.
 */
export const PURCHASE_REQUIREMENT_LABELS: Record<PurchaseRequirement, string> =
  {
    sku: "la référence produit",
    family: "la famille",
    price: "un prix en francs entiers",
    summary: "la description courte",
    inclusions: "le contenu du produit",
    cover: "la couverture",
    licence: "la licence validée par WeCreate",
    purchaseIntent: "la mise en vente",
    paidDeliverableVersion: "le fichier livré, activé côté commerce",
  };

/**
 * What the two systems outside Managed Content say about selling.
 *
 * Passed in rather than read here, so this module stays a pure rule over
 * content: the licence answer comes from `readEffectiveLegalTerms()`, and the
 * Paid Deliverable answer from the commerce system.
 */
export interface PurchaseContext {
  /** Whether WeCreate's licence text is approved and in force. */
  hasApprovedLicence: boolean;
  /** The SKUs with an active Paid Deliverable Version behind them. */
  deliverableSkus: readonly string[];
}

/**
 * Everything a Digital Product still needs before it may be bought.
 *
 * An empty list means WeCreate may sell it. Issue #1: a Purchase-Enabled
 * Product must be published, have a stable SKU, a positive whole-XOF price, an
 * approved licence reference and an active Paid Deliverable Version — and a
 * product is only bought after "its price, cover, description, license, Paid
 * Deliverable Version, delivery test, and support path are approved". The first
 * six of those are checkable here; the last two are WeCreate's own sign-off and
 * belong to the Commerce Launch Gate (issue #18).
 *
 * Publication is not on the list because it is not a field: an unpublished
 * product is absent from what a visitor is served, so there is nothing to
 * report about it.
 */
export function purchaseRequirements(
  product: DigitalProduct,
  context: PurchaseContext,
): PurchaseRequirement[] {
  const missing: PurchaseRequirement[] = [];

  if (isBlank(product.sku)) missing.push("sku");
  if (!product.family) missing.push("family");
  if (!Number.isInteger(product.priceXof) || product.priceXof <= 0) {
    missing.push("price");
  }
  if (isBlank(product.summary)) missing.push("summary");
  if (product.inclusions.length === 0) missing.push("inclusions");
  if (isBlank(product.cover.imageUrl)) missing.push("cover");
  if (!context.hasApprovedLicence) missing.push("licence");
  if (!product.isPurchaseEnabled) missing.push("purchaseIntent");
  if (!context.deliverableSkus.includes(product.sku)) {
    missing.push("paidDeliverableVersion");
  }

  return missing;
}

/**
 * What a visitor is told about buying this product.
 *
 * Three answers, and the difference between the last two is whether WeCreate
 * still intends to sell it. `forthcoming` is an unfinished product — the price,
 * the cover, the licence or the file is not ready — and it is where every
 * product shipped in this repository sits, because none of that is approved
 * yet. `unavailable` is a product WeCreate has withdrawn.
 */
export type DigitalProductAvailability =
  | "available"
  | "forthcoming"
  | "unavailable";

/** French wording for each state, shown on the card and on the product page. */
export const AVAILABILITY_LABELS: Record<DigitalProductAvailability, string> = {
  available: "Disponible",
  forthcoming: "Bientôt disponible",
  unavailable: "Plus disponible",
};

export function productAvailability(
  product: DigitalProduct,
  context: PurchaseContext,
): DigitalProductAvailability {
  if (product.isArchived) {
    return "unavailable";
  }
  return purchaseRequirements(product, context).length === 0
    ? "available"
    : "forthcoming";
}

/**
 * Whether a product belongs in the Boutique, the homepage teaser and the
 * sitemap.
 *
 * Archiving is what this answers: the product keeps its identity and its page,
 * so an old link and a past order still resolve, but it is no longer offered
 * anywhere WeCreate advertises what it sells.
 */
export function isDiscoverable(product: DigitalProduct): boolean {
  return !product.isArchived;
}

/*
 * Finding the product at an address, and following one it has left behind, are
 * `addresses.ts`, shared with the legal documents. Archived products are part of
 * both answers: a withdrawn product still has to respond at the address a
 * receipt links to, and renaming it before archiving it must not break that.
 */
