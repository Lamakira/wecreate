import "server-only";

import { readEffectiveLegalTerms } from "@/managed-content";
import {
  DIGITAL_PRODUCT_LICENCE_KIND,
  type PurchaseContext,
} from "@/managed-content/digital-products";

/**
 * Which Digital Products have a Paid Deliverable Version behind them.
 *
 * Purchase readiness is two decisions in two systems, and this is the half that
 * is not Managed Content: WeCreate's intent to sell a product is editorial, but
 * the file a buyer receives is a private object in the commerce system, with an
 * immutable version a Commerce Operator activates (issue #8). Neither system
 * alone can make an incomplete product purchasable — which is why the Boutique
 * asks both rather than trusting a flag in the CMS.
 *
 * Nothing is activated yet. Issue #8 introduces the Supabase-backed commerce
 * persistence and puts it behind this function; until then the honest answer is
 * that no file has been uploaded, so no product may be sold. Every product in
 * the Boutique is therefore *bientôt disponible*, which is what issue #1 asks
 * for while prices and launch assets are still WeCreate's to approve.
 *
 * It returns SKUs rather than content ids on purpose: the SKU is the identity
 * the two systems share, the one an Order Snapshot records, and it survives a
 * product being retitled, moved or archived.
 */
export async function readActivePaidDeliverableSkus(): Promise<string[]> {
  return [];
}

/**
 * Everything outside Managed Content that decides whether a product may be
 * sold, resolved once for a page that is about to render several.
 *
 * Two answers from two places, and the Boutique is where they meet: WeCreate's
 * licence has to be approved text in force, which is the legal half of the
 * Commerce Launch Gate, and the file has to exist, which is the commerce half.
 * Composed here rather than inside `digital-products.ts` so that module stays a
 * pure rule over content with no idea a commerce system exists.
 */
export async function readPurchaseContext(): Promise<PurchaseContext> {
  const { inForce } = await readEffectiveLegalTerms();
  const licence = inForce.find(
    (revision) => revision.kind === DIGITAL_PRODUCT_LICENCE_KIND,
  );

  return {
    hasApprovedLicence: licence?.status === "approved",
    deliverableSkus: await readActivePaidDeliverableSkus(),
  };
}
