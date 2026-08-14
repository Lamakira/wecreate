import "server-only";

import { getCommerceProvider } from "@/commerce/provider";
import type { OrderSnapshot } from "@/commerce/types";
import { readPurchaseContext } from "@/commerce";
import { reconcileCart } from "@/digital-cart/cart";
import { readCartEntries } from "@/digital-cart/cookie";
import { readDigitalProducts, readEffectiveLegalTerms } from "@/managed-content";
import { resolvePaymentProviderId } from "@/payments/provider";

import { resolveCheckout, type CheckoutState } from "./checkout";
import { readOrderInProgress } from "./session";

/**
 * The checkout, resolved on the server, for the buyer standing at it.
 *
 * This is where issue #1's "reload current published product data and recompute
 * prices server-side before checkout" actually happens. Every product in the
 * cart, its title, its price, whether it may be sold at all and which Legal
 * Revisions are in force are read again here — from published Managed Content
 * and from the commerce data plane — and what the page renders and the action
 * charges both come from this answer. Nothing the browser sent is consulted
 * except the identifiers in the cart cookie and the reference of an order
 * already in progress.
 */
export async function readCheckout(): Promise<CheckoutState> {
  const canPay = resolvePaymentProviderId() !== "none";

  const [orderInProgress, entries, products, purchase, legal] = await Promise.all(
    [
      readOrderInProgress().then((reference) =>
        reference ? readOrderByReference(reference) : undefined,
      ),
      readCartEntries(),
      readDigitalProducts(),
      readPurchaseContext(),
      readEffectiveLegalTerms(),
    ],
  );

  return resolveCheckout({
    canPay,
    orderInProgress,
    cart: reconcileCart(entries, products, purchase),
    legal: legal.checkout,
  });
}

/**
 * One order by its reference: what the checkout resumes, and what the payment
 * return route reports.
 *
 * An unreachable data plane answers "no such order", which sends the buyer back
 * to their cart rather than to a page that cannot say anything. Creating a
 * second order is recoverable; a checkout that refuses to render is not.
 */
export async function readOrderByReference(
  reference: string,
): Promise<OrderSnapshot | undefined> {
  const provider = await getCommerceProvider();
  if (!provider) return undefined;

  try {
    return await provider.readOrder(reference);
  } catch (error) {
    console.error(`Reading order ${reference} failed.`, error);
    return undefined;
  }
}
