"use server";

import { readPurchaseContext } from "@/commerce";
import { readDigitalProducts } from "@/managed-content";
import type { PurchaseContext } from "@/managed-content/digital-products";
import type { DigitalProduct } from "@/managed-content/types";

import {
  cartEntries,
  encodeCartEntries,
  reconcileCart,
  withAcknowledgedPrices,
  withoutProduct,
  withProduct,
  type DigitalCartEntry,
  type DigitalCartView,
} from "./cart";
import { readCartCookie, readCartEntries, writeCartEntries } from "./cookie";

/**
 * Everything a shopper can do to their Digital Cart.
 *
 * Server Functions rather than an endpoint of their own, for two reasons. They
 * write the cart cookie, and a page cannot set one in Next.js. And Next.js
 * refuses a Server Function invoked from another origin, which is the CSRF
 * protection issue #1 asks for on a state-changing surface — without this
 * application inventing a token scheme for a cart that holds no secret.
 *
 * Each of them ends the same way: the identifiers are resolved against the
 * published catalogue and the commerce system, the result is written back, and
 * the reconciled cart is returned. The browser therefore never computes a
 * total, a price or an availability of its own — it renders the answer this
 * side gave it.
 */

/** Everything outside the cookie that decides what a cart's identifiers mean. */
interface Catalogue {
  products: DigitalProduct[];
  purchase: PurchaseContext;
}

/**
 * Both halves of the answer, read together.
 *
 * Both are cached and tagged where they are defined, so this puts no database
 * on the path a shopper is already on (ADR-0003): the same two reads the
 * Boutique itself renders from.
 */
async function readCatalogue(): Promise<Catalogue> {
  const [products, purchase] = await Promise.all([
    readDigitalProducts(),
    readPurchaseContext(),
  ]);
  return { products, purchase };
}

/**
 * Resolve a set of identifiers, then store exactly what survived.
 *
 * Reconciliation is self-healing, so this is also where a cart repairs itself:
 * a duplicate, a product WeCreate has deleted and an identifier a visitor typed
 * into the cookie are all gone from what is stored afterwards. The write is
 * skipped when nothing would change, so merely opening the drawer does not
 * hand the browser a new cookie.
 */
async function settle(
  entries: readonly DigitalCartEntry[],
  { products, purchase }: Catalogue,
): Promise<DigitalCartView> {
  const view = reconcileCart(entries, products, purchase);
  const settled = cartEntries(view);
  const stored = settled.length === 0 ? undefined : encodeCartEntries(settled);

  if (stored !== (await readCartCookie())) {
    await writeCartEntries(settled);
  }

  return view;
}

/** This browser's cart, and what it means today. */
async function readCartAgainstCatalogue(): Promise<
  [DigitalCartEntry[], Catalogue]
> {
  return Promise.all([readCartEntries(), readCatalogue()]);
}

/** The cart this browser is carrying, as WeCreate's catalogue reads it today. */
export async function readDigitalCartAction(): Promise<DigitalCartView> {
  const [entries, catalogue] = await readCartAgainstCatalogue();
  return settle(entries, catalogue);
}

/**
 * Put one Digital Product in the cart.
 *
 * The button that calls this is only rendered for a product WeCreate may sell,
 * and this checks again anyway: what arrives here is an identifier from a
 * browser, and the answer to "may this be sold" lives in two systems that the
 * browser is not one of.
 */
export async function addProductToCartAction(
  productId: string,
): Promise<DigitalCartView> {
  const [entries, catalogue] = await readCartAgainstCatalogue();
  const product = catalogue.products.find(
    (candidate) => candidate.id === productId,
  );

  return settle(
    product ? withProduct(entries, product, catalogue.purchase) : entries,
    catalogue,
  );
}

export async function removeProductFromCartAction(
  productId: string,
): Promise<DigitalCartView> {
  const [entries, catalogue] = await readCartAgainstCatalogue();
  return settle(withoutProduct(entries, productId), catalogue);
}

/**
 * Take the prices the shopper was shown as accepted.
 *
 * The deliberate step between a published price change and a checkout (issue
 * #1). `presented` is what the drawer had on screen when the button was
 * pressed, sent so that this side can refuse an amount that has moved again in
 * between — see `withAcknowledgedPrices`. It is not believed for anything else:
 * a forged pair whose amount is not the catalogue's is simply not accepted.
 */
export async function acknowledgeCartPricesAction(
  presented: ReadonlyArray<readonly [id: string, priceXof: number]>,
): Promise<DigitalCartView> {
  const [entries, catalogue] = await readCartAgainstCatalogue();
  const current = reconcileCart(entries, catalogue.products, catalogue.purchase);

  return settle(
    withAcknowledgedPrices(current, new Map(presented)),
    catalogue,
  );
}
