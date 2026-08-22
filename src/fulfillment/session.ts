import "server-only";

import { cookies } from "next/headers";

import { ORDER_ACCESS_DAYS } from "@/commerce/order-access";
import { cookiesAreSecure } from "@/site-config";

import { isAccessToken } from "./token";

/**
 * The Order Access this browser is carrying.
 *
 * One value, and it is the token itself — unlike the checkout's cookie, which
 * holds a reference and looks everything else up. It has to be: there is no
 * account here and nothing else identifies the buyer, so the credential is what
 * the browser keeps.
 *
 * **The emailed address puts it here and then goes away.** A buyer follows
 * `/commande/acces/<token>`, which sets this and redirects to `/commande/acces`
 * — so the page they end up reading, reload, bookmark or hand to somebody
 * looking over their shoulder does not carry the token, and neither does any
 * referrer it sends. The address in their mail still does, which is unavoidable
 * for a link somebody has to be able to follow twice, and is why the token
 * expires with the access rather than living for ever.
 *
 * `httpOnly`, because it is a credential and nothing in the browser reads it.
 * Scoped to `/commande/acces`, so it travels with the two surfaces that need it
 * and with nothing else on the site — not the checkout, not the Boutique, not a
 * marketing page.
 */

const ACCESS_COOKIE = "wc_acces";

/** The access page and the download it starts, and nothing else. */
const COOKIE_PATH = "/commande/acces";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookiesAreSecure(),
    path: COOKIE_PATH,
    // As long as the access itself. A cookie that outlived it would only point
    // at something that can no longer be used.
    maxAge: ORDER_ACCESS_DAYS * 24 * 60 * 60,
  };
}

/**
 * The token this browser holds, or none.
 *
 * A value that is not shaped like one of ours is not one, and is not looked up:
 * a lookup is a round trip to the data plane, and anything may be typed into a
 * cookie.
 */
export async function readAccessToken(): Promise<string | undefined> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  return token && isAccessToken(token) ? token : undefined;
}

export async function writeAccessToken(token: string): Promise<void> {
  (await cookies()).set(ACCESS_COOKIE, token, cookieOptions());
}
