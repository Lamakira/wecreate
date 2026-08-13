import "server-only";

import { cookies } from "next/headers";

import {
  CART_COOKIE_NAME,
  decodeCartEntries,
  encodeCartEntries,
  type DigitalCartEntry,
} from "./cart";

/**
 * Where an anonymous Digital Cart lives for thirty days.
 *
 * One cookie, holding the identifiers of the products in it and the amount the
 * shopper last accepted for each — no title, no Paid Deliverable, no name,
 * address or telephone number, and nothing that could identify the person
 * carrying it. Issue #1 asks for exactly this: an anonymous cart persisted as a
 * convenience pointer, with the catalogue reloaded and the prices recomputed on
 * the server before anything is bought.
 *
 * **It is deliberately readable by the page.** Every other cookie this
 * application sets is `httpOnly`, because every other one is a credential. This
 * one is a shopping list: nothing in it is secret, nothing in it is believed,
 * and a script that could forge it could equally well call the Server Action
 * that writes it. What being readable buys is the one thing that matters on a
 * mobile connection in Bénin — the header can say how many things are in the
 * cart without asking the server, so a visitor whose cart is empty, which is
 * every visitor before the Commerce Launch Gate, pays for no request at all.
 *
 * The application is still the only writer. A page never sets it — Next.js
 * cannot — so it is written from `actions.ts` and read here.
 */

/** Thirty days, as issue #1 asks. */
export const CART_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * `sameSite: "lax"` so the cart survives arriving from a shared link, `secure`
 * wherever the deployment is real, and scoped to the whole site because the
 * header carries the cart on every page.
 */
function cartCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_MAX_AGE_SECONDS,
  };
}

/** The raw cookie, for deciding whether a rewrite would change anything. */
export async function readCartCookie(): Promise<string | undefined> {
  return (await cookies()).get(CART_COOKIE_NAME)?.value;
}

export async function readCartEntries(): Promise<DigitalCartEntry[]> {
  return decodeCartEntries(await readCartCookie());
}

/**
 * Store the cart, or forget it entirely once it is empty.
 *
 * An empty cart is deleted rather than written as `[]`: there is nothing to
 * remember, and a visitor who has emptied their cart should not be left
 * carrying a cookie for thirty days because of it.
 *
 * Writing also renews the thirty days, so the clock runs from the last change
 * a shopper made to their cart rather than from the first.
 */
export async function writeCartEntries(
  entries: readonly DigitalCartEntry[],
): Promise<void> {
  const store = await cookies();

  if (entries.length === 0) {
    store.delete({ name: CART_COOKIE_NAME, path: "/" });
    return;
  }

  store.set(CART_COOKIE_NAME, encodeCartEntries(entries), cartCookieOptions());
}
