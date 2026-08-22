import "server-only";

import { cookies } from "next/headers";

import { isOrderReference, ORDER_PAYABLE_SECONDS } from "@/commerce/orders";
import { cookiesAreSecure } from "@/site-config";

/**
 * The order this browser is in the middle of paying for.
 *
 * One value, and it is a reference — no amount, no product, no name, no email.
 * Everything about the order is read back from the commerce data plane, so a
 * cookie a visitor has edited can name an order that is not theirs and the
 * worst it achieves is a page about somebody else's pending payment, which is
 * why the reference carries fifty bits of randomness (`newOrderReference()`).
 *
 * Unlike the Digital Cart's cookie this one is `httpOnly`. The cart is a
 * shopping list and being readable buys the header its count; this is the
 * address of a real commitment, nothing in the browser needs to read it, and
 * the checkout is a page rather than a script.
 *
 * Scoped to `/commande`, so it travels with the checkout and the return route
 * and with nothing else on the site. It lasts as long as the order may still be
 * paid for: a buyer past that window starts again at current prices, and a
 * cookie that outlived it would only point at something that can no longer be
 * used.
 */

const ORDER_COOKIE = "wc_order";

/** The checkout and the payment return, and nothing else. */
const COOKIE_PATH = "/commande";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookiesAreSecure(),
    path: COOKIE_PATH,
    maxAge: ORDER_PAYABLE_SECONDS,
  };
}

/**
 * The order in progress, or none.
 *
 * A value that is not shaped like one of our references is not one of ours, and
 * is not looked up: a lookup is a round trip to the data plane, and anything
 * may be typed into a cookie.
 */
export async function readOrderInProgress(): Promise<string | undefined> {
  const reference = (await cookies()).get(ORDER_COOKIE)?.value;
  return reference && isOrderReference(reference) ? reference : undefined;
}

export async function writeOrderInProgress(reference: string): Promise<void> {
  (await cookies()).set(ORDER_COOKIE, reference, cookieOptions());
}

/**
 * Forget the order this browser was carrying.
 *
 * The order itself is untouched: it stays in the data plane, pending and
 * diagnosable, because a buyer changing their mind is not a reason to lose the
 * record of what they nearly bought.
 */
export async function clearOrderInProgress(): Promise<void> {
  (await cookies()).delete({ name: ORDER_COOKIE, path: COOKIE_PATH });
}
