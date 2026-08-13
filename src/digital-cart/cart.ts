import {
  productAvailability,
  productPath,
  type DigitalProductAvailability,
  type PurchaseContext,
} from "@/managed-content/digital-products";
import type { DigitalProduct } from "@/managed-content/types";

/**
 * The Digital Cart's rules: what the browser is allowed to remember, and what
 * the shop makes of it when the shopper comes back.
 *
 * Pure functions over content, like `digital-products.ts` — no cookie, no
 * request, no provider — so the same module answers on the server, where the
 * cart is resolved, and in the browser, where the header reads how many things
 * are in it.
 *
 * The rule the whole file exists for: **the cookie is a list of identifiers and
 * nothing else is believed.** Every title, every price and every answer about
 * whether a product may still be bought is read back from published Managed
 * Content and the commerce system at the moment the cart is shown. A cookie a
 * visitor has edited can therefore name a product that does not exist, or one
 * that is no longer for sale, and the worst it achieves is a line that
 * disappears or refuses to proceed (issue #1).
 */

/**
 * One product the shopper has put in the cart, as the cookie records it.
 *
 * Two values, and the second is not a price the shop will ever charge. It is
 * the amount this shopper was last shown, kept so that a price published while
 * the product sat in their cart can be noticed and put in front of them
 * (issue #1). What they pay is recomputed from the catalogue every time.
 */
export interface DigitalCartEntry {
  /** The Digital Product's stable content identity. */
  id: string;
  /** The whole-XOF amount the shopper last saw and accepted. */
  acknowledgedPriceXof: number;
}

/**
 * Where the cart is kept. Named here rather than in `cookie.ts` because both
 * sides read it: the server through `next/headers`, the browser through
 * `document.cookie` — see the note in `cookie.ts` for why it may.
 */
export const CART_COOKIE_NAME = "wc_cart";

/**
 * The cookie's value: an array of `[identifier, acknowledged price]` pairs.
 *
 * Compact because a cookie travels with every request on this origin, and JSON
 * because a hand-rolled separator would have to escape whatever a content
 * provider allows in an id.
 */
export function encodeCartEntries(entries: readonly DigitalCartEntry[]): string {
  return JSON.stringify(
    entries.map((entry) => [entry.id, entry.acknowledgedPriceXof]),
  );
}

/**
 * The entries a cookie holds, or none at all.
 *
 * Total by construction: this reads a value a visitor can type, so anything
 * that is not a well-formed pair of an identifier and a whole amount is
 * dropped, and anything that is not well-formed JSON is an empty cart. It never
 * throws, because the alternative is a malformed cookie taking down every page
 * on the site.
 */
export function decodeCartEntries(value: string | undefined): DigitalCartEntry[] {
  if (!value) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }

  const entries: DigitalCartEntry[] = [];
  for (const pair of parsed) {
    if (!Array.isArray(pair)) continue;
    const [id, price] = pair as unknown[];
    if (typeof id !== "string" || id.length === 0) continue;
    if (!Number.isInteger(price) || (price as number) < 0) continue;
    entries.push({ id, acknowledgedPriceXof: price as number });
  }

  return dedupeEntries(entries);
}

/**
 * The cart a `document.cookie` string is carrying.
 *
 * The browser's own way in, so the header can say how many products are in the
 * cart before anything is asked of the server. It reads the count and nothing
 * else: the titles, the prices and whether any of it may still be bought are
 * the server's answer, never this one.
 */
export function cartEntriesFromDocumentCookie(
  documentCookie: string,
): DigitalCartEntry[] {
  const prefix = `${CART_COOKIE_NAME}=`;
  const pair = documentCookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!pair) {
    return [];
  }

  try {
    return decodeCartEntries(decodeURIComponent(pair.slice(prefix.length)));
  } catch {
    // A value that is not valid percent-encoding is not one this application
    // wrote, and a malformed cookie may not break the page it is read on.
    return [];
  }
}

/**
 * One copy of each product, whatever the cookie says.
 *
 * A Digital Product is licensed per buyer, so quantity is fixed at one and a
 * second copy of the same identifier is not a quantity of two — it is nothing
 * at all (issue #1). The first occurrence wins, which is the one whose
 * acknowledged price the shopper actually saw first.
 */
function dedupeEntries(entries: readonly DigitalCartEntry[]): DigitalCartEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

/** One product in the cart, resolved against what the shop currently sells. */
export interface DigitalCartLine {
  /** The stable identity the cookie holds. */
  id: string;
  sku: string;
  title: string;
  /** Where the shopper reads about it. */
  path: string;
  /** Today's published price, in whole XOF. */
  priceXof: number;
  /** What the shopper last accepted. Differs only after a published change. */
  acknowledgedPriceXof: number;
  availability: DigitalProductAvailability;
}

/** Whether this line's price moved since the shopper last saw it. */
export function hasPriceChanged(line: DigitalCartLine): boolean {
  return line.priceXof !== line.acknowledgedPriceXof;
}

/**
 * The Digital Cart as the shopper is shown it.
 *
 * Everything a caller needs to render the drawer and decide whether checkout
 * may be reached, resolved once — so no component recomputes a total or a
 * blocking condition and reaches a different answer.
 */
/**
 * What is standing between this cart and a checkout, when something is.
 *
 * A named reason rather than a set of booleans a caller reassembles: the cart
 * decides whether it may proceed, and adding a fourth way to be held up must
 * not leave a drawer somewhere announcing that everything is fine beside a
 * control that will not move.
 */
export type DigitalCartBlocker = "unavailableProducts" | "unacceptedPrices";

/** What the shopper has to do about each, in French. Beside the rule, as
 *  `AVAILABILITY_LABELS` is. */
export const CART_BLOCKER_LABELS: Record<DigitalCartBlocker, string> = {
  unavailableProducts: "Retirez les produits indisponibles pour continuer.",
  unacceptedPrices: "Acceptez les nouveaux prix pour continuer.",
};

export interface DigitalCartView {
  lines: DigitalCartLine[];
  itemCount: number;
  /**
   * What checkout would charge today: the current price of the lines that may
   * actually be bought. A line WeCreate has withdrawn is still listed, so the
   * shopper can see why they are held up, but it is not in the amount.
   */
  totalXof: number;
  isEmpty: boolean;
  /**
   * Lines dropped because no product answers to their identifier any more — a
   * deleted product, or an identifier that was never one of ours. Deliberately
   * not called withdrawn, which is what this application calls an archived
   * product: an archived product still resolves and is still listed. These
   * cannot even be named, so they are counted and the shopper is told the cart
   * changed.
   */
  unresolvedCount: number;
  /** At least one line whose price has moved since the shopper accepted it. */
  hasPriceChanges: boolean;
  /** Why this cart may not go to checkout, or `null` when nothing is in the way. */
  blockedBy: DigitalCartBlocker | null;
  /** Whether this cart may go to checkout as it stands. */
  canCheckOut: boolean;
}

export const EMPTY_DIGITAL_CART: DigitalCartView = {
  lines: [],
  itemCount: 0,
  totalXof: 0,
  isEmpty: true,
  unresolvedCount: 0,
  hasPriceChanges: false,
  blockedBy: null,
  canCheckOut: false,
};

/**
 * What the cookie's identifiers mean right now.
 *
 * Issue #1 calls the persisted cart "a convenience pointer" and asks for
 * current product data to be reloaded and prices recomputed before checkout.
 * This is that reload: the identifiers are matched against published Managed
 * Content and the commerce system's answer about Paid Deliverable Versions, and
 * everything the shopper reads comes from that match rather than from the
 * cookie.
 *
 * Four outcomes per identifier, and each is deliberate:
 *
 * - it names a product WeCreate may sell — an ordinary line;
 * - it names one whose price has changed — shown at the new amount, and
 *   holding checkout until the shopper accepts it;
 * - it names one that is archived or no longer purchasable — listed with the
 *   reason, and holding checkout until it is removed;
 * - it names nothing at all — dropped, and counted, because a cart that
 *   silently shrinks is worse than one that says so.
 *
 * A service pack, an add-on or a Wedding Film Signature falls into the last
 * case by construction rather than by a check: none of them is a Digital
 * Product, so none of them is in the list being searched (ADR-0006).
 */
export function reconcileCart(
  entries: readonly DigitalCartEntry[],
  products: readonly DigitalProduct[],
  purchase: PurchaseContext,
): DigitalCartView {
  const lines: DigitalCartLine[] = [];
  let unresolvedCount = 0;

  for (const entry of dedupeEntries(entries)) {
    const product = products.find((candidate) => candidate.id === entry.id);
    if (!product) {
      unresolvedCount += 1;
      continue;
    }

    lines.push({
      id: product.id,
      sku: product.sku,
      title: product.title,
      path: productPath(product.slug),
      priceXof: product.priceXof,
      acknowledgedPriceXof: entry.acknowledgedPriceXof,
      availability: productAvailability(product, purchase),
    });
  }

  const hasPriceChanges = lines.some(hasPriceChanged);
  // In the order the shopper has to act: a product WeCreate cannot sell has to
  // leave the cart before a price is worth accepting.
  const blockedBy: DigitalCartBlocker | null = lines.some(
    (line) => line.availability !== "available",
  )
    ? "unavailableProducts"
    : hasPriceChanges
      ? "unacceptedPrices"
      : null;

  return {
    lines,
    itemCount: lines.length,
    totalXof: lines
      .filter((line) => line.availability === "available")
      .reduce((total, line) => total + line.priceXof, 0),
    isEmpty: lines.length === 0,
    unresolvedCount,
    hasPriceChanges,
    blockedBy,
    canCheckOut: lines.length > 0 && blockedBy === null,
  };
}

/**
 * The cart written back the way the cookie holds it.
 *
 * Taken from the resolved lines rather than from what arrived, which is what
 * makes reconciliation self-healing: a withdrawn product, a duplicate and a
 * junk identifier are all gone from what is stored the next time the shopper
 * touches their cart.
 */
export function cartEntries(view: DigitalCartView): DigitalCartEntry[] {
  return view.lines.map((line) => ({
    id: line.id,
    acknowledgedPriceXof: line.acknowledgedPriceXof,
  }));
}

/**
 * The cart with one more product in it, or unchanged.
 *
 * Two refusals, and both matter against a forged request rather than against
 * the button: a product WeCreate may not currently sell never enters the cart,
 * and a product already in it does not enter twice. The price recorded is the
 * one the catalogue holds at this moment, so what the shopper accepted is what
 * the shop actually offered.
 */
export function withProduct(
  entries: readonly DigitalCartEntry[],
  product: DigitalProduct,
  purchase: PurchaseContext,
): DigitalCartEntry[] {
  if (productAvailability(product, purchase) !== "available") {
    return [...entries];
  }
  if (entries.some((entry) => entry.id === product.id)) {
    return [...entries];
  }

  return [...entries, { id: product.id, acknowledgedPriceXof: product.priceXof }];
}

/** The cart without one product. Removing something absent is not an error. */
export function withoutProduct(
  entries: readonly DigitalCartEntry[],
  productId: string,
): DigitalCartEntry[] {
  return entries.filter((entry) => entry.id !== productId);
}

/**
 * Accept the prices the shopper was actually shown.
 *
 * The deliberate step issue #1 asks for — a changed price is put in front of
 * the shopper, and they say yes to it before anything may be bought — and the
 * reason it takes what was *presented* rather than simply agreeing with the
 * catalogue. A price can be published between the drawer being drawn and the
 * button being pressed, and accepting an amount nobody has seen is exactly the
 * surprise the step exists to prevent. So a line is accepted only where the
 * amount on screen is still the amount on sale; any other line keeps what it
 * had, and the drawer asks again with the newer figure.
 *
 * Resolved lines are the input, so accepting cannot revive an identifier that
 * reconciliation dropped.
 */
export function withAcknowledgedPrices(
  view: DigitalCartView,
  presented: ReadonlyMap<string, number>,
): DigitalCartEntry[] {
  return view.lines.map((line) => ({
    id: line.id,
    acknowledgedPriceXof:
      presented.get(line.id) === line.priceXof
        ? line.priceXof
        : line.acknowledgedPriceXof,
  }));
}
