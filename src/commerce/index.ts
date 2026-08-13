import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { readEffectiveLegalTerms } from "@/managed-content";
import {
  DIGITAL_PRODUCT_LICENCE_KIND,
  type PurchaseContext,
} from "@/managed-content/digital-products";

import { getCommerceProvider } from "./provider";
import { PAID_DELIVERABLES_TAG } from "./tag";

export { PAID_DELIVERABLES_TAG } from "./tag";

/**
 * Which Digital Products have a Paid Deliverable Version behind them.
 *
 * Purchase readiness is two decisions in two systems, and this is the half that
 * is not Managed Content: WeCreate's intent to sell a product is editorial, but
 * the file a buyer receives is a private object in the commerce system, with an
 * immutable version a Commerce Operator activates. Neither system alone can make
 * an incomplete product purchasable — which is why the Boutique asks both rather
 * than trusting a flag in the CMS.
 *
 * Cached and tagged, which is what keeps Supabase off the public browsing path
 * (ADR-0003): a visit to `/boutique` renders from the same prerendered shell
 * every other page does, and activating a version expires this tag so the next
 * request has the new answer. A deployment with no commerce data plane answers
 * that nothing is activated, so every product reads *bientôt disponible* — the
 * honest answer, and the one issue #1 asks for until WeCreate has approved its
 * prices and uploaded its files.
 *
 * It returns SKUs rather than content ids on purpose: the SKU is the identity
 * the two systems share, the one an Order Snapshot records, and it survives a
 * product being retitled, moved or archived.
 */
export async function readActivePaidDeliverableSkus(): Promise<string[]> {
  "use cache";
  cacheTag(PAID_DELIVERABLES_TAG);
  cacheLife("paidDeliverables");

  const provider = await getCommerceProvider();
  if (!provider) {
    return [];
  }

  try {
    return await provider.readActiveSkus();
  } catch (error) {
    // An unreachable data plane must not take the Boutique down with it. The
    // safe answer is that nothing may be sold: a product WeCreate cannot
    // currently confirm a file for reads *bientôt disponible* rather than
    // accepting money for something it may not be able to deliver.
    console.error("Commerce data plane unreachable; treating no product as deliverable.", error);
    return [];
  }
}

/**
 * Everything outside Managed Content that decides whether a product may be
 * sold, resolved once for a page that is about to render several.
 *
 * Two answers from two places, and the Boutique is where they meet: WeCreate's
 * licence has to be approved text in force, which is the legal half of the
 * Commerce Launch Gate, and the file has to exist and be activated, which is the
 * commerce half. Composed here rather than inside `digital-products.ts` so that
 * module stays a pure rule over content with no idea a commerce system exists.
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
